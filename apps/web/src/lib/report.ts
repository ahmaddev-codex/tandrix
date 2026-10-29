// Formatting and fetching for shared job reports (/r/[token]).
import { JobReportResponse, type Job, type ReportStep, type SafetyGate } from "@tandrix/contracts";
import { citationLabel, formatDate, formatTime, stepChip, type SourceKind } from "@tandrix/ui";
import type { JobReportStep } from "@tandrix/ui/web";

export const LINK_GONE = "This report link has expired or was turned off. Ask for a new one.";
export const REPORT_UNAVAILABLE =
  "Tandrix couldn't reach the report service right now. Try refreshing in a moment.";

const jobStatusLabel: Record<Job["status"], string> = {
  active: "In progress",
  completed: "Completed",
  stopped: "Paused",
};

export const safetyGateLabel: Record<SafetyGate, string> = {
  isolate_power: "Power isolated",
  release_pressure: "Pressure released",
  lock_rotation: "Rotation locked",
  cool_down: "Cooled down",
  lifting_plan: "Lifting plan ready",
  chemical_ppe: "PPE worn",
};

export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

export function reportMeta(report: JobReportResponse): string {
  const parts = [jobStatusLabel[report.job.status]];
  if (report.equipment) parts.push(report.equipment);
  if (report.manual) parts.push(report.manual);
  parts.push(`${report.steps.length} ${report.steps.length === 1 ? "step" : "steps"}`);
  parts.push(`Updated ${formatDate(report.job.updatedAt)}`);
  return parts.join(" · ");
}

export function reportStepSource(step: ReportStep): { source: string; sourceKind: SourceKind } {
  const cited = citationLabel(step.citation);
  if (cited) return { source: cited, sourceKind: "manual" };
  if (step.surface === "desktop") return { source: "Screen", sourceKind: "screen" };
  return { source: "Generic, not from the manufacturer", sourceKind: "generic" };
}

export function toReportStepProps(step: ReportStep): Omit<JobReportStep, "thumbnail"> {
  const chip = stepChip[step.status];
  const { source, sourceKind } = reportStepSource(step);
  const note = step.note ?? step.check?.reason;
  return {
    index: step.index,
    title: step.title,
    status: chip.status,
    statusLabel: chip.label,
    note,
    source,
    sourceKind,
    time: formatTime(step.evidence?.capturedAt ?? step.updatedAt),
  };
}

export type SharedReportResult =
  | { kind: "ok"; report: JobReportResponse }
  | { kind: "gone"; message: string }
  | { kind: "error"; message: string };

export async function fetchSharedReport(
  token: string,
  baseUrl = process.env.API_PUBLIC_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8787",
): Promise<SharedReportResult> {
  if (!isValidShareToken(token)) {
    return { kind: "gone", message: LINK_GONE };
  }
  const url = `${baseUrl.replace(/\/+$/, "")}/report/${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) {
      return { kind: "gone", message: LINK_GONE };
    }
    if (!res.ok) {
      return { kind: "error", message: REPORT_UNAVAILABLE };
    }
    const parsed = JobReportResponse.safeParse(await res.json());
    if (!parsed.success) {
      return { kind: "error", message: REPORT_UNAVAILABLE };
    }
    return { kind: "ok", report: parsed.data };
  } catch {
    return { kind: "error", message: REPORT_UNAVAILABLE };
  }
}
