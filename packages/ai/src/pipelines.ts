// AI pipelines (Architecture §6). Each returns schema-validated output; callers persist and apply
// the deterministic rules in @tandrix/core.
import {
  HighlightPick,
  NameplateReading,
  PartsAssignment,
  ProcedureDraft,
  StepAnswer,
  StepCheckOutput,
  VisualConcepts,
} from "@tandrix/contracts";
import type { MetaClient } from "./client";
import { text, user, type InputPart } from "./content";
import { calledLine, prompts } from "./prompts";
import { normalizeConcept, segment, type Segment } from "./sam";
import { generateStructured, type ReasoningEffort } from "./structured";

export interface Models {
  reasoning: string;
  segmentation: string;
}

export function identifyNameplate(client: MetaClient, models: Models, photo: InputPart) {
  return generateStructured(client, {
    model: models.reasoning,
    name: "nameplate_reading",
    schema: NameplateReading,
    instructions: prompts.nameplate,
    input: [user(text("Read this nameplate."), photo)],
    effort: "low",
  });
}

export interface ProcedureRequest {
  /** The manual PDF (inline or a Files API id). Omit for a generic procedure. */
  manual?: InputPart;
  /** Pages in the manual, so the model knows which page numbers exist. */
  manualPages?: number;
  /** The equipment, when the job has any; a project without equipment works from the job alone. */
  asset?: { make: string; model: string };
  job: string;
  /** What the user added about their situation, in their words. */
  notes?: string;
  /** Photos of where the work stands now (what's there, what's done), up to four. */
  photos?: InputPart[];
  effort?: ReasoningEffort;
  signal?: AbortSignal;
}

export function generateProcedure(client: MetaClient, models: Models, req: ProcedureRequest) {
  const about = `${
    req.asset
      ? `Equipment: ${req.asset.make} ${req.asset.model}\nJob: ${req.job}`
      : `Project (no specific equipment): ${req.job}`
  }${req.notes ? `\nThe user adds: ${req.notes}` : ""}`;
  // The user's photos come last, after the manual, with what they are.
  const photos: InputPart[] = req.photos?.length
    ? [
        text(
          `The next ${req.photos.length === 1 ? "photo shows" : `${req.photos.length} photos show`} where the work stands now. Use them to fit the steps to what the user has: start from where they are, and name the parts as they appear. Don't write steps for work the photos show is already done.`,
        ),
        ...req.photos,
      ]
    : [];
  return generateStructured(client, {
    model: models.reasoning,
    name: "procedure_draft",
    schema: ProcedureDraft,
    instructions: req.manual ? prompts.procedure : prompts.procedureGeneric,
    input: [
      req.manual
        ? user(
            text(
              `${about}${req.manualPages ? `\nThe manual has ${req.manualPages} pages; cite page numbers as printed in the PDF viewer (1 to ${req.manualPages}).` : ""}`,
            ),
            req.manual,
            ...photos,
          )
        : user(text(`${about}\nNo manual is available.`), ...photos),
    ],
    effort: req.effort ?? "medium",
    ...(req.signal ? { signal: req.signal } : {}),
  });
}

export interface StepQuestion {
  step: {
    title: string;
    instruction: string;
    reason?: string;
    caution?: string;
    parts: string[];
    hazards: string[];
  };
  equipment?: string;
  /** What Tandrix calls the user; used rarely, never in every reply. */
  userName?: string;
  /** The procedure's other steps, so an answer can point to the step that covers the question. */
  otherSteps?: Array<{ order: number; title: string; instruction: string }>;
  question: string;
  /** "I'm stuck": ask for the next physical thing to do. */
  stuck?: boolean;
  signal?: AbortSignal;
}

