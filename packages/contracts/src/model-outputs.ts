// Structured outputs requested from Muse Spark. Model output is untrusted: it refers to things by
// local refs ("P1", step order, box index), never by database IDs; the server maps refs to IDs.
import { z } from "zod";
import { HazardTag, Measurement, PartStatus, CheckResult, Verification } from "./entities";
import { Confidence, StepSurface, optionalText, text } from "./primitives";

const PartRef = z.string().regex(/^P\d{1,3}$/);
const BoxIndex = z.number().int().min(0).max(199);

export const NameplateReading = z.strictObject({
  unreadable: z.boolean(),
  make: optionalText(120),
  model: optionalText(120),
  serial: optionalText(120),
  ratings: z
    .array(z.strictObject({ label: text(60), value: text(60) }))
    .max(20)
    .default([]),
  confidence: Confidence,
});
export type NameplateReading = z.infer<typeof NameplateReading>;

/** Below this confidence a reading is shown as a "Possible match" for the user to check. */
export const NAMEPLATE_CONFIDENT = 0.8;
/** Below this a highlight is labelled "Possible match" and asks the user to confirm it. */
export const HIGHLIGHT_CONFIDENT = 0.7;

/** Manual candidates picked from web search results. URLs are checked against the search hits. */
export const ManualSearchOutput = z.strictObject({
  candidates: z
    .array(
      z.strictObject({
        url: z.url().max(2000),
        title: text(200),
        publisher: optionalText(120),
        /** True when the page is on the manufacturer's own site. */
        official: z.boolean(),
        documentType: z.enum(["installation_manual", "service_manual", "datasheet", "other"]),
        confidence: Confidence,
      }),
    )
    .max(8),
});
export type ManualSearchOutput = z.infer<typeof ManualSearchOutput>;

export const ModelCitation = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("manual"),
    page: z.number().int().min(1).max(5000),
    figure: optionalText(40),
  }),
  z.strictObject({ kind: z.literal("expert_recording"), timestampSec: z.number().min(0) }),
  z.strictObject({ kind: z.literal("generic") }),
]);

export const ProcedureDraft = z.strictObject({
  title: text(160),
  parts: z
    .array(
      z.strictObject({
        ref: PartRef,
        partNumber: optionalText(60),
        name: text(120),
        qty: z.number().int().min(1).max(999),
      }),
    )
    .max(200),
  steps: z
    .array(
      z.strictObject({
        order: z.number().int().min(1).max(500),
        surface: StepSurface,
        title: text(120),
        instruction: text(600),
        reason: optionalText(600),
        partRefs: z.array(PartRef).max(20).default([]),
        caution: optionalText(400),
        hazardTags: z.array(HazardTag).max(7).default([]),
        verification: Verification,
        expectedState: text(600),
        measurement: Measurement.optional(),
        citation: ModelCitation,
      }),
    )
    .min(1)
    .max(500),
});
export type ProcedureDraft = z.infer<typeof ProcedureDraft>;

/** Spark chooses which SAM box (numbered on the frame) is each part in the step. */
export const HighlightPick = z.strictObject({
  picks: z
    .array(
      z.strictObject({
        partRef: PartRef,
        boxIndex: BoxIndex.nullable(),
        confidence: Confidence,
      }),
    )
    .max(20),
  /** Framing advice when a part isn't visible, e.g. "Show the housing from the front". */
  hint: optionalText(200),
});
export type HighlightPick = z.infer<typeof HighlightPick>;

/** A spoken or typed question about the current step, answered in its context. */
export const StepAnswer = z.strictObject({
  /** Two or three short sentences, read aloud. */
  answer: text(600),
  /** True when the answer comes from the step and its manual; false for general knowledge. */
  fromStep: z.boolean(),
  confidence: Confidence,
});
export type StepAnswer = z.infer<typeof StepAnswer>;

export const StepCheckOutput = z.strictObject({
  result: CheckResult,
  reason: text(600),
  whatToShowNext: optionalText(300),
});
export type StepCheckOutput = z.infer<typeof StepCheckOutput>;

export const PartsAssignment = z.strictObject({
  assignments: z
    .array(
      z.strictObject({
        partRef: PartRef,
        status: PartStatus,
        boxIndexes: z.array(BoxIndex).max(999).default([]),
      }),
    )
    .max(200),
});
export type PartsAssignment = z.infer<typeof PartsAssignment>;

/** Text half of a desktop turn; the pointer target comes from the computer-use action. */
export const ScreenReply = z.strictObject({
  say: text(600),
  /** The control's name as shown in the app, used for the caption and accessibility fallback. */
  targetLabel: optionalText(120),
  /** What should change on screen after the user acts; used to verify the screen step. */
  expectedChange: optionalText(300),
  /** True when the target isn't visible and the user must scroll or open something first. */
  targetNotVisible: z.boolean().default(false),
});
export type ScreenReply = z.infer<typeof ScreenReply>;

/** What each part looks like in plain words, for the segmenter when its name finds nothing. */
export const VisualConcepts = z.strictObject({
  concepts: z.array(
    z.strictObject({ ref: z.string().max(20), concept: z.string().min(1).max(60) }),
  ),
});
export type VisualConcepts = z.infer<typeof VisualConcepts>;
