// Detections: parts found in a photo, and the user's verdict on each.
import type { SupabaseClient } from "@supabase/supabase-js";
import { Detection, MaskOutline, type Box } from "@tandrix/contracts";
import { dbError } from "../errors";

export interface NewDetection {
  evidenceId: string;
  label: string;
  partSpecId: string;
  box: Box;
  mask: MaskOutline | null;
  confidence: number;
}

export interface DetectionVerdict {
  confirmedByUser: boolean;
  /** Set when the user says it's a different part of the step. */
  correctedLabel?: string;
  partSpecId?: string;
}

export interface DetectionsRepo {
  insertMany(rows: NewDetection[]): Promise<Detection[]>;
  /** Callers check the detection's evidence belongs to the user's job. */
  get(detectionId: string): Promise<Detection | null>;
  setVerdict(detectionId: string, v: DetectionVerdict): Promise<Detection>;
}

type Row = Record<string, unknown>;
const COLUMNS =
  "id, evidence_id, label, part_spec_id, box, mask, confidence, confirmed_by_user, corrected_label";

const toDetection = (r: Row): Detection =>
  Detection.parse({
    id: r.id,
    evidenceId: r.evidence_id,
    label: r.label,
    partSpecId: r.part_spec_id,
    box: r.box,
    mask: r.mask === null ? null : MaskOutline.parse(r.mask),
    confidence: r.confidence,
    confirmedByUser: r.confirmed_by_user,
    correctedLabel: r.corrected_label ?? undefined,
  });

export function supabaseDetectionsRepo(db: SupabaseClient): DetectionsRepo {
  return {
    async insertMany(rows) {
      if (!rows.length) return [];
      const { data, error } = await db
        .from("detections")
        .insert(
          rows.map((r) => ({
            evidence_id: r.evidenceId,
            label: r.label,
            part_spec_id: r.partSpecId,
            box: r.box,
            mask: r.mask,
            confidence: r.confidence,
          })),
        )
        .select(COLUMNS);
      if (error) throw dbError(error);
      return data.map(toDetection);
    },

    async get(id) {
      const { data, error } = await db
        .from("detections")
        .select(COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toDetection(data) : null;
    },

    async setVerdict(id, v) {
      const { data, error } = await db
        .from("detections")
        .update({
          confirmed_by_user: v.confirmedByUser,
          corrected_label: v.correctedLabel ?? null,
          ...(v.partSpecId ? { part_spec_id: v.partSpecId } : {}),
        })
        .eq("id", id)
        .select(COLUMNS)
        .single();
      if (error) throw dbError(error);
      return toDetection(data);
    },
  };
}
