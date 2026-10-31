// Point the camera (L1): what's in a frame from the phone's live camera, answered aloud, with the
// thing the answer is about outlined. Spark answers and says roughly where; SAM finds the shape
// near there. Without a SAM match, Spark's own box is outlined.
import { LookAnswer } from "@tandrix/contracts";
import type { MetaClient } from "./client";
import { text, user, type InputPart } from "./content";
import type { Models } from "./pipelines";
import { prompts } from "./prompts";
import { maskOutline, normalizeConcept, pixelBox, segment, type Segment } from "./sam";
import { generateStructured } from "./structured";

export interface LookRequest {
  photo: InputPart;
  size: { width: number; height: number };
  question: string;
  /** Equipment, the step in hand, what to call the user. */
  context?: string[];
  signal?: AbortSignal;
}

export interface LookOutcome {
  reply: string;
  highlight: {
    label: string;
    box: { x: number; y: number; w: number; h: number };
    mask: ReturnType<typeof maskOutline>;
  } | null;
  /** Whether SAM found the shape (false: Spark's rough box is used). */
  segmented: boolean;
}

type Box = { x: number; y: number; w: number; h: number };

/** A target this much of the frame is the whole view, not one thing in it. */
const MOST_OF_FRAME = 0.5;

const area = (b: Box) => b.w * b.h;
function overlap(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / (area(a) + area(b) - w * h) : 0;
}

/**
 * The segment that is the thing Spark meant: the one overlapping its rough box most, or whose
 * centre is inside it. Null when none is near.
 */
export function nearest(segments: Segment[], rough: Box): Segment | null {
  let best: Segment | null = null;
  let score = 0;
  for (const s of segments) {
    const cx = s.box.x + s.box.w / 2;
    const cy = s.box.y + s.box.h / 2;
    const inside =
      cx >= rough.x && cx <= rough.x + rough.w && cy >= rough.y && cy <= rough.y + rough.h;
    const v = overlap(s.box, rough) + (inside ? 0.25 : 0) + (s.confidence ?? 0) * 0.1;
    if ((inside || overlap(s.box, rough) > 0.1) && v > score) {
      best = s;
      score = v;
    }
  }
  return best;
}

export async function lookAt(
  client: MetaClient,
  models: Models,
  req: LookRequest,
): Promise<LookOutcome | { ok: false; issues: string[] }> {
  const context = req.context?.filter(Boolean).join("\n");
  const r = await generateStructured(client, {
    model: models.reasoning,
    name: "look",
    schema: LookAnswer,
    instructions: prompts.look,
    input: [
      user(text(`${context ? `${context}\n\n` : ""}The user asks: ${req.question}`), req.photo),
    ],
    // The user is holding the phone up: answer fast, and ask again if this one is slow.
    effort: "minimal",
    hedgeMs: 6000,
    ...(req.signal ? { signal: req.signal } : {}),
  });
  if (!r.ok) return { ok: false, issues: r.issues };
  const { reply, target } = r.data;
  if (!target) return { reply, highlight: null, segmented: false };

  const { width, height } = req.size;
  // About the whole view ("that's a Raspberry Pi"): an outline round everything says nothing.
  if ((target.box.w * target.box.h) / 1_000_000 > MOST_OF_FRAME)
    return { reply, highlight: null, segmented: false };
  const rough = pixelBox(
    {
      x: (target.box.x / 1000) * width,
      y: (target.box.y / 1000) * height,
      w: (target.box.w / 1000) * width,
      h: (target.box.h / 1000) * height,
    },
    req.size,
  );
  let found: Segment | null = null;
  try {
    const { segments } = await segment(client, {
      model: models.segmentation,
      image: req.photo,
      concept: normalizeConcept(target.looksLike),
      ...(req.signal ? { signal: req.signal } : {}),
    });
    found = nearest(segments, rough);
  } catch {
    // The outline helps; the answer stands without it.
  }
  return found
    ? {
        reply,
        highlight: {
          label: target.label,
          box: pixelBox(found.box, req.size),
          mask: maskOutline(found),
        },
        segmented: true,
      }
    : { reply, highlight: { label: target.label, box: rough, mask: null }, segmented: false };
}
