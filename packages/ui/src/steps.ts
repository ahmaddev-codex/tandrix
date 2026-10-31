// How job steps read on screen: status chip and source chip text, per the design system.
import type { Citation, JobStepStatus, StepVisual } from "@tandrix/contracts";
import type { SourceKind, StepStatus } from "./shared";

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

/**
 * Where a step comes from, for its source chip: the manual page, or the moment in an expert's
 * recording. Null for a generic step.
 */
export function citationSource(c: Citation): { source: string; sourceKind: SourceKind } | null {
  if (c.kind === "manual") return { source: citationLabel(c)!, sourceKind: "manual" };
  if (c.kind === "expert_recording") {
    const s = Math.round(c.timestampSec);
    return {
      source: `Recorded at ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`,
      sourceKind: "expert",
    };
  }
  return null;
}

/** How a step visual is named on screen: its tab, its SourceChip, and its screen-reader text. */
export function visualLabels(v: StepVisual): {
  label: string;
  source: string;
  sourceKind: SourceKind;
  alt: string;
} {
  switch (v.kind) {
    case "reference":
      return {
        label: "Your reference",
        source: "Your reference",
        sourceKind: v.evidenceKind === "screenshot" ? "screen" : "photo",
        alt: "Your reference picture for this step",
      };
    case "manual_page":
      return {
        label: `Manual p.${v.page}`,
        source: citationLabel({
          kind: "manual",
          manualId: v.manualId,
          page: v.page,
          figure: v.figure,
        })!,
        sourceKind: "manual",
        alt: `Manual page ${v.page}${v.figure ? `, with ${v.figure}` : ""}`,
      };
    case "latest": {
      const screen = v.evidenceKind === "screenshot";
      return {
        label: screen ? "Last screenshot" : "Last photo",
        source: screen ? "Your last screenshot" : "Your last photo",
        sourceKind: screen ? "screen" : "photo",
        alt: `Your last ${screen ? "screenshot" : "photo"} of this step`,
      };
    }
  }
}

/** Width over height when known. */
export const visualAspect = (v: StepVisual): number | undefined =>
  v.width && v.height ? v.width / v.height : undefined;