export function answerStepQuestion(client: MetaClient, models: Models, q: StepQuestion) {
  const s = q.step;
  const context = [
    q.equipment ? `Equipment: ${q.equipment}` : "",
    q.userName ? calledLine(q.userName) : "",
    `Step: ${s.title}`,
    `Instruction: ${s.instruction}`,
    s.reason ? `Why: ${s.reason}` : "",
    s.caution ? `Caution: ${s.caution}` : "",
    s.parts.length ? `Parts: ${s.parts.join(", ")}` : "",
    s.hazards.length ? `Hazards: ${s.hazards.join(", ")}` : "",
    q.otherSteps?.length
      ? `Other steps in this job:\n${q.otherSteps.map((o) => `${o.order}. ${o.title}: ${o.instruction}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  return generateStructured(client, {
    model: models.reasoning,
    name: "step_answer",
    schema: StepAnswer,
    instructions: prompts.stepChat,
    input: [
      user(
        text(
          `${context}\n\n${q.stuck ? "The user says they are stuck." : "The user asks:"} ${q.question}`,
        ),
      ),
    ],
    effort: "low",
    hedgeMs: INTERACTIVE_HEDGE_MS,
    ...(q.signal ? { signal: q.signal } : {}),
  });
}

export interface StepCheckRequest {
  /** The check image: a photo of the work, or a screenshot for a step done in software. */
  photo: InputPart;
  /** Defaults to "photo". */
  medium?: "photo" | "screen";
  reference?: InputPart;
  /** What the reference is: the user's own picture of a correct result (default), or the manual page the step cites. */
  referenceKind?: "reference" | "manual_page";
  instruction: string;
  expectedState: string;
  effort?: ReasoningEffort;
}

export function checkStep(client: MetaClient, models: Models, req: StepCheckRequest) {
  const screen = req.medium === "screen";
  const parts: InputPart[] = [
    text(
      `Step: ${req.instruction}\nExpected state: ${req.expectedState}\nThe first image is the ${screen ? "screenshot taken after the user acted" : "check photo"}.`,
    ),
    req.photo,
  ];
  if (req.reference)
    parts.push(
      text(
        req.referenceKind === "manual_page"
          ? "The next image is the manual page this step comes from. Use its figures and text for how a correct result looks; it is not the user's work."
          : "The next image is the user's reference for a correct result; it is not the work being checked.",
      ),
      req.reference,
    );
  return generateStructured(client, {
    model: models.reasoning,
    name: "step_check",
    schema: StepCheckOutput,
    instructions: screen ? prompts.checkScreen : prompts.check,
    input: [user(...parts)],
    effort: req.effort ?? "low",
    hedgeMs: INTERACTIVE_HEDGE_MS,
  });
}

/** Calls someone is waiting on (an answer, a check, highlights) are asked again after this long. */
const INTERACTIVE_HEDGE_MS = 8000;

export interface Candidate extends Segment {
  index: number;
  concept: string;
}

export interface HighlightRequest {
  photo: InputPart;
  size: { width: number; height: number };
  instruction: string;
  parts: Array<{ ref: string; name: string }>;
  /** Pick without Spark when a part has one candidate at or above this confidence. */
  fastPathConfidence?: number;
}

export interface HighlightOutcome {
  picks: Array<{ ref: string; candidate: Candidate | null; confidence: number }>;
  hint?: string;
  usedReasoning: boolean;
}

/** SAM per part name, then Spark picks among candidates unless every part is unambiguous. */
/**
 * What each part looks like in plain words, for the segmenter: names like "Raspberry Pi 5" or
 * "Active Cooler" mean nothing to it, "circuit board" does. One small text-only call.
 */
export async function visualConceptsFor(
  client: MetaClient,
  models: Models,
  instruction: string,
  parts: Array<{ ref: string; name: string }>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!parts.length) return out;
  const r = await generateStructured(client, {
    model: models.reasoning,
    name: "visual_concepts",
    schema: VisualConcepts,
    instructions: prompts.visualConcepts,
    input: [
      user(
        text(`Job: ${instruction}\nParts:\n${parts.map((p) => `${p.ref}: ${p.name}`).join("\n")}`),
      ),
    ],
    effort: "low",
  });
  if (!r.ok) return out;
  for (const { ref, concept } of r.data.concepts) {
    if (!parts.some((p) => p.ref === ref)) continue;
    try {
      out.set(ref, normalizeConcept(concept));
    } catch {
      // A description with no usable words is skipped.
    }
  }
  return out;
}

