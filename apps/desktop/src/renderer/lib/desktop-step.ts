import type { JobDetailResponse, JobStep, ProcedureStep } from "@tandrix/contracts";

export interface DesktopStep {
  step: ProcedureStep;
  jobStep: JobStep;
  total: number;
}

const finished = new Set<JobStep["status"]>(["verified", "user_confirmed", "skipped"]);

/**
 * The step the Mac works on: the job's current step when it's done in software, otherwise the
 * first unfinished desktop step. None when every desktop step is finished.
 */
export function desktopStep(detail: JobDetailResponse): DesktopStep | undefined {
  const steps = detail.procedure?.steps ?? [];
  const pair = (step: ProcedureStep) => {
    const jobStep = detail.steps.find((s) => s.procedureStepId === step.id);
    return jobStep ? { step, jobStep, total: steps.length } : undefined;
  };
  const open = steps
    .filter((s) => s.surface === "desktop")
    .map(pair)
    .filter((p): p is DesktopStep => !!p && !finished.has(p.jobStep.status))
    .sort((a, b) => a.step.order - b.step.order);
  return open.find((p) => p.jobStep.id === detail.job.currentStepId) ?? open[0];
}
