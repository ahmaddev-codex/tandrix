// How job steps read on screen: status chip and source chip text, per the design system.
import type { Citation, JobStepStatus } from "@tandrix/contracts";
import type { StepStatus } from "@tandrix/ui";

/** The design system's chip for each job step status. "Verified" is only ever from a check. */
export const stepChip: Record<JobStepStatus, { status: StepStatus; label?: string }> = {
  todo: { status: "pending", label: "To do" },
  in_progress: { status: "progress" },
  needs_attention: { status: "attention" },
  user_confirmed: { status: "confirmed" },
  verified: { status: "verified" },
  blocked: { status: "blocked" },
  skipped: { status: "pending", label: "Skipped" },
};

/** "Manual p.14, fig. 3", exactly as the SourceChip spec writes it; null for generic. */
export function citationLabel(c: Citation): string | null {
  if (c.kind !== "manual") return null;
  const fig = c.figure?.replace(/^fig(ure)?\.?\s*/i, "").trim();
  return `Manual p.${c.page}${fig ? `, fig. ${fig}` : ""}`;
}