export async function highlightParts(
  client: MetaClient,
  models: Models,
  req: HighlightRequest,
): Promise<HighlightOutcome | { ok: false; issues: string[] }> {
  const fast = req.fastPathConfidence ?? 0.75;
  const byRef = new Map<string, Candidate[]>();
  const all: Candidate[] = [];
  const firstPass = await Promise.all(
    req.parts.map(async (part) => {
      const concept = normalizeConcept(part.name);
      const { segments } = await segment(client, {
        model: models.segmentation,
        image: req.photo,
        concept,
      });
      return { ref: part.ref, concept, segments };
    }),
  );
  for (const { ref, concept, segments } of firstPass) {
    const cands = segments.map((s, i) => ({ ...s, concept, index: all.length + i }));
    all.push(...cands);
    byRef.set(ref, cands);
  }

  // Names like "Raspberry Pi 5" or "Active Cooler" mean nothing to the segmenter. For parts their
  // name didn't find, ask once for what each looks like ("circuit board"), and look again.
  const unfound = req.parts.filter((p) => !byRef.get(p.ref)!.length);
  if (unfound.length) {
    const looks = await visualConceptsFor(client, models, req.instruction, unfound);
    const secondPass = await Promise.all(
      [...looks.entries()].map(async ([ref, concept]) => {
        const { segments } = await segment(client, {
          model: models.segmentation,
          image: req.photo,
          concept,
        });
        return { ref, concept, segments };
      }),
    );
    for (const { ref, concept, segments } of secondPass) {
      const cands = segments.map((s, i) => ({ ...s, concept, index: all.length + i }));
      all.push(...cands);
      byRef.set(ref, cands);
    }
  }

  const unambiguous = req.parts.every((p) => {
    const c = byRef.get(p.ref)!;
    return c.length === 1 && (c[0]!.confidence ?? 0) >= fast;
  });
  if (unambiguous) {
    return {
      picks: req.parts.map((p) => {
        const c = byRef.get(p.ref)![0]!;
        return { ref: p.ref, candidate: c, confidence: c.confidence ?? 0 };
      }),
      usedReasoning: false,
    };
  }

  const list = all.length
    ? all
        .map(
          (c) =>
            `Box ${c.index}: x=${c.box.x} y=${c.box.y} w=${c.box.w} h=${c.box.h}, found as "${c.concept}"${c.confidence !== null ? `, confidence ${c.confidence.toFixed(2)}` : ""}`,
        )
        .join("\n")
    : "No candidate boxes were found.";
  const r = await generateStructured(client, {
    model: models.reasoning,
    name: "highlight_pick",
    hedgeMs: INTERACTIVE_HEDGE_MS,
    schema: HighlightPick,
    instructions: prompts.highlight,
    input: [
      user(
        text(
          `Step: ${req.instruction}\nImage size: ${req.size.width}x${req.size.height}\nParts:\n${req.parts.map((p) => `${p.ref}: ${p.name}`).join("\n")}\nCandidates:\n${list}`,
        ),
        req.photo,
      ),
    ],
    effort: "low",
  });
  if (!r.ok) return { ok: false, issues: r.issues };

  const byIndex = new Map(all.map((c) => [c.index, c]));
  const known = new Set(req.parts.map((p) => p.ref));
  return {
    // Drop picks for refs that weren't asked for, and indexes that don't exist.
    picks: r.data.picks
      .filter((p) => known.has(p.partRef))
      .map((p) => ({
        ref: p.partRef,
        candidate: p.boxIndex !== null ? (byIndex.get(p.boxIndex) ?? null) : null,
        confidence: p.confidence,
      })),
    ...(r.data.hint ? { hint: r.data.hint } : {}),
    usedReasoning: true,
  };
}

export interface PartsCheckRequest {
  photo: InputPart;
  parts: Array<{ ref: string; name: string; qty: number }>;
  /** Generic concept used to find every object on the tarp. */
  concept?: string;
  effort?: ReasoningEffort;
}

/** Most distinct descriptions a parts check segments for, to bound cost on long parts lists. */
const MAX_PART_CONCEPTS = 8;

const overlap = (a: Segment["box"], b: Segment["box"]) => {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = w * h;
  return inter / (a.w * a.h + b.w * b.h - inter);
};

export async function checkParts(client: MetaClient, models: Models, req: PartsCheckRequest) {
  // A generic word ("object", "mechanical part") finds nothing; look for each kind of part on
  // the list by what it looks like, and merge what's found.
  const concepts = req.concept
    ? [req.concept]
    : [
        ...new Set(
          (
            await visualConceptsFor(client, models, "Lay out the parts for a job", req.parts)
          ).values(),
        ),
      ].slice(0, MAX_PART_CONCEPTS);
  const segments: Segment[] = [];
  const foundResults = await Promise.all(
    concepts.map((concept) =>
      segment(client, { model: models.segmentation, image: req.photo, concept }),
    ),
  );
  for (const found of foundResults) {
    for (const seg of found.segments) {
      const same = segments.findIndex((x) => overlap(x.box, seg.box) > 0.7);
      if (same < 0) segments.push(seg);
      else if ((seg.confidence ?? 0) > (segments[same]!.confidence ?? 0)) segments[same] = seg;
    }
  }
  const list = segments
    .map((s, i) => `Box ${i}: x=${s.box.x} y=${s.box.y} w=${s.box.w} h=${s.box.h}`)
    .join("\n");
  const r = await generateStructured(client, {
    model: models.reasoning,
    name: "parts_assignment",
    schema: PartsAssignment,
    instructions: prompts.parts,
    input: [
      user(
        text(
          `Parts list:\n${req.parts.map((p) => `${p.ref}: ${p.name} x${p.qty}`).join("\n")}\nCandidates:\n${list || "No boxes found."}`,
        ),
        req.photo,
      ),
    ],
    effort: req.effort ?? "low",
  });
  if (!r.ok) return r;
  // Every listed part exactly once: unknown refs dropped, unreported parts count as missing.
  const reported = new Map(
    r.data.assignments
      .filter((a) => req.parts.some((p) => p.ref === a.partRef))
      .map((a) => [a.partRef, a]),
  );
  const assignments = req.parts.map(
    (p) => reported.get(p.ref) ?? { partRef: p.ref, status: "missing" as const, boxIndexes: [] },
  );
  return {
    ...r,
    data: {
      assignments: assignments.map((a) => ({
        ...a,
        boxIndexes: a.boxIndexes.filter((i) => i < segments.length),
      })),
    },
    segments,
  };
}
