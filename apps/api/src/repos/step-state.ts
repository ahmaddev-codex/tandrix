// What the step rules need to know about a step, and saving what they decide.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SafetyConfirmation,
  type CheckResult,
  type JobStep,
  type JobStepStatus,
  type SafetyGate,
  type Surface,
} from "@tandrix/contracts";
import { dbError } from "../errors";
import { toJobStep } from "./jobs";

export interface StepTransition {
  ownerId: string;
  jobStepId: string;
  /** The status the rules were applied to; the save fails if the step changed since. */
  fromStatus: JobStepStatus;
  to: {
    status: JobStepStatus;
    startedAt: string | null;
    statusEvidenceId: string | null;
    note?: string;
  };
  surface: Surface;
  event: Record<string, unknown>;
}

export interface StepStateRepo {
  /** Every confirmation on the job's steps. */
  confirmations(jobId: string): Promise<SafetyConfirmation[]>;
  /** The latest check on the step at or after `since`, if any. */
  lastCheckSince(jobStepId: string, since: string): Promise<CheckResult | null>;
  confirmGate(
    ownerId: string,
    jobStepId: string,
    gate: SafetyGate,
    surface: Surface,
  ): Promise<SafetyConfirmation>;
  applyTransition(t: StepTransition): Promise<JobStep>;
}

type Row = Record<string, unknown>;
const iso = (v: unknown) => new Date(String(v)).toISOString();

const toConfirmation = (r: Row): SafetyConfirmation =>
  SafetyConfirmation.parse({
    id: r.id,
    jobStepId: r.job_step_id,
    gate: r.gate,
    confirmedBy: r.confirmed_by,
    surface: r.surface,
    confirmedAt: iso(r.confirmed_at),
  });

export function supabaseStepStateRepo(db: SupabaseClient): StepStateRepo {
  return {
    async confirmations(jobId) {
      const { data, error } = await db
        .from("safety_confirmations")
        .select(
          "id, job_step_id, gate, confirmed_by, surface, confirmed_at, job_steps!inner(job_id)",
        )
        .eq("job_steps.job_id", jobId)
        .order("confirmed_at");
      if (error) throw dbError(error);
      return data.map(toConfirmation);
    },

    async lastCheckSince(jobStepId, since) {
      const { data, error } = await db
        .from("checks")
        .select("result")
        .eq("job_step_id", jobStepId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw dbError(error);
      return data ? (data.result as CheckResult) : null;
    },

    async confirmGate(ownerId, jobStepId, gate, surface) {
      const { data, error } = await db
        .rpc("confirm_safety_gate", {
          p_owner_id: ownerId,
          p_job_step_id: jobStepId,
          p_gate: gate,
          p_surface: surface,
        })
        .single();
      if (error) throw dbError(error);
      return toConfirmation(data as Row);
    },

    async applyTransition(t) {
      const { data, error } = await db
        .rpc("apply_step_transition", {
          p_owner_id: t.ownerId,
          p_job_step_id: t.jobStepId,
          p_from_status: t.fromStatus,
          p_to: {
            status: t.to.status,
            started_at: t.to.startedAt,
            status_evidence_id: t.to.statusEvidenceId,
            note: t.to.note ?? null,
          },
          p_surface: t.surface,
          p_event: t.event,
        })
        .single();
      if (error) throw dbError(error);
      return toJobStep(data as Row);
    },
  };
}
