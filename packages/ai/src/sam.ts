// SAM 3.1 segmentation via the Responses API, parsed with Meta's @meta-sam/parser.
import {
  buildObjectPrompt,
  parseImageStream,
  recordsOfKind,
  ResponsesStreamSourceError,
  type SegmentationMask,
} from "@meta-sam/parser";
import { MetaApiError, type MetaClient } from "./client";
import type { InputPart } from "./content";

export interface Segment {
  objectId: string;
  /** Source-pixel box; x/y top-left, w/h size. */
  box: { x: number; y: number; w: number; h: number };
  confidence: number | null;
  mask: SegmentationMask | null;
}

export interface SegmentResult {
  segments: Segment[];
  /** Parser diagnostics (malformed records). Empty on a clean response. */
  warnings: string[];
}

export interface SegmentRequest {
  model: string;
  image: InputPart;
  /** A short noun phrase naming one concept, e.g. "impeller". */
  concept?: string;
  /** Or box/point prompts on known objects (the image's pixel size is required). */
  objects?: {
    size: { width: number; height: number };
    items: Parameters<typeof buildObjectPrompt>[0]["objects"];
  };
  includeConfidence?: boolean;
  signal?: AbortSignal;
}

export async function segment(client: MetaClient, req: SegmentRequest): Promise<SegmentResult> {
  if (!!req.concept === !!req.objects) throw new Error("Pass exactly one of concept or objects");
  const prompt = req.concept
    ? normalizeConcept(req.concept)
    : buildObjectPrompt({ size: req.objects!.size, objects: req.objects!.items });

  const events = client.stream(
    {
      model: req.model,
      input: [
        {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: prompt }, req.image],
        },
      ],
      metadata: {
        include_confidence: req.includeConfidence === false ? "false" : "true",
        mask_encoding: "one_bit",
      },
    },
    req.signal,
  );
  let result;
  try {
    result = await parseImageStream(events).finalResult;
  } catch (e) {
    // The parser wraps transport failures; surface the API error itself (billing, rate limit…).
    if (e instanceof ResponsesStreamSourceError && e.cause instanceof MetaApiError) throw e.cause;
    throw e;
  }

  const masks = new Map(recordsOfKind(result.records, "mask").map((m) => [m.objectId, m]));
  const segments = recordsOfKind(result.records, "box").map((b) => {
    const m = masks.get(b.objectId);
    return {
      objectId: b.objectId,
      box: { x: b.left, y: b.top, w: b.right - b.left, h: b.bottom - b.top },
      confidence: b.confidence ?? m?.confidence ?? null,
      mask: m?.mask ?? null,
    };
  });
  return { segments, warnings: result.diagnostics.map((d) => `${d.code}: ${d.message}`) };
}

/**
 * SAM matches one concept per request and ignores instructions, so build the prompt from a part
 * name and keep it a short plain noun phrase: "O-ring, 120 mm (part 7)" becomes "o-ring".
 */
export function normalizeConcept(phrase: string): string {
  const cleaned = phrase
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d+(\.\d+)?\s*(mm|cm|m|in|inch|nm|bar|psi|kg|v|kw|hp)\b/gi, " ")
    .replace(/\b(the|a|an|part|no\.?|#)\s*\d*\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!cleaned) throw new Error(`Concept "${phrase}" has no usable words`);
  return cleaned.split(" ").slice(0, 5).join(" ");
}
