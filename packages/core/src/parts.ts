// Parts-check effects on steps and the report summary.
import type { JobStepStatus, PartStatus } from "@tandrix/contracts";

export interface StepParts {
  stepId: string;
  status: JobStepStatus;
  partSpecIds: readonly string[];
  /** Why the step is blocked, if it is. Only parts blocks are lifted automatically. */
  blockedBy?: "parts" | "other";
}

export interface PartsCheckDecision {
  block: Array<{ stepId: string; missingPartSpecIds: string[] }>;
  unblock: string[];
}

const blockable: JobStepStatus[] = ["todo", "in_progress", "needs_attention"];

/** Missing parts block the steps that need them; parts that turn up unblock those steps. */
export function applyPartsCheck(
  steps: readonly StepParts[],
  results: ReadonlyArray<{ partSpecId: string; status: PartStatus }>,
): PartsCheckDecision {
  const missing = new Set(results.filter((r) => r.status === "missing").map((r) => r.partSpecId));
  const decision: PartsCheckDecision = { block: [], unblock: [] };
  for (const step of steps) {
    const stepMissing = step.partSpecIds.filter((p) => missing.has(p));
    if (stepMissing.length && blockable.includes(step.status)) {
      decision.block.push({ stepId: step.stepId, missingPartSpecIds: stepMissing });
    } else if (!stepMissing.length && step.status === "blocked" && step.blockedBy === "parts") {
      decision.unblock.push(step.stepId);
    }
  }
  return decision;
}

export interface ReportCounts {
  verified: number;
  confirmed: number;
  attention: number;
  unresolved: number;
  skipped: number;
}

/** Counts for JobReport. Anything not finished, including blocked, counts as unresolved. */
export function summarizeSteps(statuses: readonly JobStepStatus[]): ReportCounts {
  const c: ReportCounts = { verified: 0, confirmed: 0, attention: 0, unresolved: 0, skipped: 0 };
  for (const s of statuses) {
    if (s === "verified") c.verified++;
    else if (s === "user_confirmed") c.confirmed++;
    else if (s === "needs_attention") c.attention++;
    else if (s === "skipped") c.skipped++;
    else c.unresolved++;
  }
  return c;
}
