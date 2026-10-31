// Procedures: generated per job, read with their parts and steps.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Citation,
  Id,
  PartSpec,
  Procedure,
  ProcedureStep,
  type ProcedureDetail,
  type ProcedureDraft,
  type Surface,
} from "@tandrix/contracts";
import { dbError } from "../errors";

export interface SaveProcedure {
  ownerId: string;
  jobId: string;
  procedureId: string;
  assetModelKey: string;
  manualId: string | null;
  /** The normalised draft, with part refs already mapped to ids. */
  draft: ProcedureDraft;
  partIds: Map<string, string>;
  stepIds: string[];
  surface: Surface;
  event: Record<string, unknown>;
  /** A procedure made from an expert's recording (record mode); else manual or generic. */
  fromRecording?: boolean;
  /** Record mode: per step, the evidence of the moment it came from (null for generic steps). */
  stepMoments?: Array<string | null>;
}

export interface ProceduresRepo {
  save(input: SaveProcedure): Promise<void>;
  /** The procedure with parts and steps (in order), if the owner may read it. */
  getDetail(ownerId: string, procedureId: string): Promise<ProcedureDetail | null>;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(String(v)).toISOString();
const opt = (v: unknown) => (v === null || v === undefined ? undefined : v);

const toProcedure = (r: Row): Procedure =>
  Procedure.parse({
    id: r.id,
    assetModelKey: r.asset_model_key,
    sourceType: r.source_type,
    authorId: r.author_id,
    status: r.status,
    version: r.version,
    title: r.title,
    manualId: r.manual_id,
    createdAt: iso(r.created_at),
  });

const toPart = (r: Row): PartSpec =>
  PartSpec.parse({
    id: r.id,
    procedureId: r.procedure_id,
    partNumber: opt(r.part_number),
    name: r.name,
    qty: r.qty,
    description: opt(r.description),
  });

const toStep = (r: Row): ProcedureStep =>
  ProcedureStep.parse({
    id: r.id,
    procedureId: r.procedure_id,
    order: r.order,
    surface: r.surface,
    title: r.title,
    instruction: r.instruction,
    reason: opt(r.reason),
    partSpecIds: r.part_spec_ids,
    caution: opt(r.caution),
    hazardTags: r.hazard_tags,
    verification: r.verification,
    expectedState: r.expected_state,
    measurement: opt(r.measurement),
    citation: Citation.parse(r.citation),
    referenceImageKey: opt(r.reference_image_key),
  });

export function supabaseProceduresRepo(db: SupabaseClient): ProceduresRepo {
  return {
    async save(input) {
      const { draft, partIds, stepIds } = input;
      const { error } = await db.rpc("save_procedure", {
        p_owner_id: input.ownerId,
        p_job_id: input.jobId,
        p_procedure: {
          id: input.procedureId,
          asset_model_key: input.assetModelKey,
          source_type: input.fromRecording
            ? "expert_recording"
            : input.manualId
              ? "manual"
              : "generic",
          title: draft.title,
          manual_id: input.manualId ?? "",
        },
        p_parts: draft.parts.map((p) => ({
          id: partIds.get(p.ref),
          part_number: p.partNumber ?? null,
          name: p.name,
          qty: p.qty,
          description: null,
        })),
        p_steps: draft.steps.map((s, i) => ({
          id: stepIds[i],
          order: s.order,
          surface: s.surface,
          title: s.title,
          instruction: s.instruction,
          reason: s.reason ?? null,
          part_spec_ids: s.partRefs.map((ref) => partIds.get(ref)),
          caution: s.caution ?? null,
          hazard_tags: s.hazardTags,
          verification: s.verification,
          expected_state: s.expectedState,
          measurement: s.measurement ?? null,
          citation:
            s.citation.kind === "manual" && input.manualId
              ? {
                  kind: "manual",
                  manualId: input.manualId,
                  page: s.citation.page,
                  ...(s.citation.figure ? { figure: s.citation.figure } : {}),
                }
              : s.citation.kind === "expert_recording" && input.stepMoments?.[i]
                ? {
                    kind: "expert_recording",
                    recordingEvidenceId: input.stepMoments[i],
                    timestampSec: s.citation.timestampSec,
                  }
                : { kind: "generic" },
        })),
        p_surface: input.surface,
        p_event: input.event,
      });
      if (error) throw dbError(error);
    },

    async getDetail(ownerId, procedureId) {
      // All three reads need only the procedure id, so they run together; errors surface in the
      // same order as before, and a missing procedure still returns null.
      const [proc, parts, steps] = await Promise.all([
        db
          .from("procedures")
          .select(
            "id, asset_model_key, source_type, author_id, status, version, title, manual_id, created_at",
          )
          .eq("id", procedureId)
          // The owner id goes into a PostgREST filter string, so it must be exactly a UUID.
          .or(`status.eq.published,author_id.eq.${Id.parse(ownerId)}`)
          .maybeSingle(),
        db.from("part_specs").select("*").eq("procedure_id", procedureId).order("name"),
        db.from("procedure_steps").select("*").eq("procedure_id", procedureId).order("order"),
      ]);
      if (proc.error) throw dbError(proc.error);
      if (!proc.data) return null;
      if (parts.error) throw dbError(parts.error);
      if (steps.error) throw dbError(steps.error);
      return {
        procedure: toProcedure(proc.data),
        parts: parts.data.map(toPart),
        steps: steps.data.map(toStep),
      };
    },
  };
}
