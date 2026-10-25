// Parts checks: the latest result per job, saved with its detections and the steps it blocks.
import type { SupabaseClient } from "@supabase/supabase-js";
import { PartsCheck, type Box, type PartStatus } from "@tandrix/contracts";
import { dbError } from "../errors";

export interface BlockChanges {
  block: Array<{ jobStepId: string; fromStatus: string; note: string }>;
  unblock: string[];
}

export interface NewPartsCheck extends BlockChanges {
  ownerId: string;
  jobId: string;
  evidenceId: string;
  detections: Array<{
    id: string;
    label: string;
    partSpecId: string;
    box: Box;
    confidence: number;
  }>;
  results: PartsCheck["results"];
}

export interface PartsChecksRepo {
  latest(jobId: string): Promise<PartsCheck | null>;
  getForJob(jobId: string, partsCheckId: string): Promise<PartsCheck | null>;
  save(c: NewPartsCheck): Promise<PartsCheck>;
  correct(
    c: BlockChanges & { ownerId: string; partsCheckId: string; results: PartsCheck["results"] },
  ): Promise<PartsCheck>;
}

type Row = Record<string, unknown>;

const toPartsCheck = (r: Row): PartsCheck =>
  PartsCheck.parse({
    id: r.id,
    jobId: r.job_id,
    evidenceIds: r.evidence_ids,
    results: r.results,
    createdAt: new Date(String(r.created_at)).toISOString(),
  });

const blockArgs = (c: BlockChanges) => ({
  p_block: c.block.map((b) => ({
    job_step_id: b.jobStepId,
    from_status: b.fromStatus,
    note: b.note,
  })),
  p_unblock: c.unblock.map((id) => ({ job_step_id: id })),
});

export function supabasePartsChecksRepo(db: SupabaseClient): PartsChecksRepo {
  return {
    async latest(jobId) {
      const { data, error } = await db
        .from("parts_checks")
        .select("id, job_id, evidence_ids, results, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toPartsCheck(data) : null;
    },

    async getForJob(jobId, id) {
      const { data, error } = await db
        .from("parts_checks")
        .select("id, job_id, evidence_ids, results, created_at")
        .eq("id", id)
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? toPartsCheck(data) : null;
    },

    async save(c) {
      const { data, error } = await db
        .rpc("save_parts_check", {
          p_owner_id: c.ownerId,
          p_job_id: c.jobId,
          p_evidence_id: c.evidenceId,
          p_detections: c.detections.map((d) => ({
            id: d.id,
            label: d.label,
            part_spec_id: d.partSpecId,
            box: d.box,
            confidence: d.confidence,
          })),
          p_results: c.results,
          ...blockArgs(c),
          p_surface: "phone",
        })
        .single();
      if (error) throw dbError(error);
      return toPartsCheck(data as Row);
    },

    async correct(c) {
      const { data, error } = await db
        .rpc("correct_parts_check", {
          p_owner_id: c.ownerId,
          p_parts_check_id: c.partsCheckId,
          p_results: c.results,
          ...blockArgs(c),
          p_surface: "phone",
        })
        .single();
      if (error) throw dbError(error);
      return toPartsCheck(data as Row);
    },
  };
}

export type { PartStatus };
