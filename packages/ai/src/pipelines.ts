// AI pipelines (Architecture §6). Each returns schema-validated output; callers persist and apply
// the deterministic rules in @tandrix/core.
import {
  HighlightPick,
  NameplateReading,
  PartsAssignment,
  ProcedureDraft,
  StepCheckOutput,
} from "@tandrix/contracts";
import type { MetaClient } from "./client";
import { text, user, type InputPart } from "./content";
import { prompts } from "./prompts";
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
  manual: InputPart;
  asset: { make: string; model: string };
  job: string;
  effort?: ReasoningEffort;
}

export function generateProcedure(client: MetaClient, models: Models, req: ProcedureRequest) {
  return generateStructured(client, {
    model: models.reasoning,
    name: "procedure_draft",
    schema: ProcedureDraft,
    instructions: prompts.procedure,
    input: [
      user(text(`Equipment: ${req.asset.make} ${req.asset.model}\nJob: ${req.job}`), req.manual),
    ],
    effort: req.effort ?? "medium",
  });
}

export interface StepCheckRequest {
  photo: InputPart;
  reference?: InputPart;
  instruction: string;
  expectedState: string;
}

export function checkStep(client: MetaClient, models: Models, req: StepCheckRequest) {
  const parts: InputPart[] = [
    text(
      `Step: ${req.instruction}\nExpected state: ${req.expectedState}\nThe first image is the check photo.`,
    ),
    req.photo,
  ];
  if (req.reference)
    parts.push(text("The next image is the reference for a correct result."), req.reference);
  return generateStructured(client, {
    model: models.reasoning,
    name: "step_check",
    schema: StepCheckOutput,
    instructions: prompts.check,
    input: [user(...parts)],
    effort: "medium",
  });
}

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
export async function highlightParts(
  client: MetaClient,
  models: Models,
  req: HighlightRequest,
): Promise<HighlightOutcome | { ok: false; issues: string[] }> {
  const fast = req.fastPathConfidence ?? 0.75;
  const byRef = new Map<string, Candidate[]>();
  const all: Candidate[] = [];
  for (const part of req.parts) {
    const concept = normalizeConcept(part.name);
    const { segments } = await segment(client, {
      model: models.segmentation,
      image: req.photo,
      concept,
    });
    const cands = segments.map((s) => ({ ...s, concept, index: all.length + segments.indexOf(s) }));
    all.push(...cands);
    byRef.set(part.ref, cands);
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
}

export async function checkParts(client: MetaClient, models: Models, req: PartsCheckRequest) {
  const { segments } = await segment(client, {
    model: models.segmentation,
    image: req.photo,
    concept: req.concept ?? "mechanical part",
  });
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
    effort: "medium",
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
