// Background runs of writing a job's steps: at most one at a time per job (see the migration).
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../errors";

/**
 * A run still going after this long was lost to a restart or deploy. Longer than the model's worst
 * case: three minutes an attempt, two attempts, and a large manual's upload.
 */
export const RUN_STALE_SECONDS = 8 * 60;

export interface ProcedureRun {
  status: "running" | "done" | "failed";
  message: string | null;
  citedSteps: number | null;
  startedAt: string;
}

export interface ProcedureRunsRepo {
  /** True when the caller should do the work; false when a run is already going. */
  claim(jobId: string): Promise<boolean>;
  finish(
    jobId: string,
    outcome: { status: "done"; citedSteps: number } | { status: "failed"; message: string },
  ): Promise<void>;
  get(jobId: string): Promise<ProcedureRun | null>;
}

export function supabaseProcedureRunsRepo(db: SupabaseClient): ProcedureRunsRepo {
  return {
    async claim(jobId) {
      const { data, error } = await db.rpc("claim_procedure_run", {
        p_job_id: jobId,
        p_stale_seconds: RUN_STALE_SECONDS,
      });
      if (error) throw dbError(error);
      return data === true;
    },
    async finish(jobId, outcome) {
      const { error } = await db
        .from("procedure_runs")
        .update({
          status: outcome.status,
          message: outcome.status === "failed" ? outcome.message : null,
          cited_steps: outcome.status === "done" ? outcome.citedSteps : null,
          finished_at: new Date().toISOString(),
        })
        .eq("job_id", jobId);
      if (error) throw dbError(error);
    },
    async get(jobId) {
      const { data, error } = await db
        .from("procedure_runs")
        .select("status, message, cited_steps, started_at")
        .eq("job_id", jobId)
        .maybeSingle();
      if (error) throw dbError(error);
      return data
        ? {
            status: data.status,
            message: data.message,
            citedSteps: data.cited_steps,
            startedAt: data.started_at,
          }
        : null;
    },
  };
}
