import type { Job, JobDetailResponse, JobStep } from "@tandrix/contracts";
import { api } from "@/lib/api";

export interface HomeAction {
  job: Job;
  title: string;
  detail: string;
  stepId?: string;
  stepNumber?: number;
  stepCount?: number;
}

function isFinished(step: JobStep) {
  return ["verified", "user_confirmed", "skipped"].includes(step.status);
}

export function actionFor(detail: JobDetailResponse): HomeAction {
  const { job, procedure, steps } = detail;
  if (job.activeSurface === "desktop") {
    return { job, title: "See your progress on Mac", detail: "This project is open on your Mac." };
  }
  if (!procedure) {
    if (detail.asset && !detail.manual) {
      return {
        job,
        title: "Find the equipment manual",
        detail: `${detail.asset.make} ${detail.asset.model}`,
      };
    }
    return {
      job,
      title: "Create the project steps",
      detail: detail.manual
        ? "Use the manual saved to this project."
        : "Turn this idea into a clear plan.",
    };
  }

  const priority: Record<JobStep["status"], number> = {
    blocked: 0,
    needs_attention: 0,
    in_progress: 1,
    todo: 2,
    user_confirmed: 3,
    verified: 3,
    skipped: 3,
  };
  const candidates = procedure.steps
    .map((step) => ({
      step,
      jobStep: steps.find((candidate) => candidate.procedureStepId === step.id),
    }))
    .filter(
      (item): item is typeof item & { jobStep: JobStep } =>
        !!item.jobStep && !isFinished(item.jobStep),
    )
    .sort(
      (a, b) =>
        priority[a.jobStep.status] - priority[b.jobStep.status] || a.step.order - b.step.order,
    );
  const next = candidates[0];
  if (!next) {
    return { job, title: "Review this project", detail: "Open the project to see the full plan." };
  }

  const label: Record<JobStep["status"], string> = {
    blocked: "Resolve",
    needs_attention: "Review",
    in_progress: "Continue",
    todo: "Start",
    user_confirmed: "Review",
    verified: "Continue",
    skipped: "Continue",
  };
  const message: Record<JobStep["status"], string> = {
    blocked: next.jobStep.note ?? "This step is blocked.",
    needs_attention: "This step needs your attention.",
    in_progress: "Pick up where you left off.",
    todo: "Ready when you are.",
    user_confirmed: "Review this step.",
    verified: "This step is complete.",
    skipped: "This step was skipped.",
  };
  return {
    job,
    title: `${label[next.jobStep.status]}: ${next.step.title}`,
    detail: message[next.jobStep.status],
    stepId: next.jobStep.id,
    stepNumber: next.step.order,
    stepCount: procedure.steps.length,
  };
}

export async function loadHomeActions(jobs: Job[]): Promise<HomeAction[]> {
  const active = jobs.filter((job) => job.status === "active");
  const actions: HomeAction[] = [];
  for (let i = 0; i < active.length; i += 20) {
    const results = await Promise.allSettled(
      active.slice(i, i + 20).map((job) => api.getJob(job.id)),
    );
    actions.push(
      ...results.flatMap((result) =>
        result.status === "fulfilled" ? [actionFor(result.value)] : [],
      ),
    );
  }
  return actions;
}
