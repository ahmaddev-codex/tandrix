// Builds a job's report from what the job already holds: steps and their statuses, the latest
// check on each, the evidence behind it (as short-lived links), safety confirmations and the
// parts check. The same report serves the owner and anyone with a share link.
import type { JobReportResponse, ReportStep } from "@tandrix/contracts";
import type { AssetsRepo } from "./repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "./repos/evidence";
import type { JobsRepo } from "./repos/jobs";
import type { ManualsRepo } from "./repos/manuals";
import type { PartsChecksRepo } from "./repos/parts-checks";
import type { ProceduresRepo } from "./repos/procedures";
import type { ReportsRepo } from "./repos/reports";
import type { StepStateRepo } from "./repos/step-state";

/** Evidence links in a report last this long; the page fetches fresh ones each time it opens. */
export const REPORT_LINK_SEC = 15 * 60;

export interface ReportDeps {
  jobs: JobsRepo;
  procedures: ProceduresRepo;
  assets: AssetsRepo;
  manuals: ManualsRepo;
  stepState: StepStateRepo;
  partsChecks: PartsChecksRepo;
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  reports: ReportsRepo;
}

export async function buildReport(
  d: ReportDeps,
  ownerId: string,
  jobId: string,
  now: Date,
): Promise<JobReportResponse | null> {
  const found = await d.jobs.getForOwner(ownerId, jobId);
  if (!found) return null;
  const { job, steps: jobSteps } = found;
  const [procedure, asset, checks, confirmations, partsCheck, evidence] = await Promise.all([
    job.procedureId ? d.procedures.getDetail(ownerId, job.procedureId) : null,
    job.assetId ? d.assets.getForOwner(ownerId, job.assetId) : null,
    d.reports.latestChecks(jobId),
    d.stepState.confirmations(jobId),
    d.partsChecks.latest(jobId),
    d.evidence.listUploaded(jobId),
  ]);
  const manual = procedure?.procedure.manualId
    ? await d.manuals.getForOwner(ownerId, procedure.procedure.manualId)
    : null;

  const ordered = (procedure?.steps ?? [])
    .map((step) => ({ step, js: jobSteps.find((s) => s.procedureStepId === step.id) }))
    .filter((p): p is { step: (typeof p)["step"]; js: NonNullable<(typeof p)["js"]> } => !!p.js)
    .sort((a, b) => a.step.order - b.step.order);

  // The evidence that settled each step, else the one its latest check looked at.
  const byId = new Map(evidence.map((e) => [e.id, e]));
  const shown = new Map(
    ordered.map(({ js }) => {
      const check = checks.find((c) => c.jobStepId === js.id);
      const ev = byId.get(js.statusEvidenceId ?? check?.evidenceId ?? "");
      return [js.id, ev && (ev.kind === "photo" || ev.kind === "screenshot") ? ev : undefined];
    }),
  );
  const urls = await d.storage.signedReadUrls(
    [...shown.values()].filter((e) => e !== undefined).map((e) => e.storageKey),
    REPORT_LINK_SEC,
  );

  const steps: ReportStep[] = ordered.map(({ step, js }) => {
    const check = checks.find((c) => c.jobStepId === js.id);
    const ev = shown.get(js.id);
    const url = ev ? urls.get(ev.storageKey) : undefined;
    return {
      index: step.order,
      title: step.title,
      surface: step.surface,
      status: js.status,
      ...(js.note ? { note: js.note } : {}),
      citation: step.citation,
      updatedAt: js.updatedAt,
      evidence:
        ev && url
          ? { kind: ev.kind as "photo" | "screenshot", url, capturedAt: ev.capturedAt }
          : null,
      check: check ? { result: check.result, reason: check.reason } : null,
    };
  });

  const count = (s: ReportStep["status"][]) => steps.filter((x) => s.includes(x.status)).length;
  const indexOf = (jobStepId: string) =>
    ordered.find(({ js }) => js.id === jobStepId)?.step.order ?? 0;

  return {
    job: {
      title: job.title,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    },
    equipment: asset
      ? `${asset.make} ${asset.model}${asset.serial ? `, serial ${asset.serial}` : ""}`
      : null,
    manual: manual?.title ?? null,
    steps,
    counts: {
      verified: count(["verified"]),
      confirmed: count(["user_confirmed"]),
      attention: count(["needs_attention"]),
      // Skipped steps carry their reason in the list; everything else not done is unresolved.
      unresolved: count(["todo", "in_progress", "blocked"]),
    },
    safety: confirmations
      .map((c) => ({ stepIndex: indexOf(c.jobStepId), gate: c.gate, confirmedAt: c.confirmedAt }))
      .filter((c) => c.stepIndex > 0),
    parts: partsCheck
      ? {
          found: partsCheck.results.filter((r) => r.status === "found").length,
          possible: partsCheck.results.filter((r) => r.status === "possible").length,
          missing: partsCheck.results.filter((r) => r.status === "missing").length,
        }
      : null,
    generatedAt: now.toISOString(),
  };
}
