// Rules applied to a model-drafted procedure before it is saved. The model proposes; these make
// sure nothing unverifiable is presented as cited, and every safety rule still applies.
import type { ProcedureDraft } from "@tandrix/contracts";
import { hazardTagsForStep } from "./safety";

export interface DraftContext {
  /** Pages in the manual the draft was made from; null when there was no manual (generic). */
  manualPages: number | null;
  /** Seconds in the expert recording the draft was made from; absent when there was none. */
  recordingSec?: number;
}

export type DraftFix =
  | { kind: "citation_out_of_range"; order: number; page: number }
  | { kind: "citation_without_manual"; order: number }
  | { kind: "citation_outside_recording"; order: number; timestampSec: number }
  | { kind: "unknown_part_ref"; order: number; ref: string }
  | { kind: "measurement_missing"; order: number }
  | { kind: "hazards_added"; order: number; tags: string[] }
  | { kind: "duplicate_part_ref"; ref: string };

export interface NormalizedDraft {
  draft: ProcedureDraft;
  fixes: DraftFix[];
  /** Steps with a source (the manual or the recording); the rest are labelled Generic. */
  citedSteps: number;
}

export function normalizeDraft(input: ProcedureDraft, ctx: DraftContext): NormalizedDraft {
  const fixes: DraftFix[] = [];

  // Parts: first occurrence of each ref wins.
  const seen = new Set<string>();
  const parts = input.parts.filter((p) => {
    if (seen.has(p.ref)) {
      fixes.push({ kind: "duplicate_part_ref", ref: p.ref });
      return false;
    }
    seen.add(p.ref);
    return true;
  });

  // Steps in the model's order, renumbered 1..n so order is unique and gap-free.
  const ordered = [...input.steps].sort((a, b) => a.order - b.order);
  const steps = ordered.map((s, i) => {
    const order = i + 1;
    let citation = s.citation;
    if (citation.kind === "manual" && ctx.manualPages === null) {
      fixes.push({ kind: "citation_without_manual", order });
      citation = { kind: "generic" };
    } else if (citation.kind === "manual" && citation.page > ctx.manualPages!) {
      // A page the manual doesn't have: never show it as cited.
      fixes.push({ kind: "citation_out_of_range", order, page: citation.page });
      citation = { kind: "generic" };
    } else if (citation.kind === "expert_recording") {
      // Only a draft made from a recording may cite one, and only a moment inside it.
      if (ctx.recordingSec === undefined) citation = { kind: "generic" };
      else if (citation.timestampSec > ctx.recordingSec) {
        fixes.push({
          kind: "citation_outside_recording",
          order,
          timestampSec: citation.timestampSec,
        });
        citation = { kind: "generic" };
      }
    }

    const partRefs = [...new Set(s.partRefs)].filter((ref) => {
      if (seen.has(ref)) return true;
      fixes.push({ kind: "unknown_part_ref", order, ref });
      return false;
    });

    let verification = s.verification;
    if (verification === "measurement" && !s.measurement) {
      fixes.push({ kind: "measurement_missing", order });
      verification = "user_confirm";
    }

    const hazardTags = hazardTagsForStep(s);
    const added = hazardTags.filter((t) => !s.hazardTags.includes(t));
    if (added.length) fixes.push({ kind: "hazards_added", order, tags: added });

    // A measurement only belongs on a step verified by measuring.
    const { measurement, ...rest } = s;
    return {
      ...rest,
      order,
      citation,
      partRefs,
      verification,
      hazardTags,
      ...(verification === "measurement" && measurement ? { measurement } : {}),
    };
  });

  return {
    draft: {
      title: input.title,
      parts,
      steps,
    },
    fixes,
    citedSteps: steps.filter((s) => s.citation.kind !== "generic").length,
  };
}
