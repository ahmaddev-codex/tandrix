// Finds a step's parts in a photo: SAM per part name, Spark to disambiguate (@tandrix/ai
// highlightParts). Model failures become "unavailable", and the app falls back to a numbered
// parts list; they never block the step.
import {
  highlightParts,
  imageData,
  maskOutline,
  MetaApiError,
  MetaClient,
  pixelBox,
  type MetaConfig,
} from "@tandrix/ai";
import type { Box, MaskOutline } from "@tandrix/contracts";

export interface HighlightInput {
  photo: { bytes: Uint8Array; mimeType: string };
  size: { width: number; height: number };
  instruction: string;
  parts: Array<{ id: string; name: string }>;
}

export interface HighlightPick {
  partSpecId: string;
  box: Box;
  mask: MaskOutline | null;
  confidence: number;
}

export type HighlightResult =
  | { status: "found"; picks: HighlightPick[]; hint?: string }
  | { status: "unavailable"; message: string };

export interface Highlighter {
  find(input: HighlightInput): Promise<HighlightResult>;
}

export const HIGHLIGHT_UNAVAILABLE =
  "Tandrix can't highlight the parts right now. Use the parts list below.";

export function metaHighlighter(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): Highlighter {
  return {
    async find({ photo, size, instruction, parts }) {
      const mime = photo.mimeType === "image/png" ? "image/png" : "image/jpeg";
      // The model sees short refs, never database ids.
      const refs = parts.map((p, i) => ({ ref: `P${i + 1}`, ...p }));
      try {
        const r = await highlightParts(client, config.models, {
          photo: imageData(photo.bytes, mime),
          size,
          instruction,
          parts: refs.map((p) => ({ ref: p.ref, name: p.name })),
        });
        if ("ok" in r) {
          log({ level: "warn", event: "highlight_invalid_output", issues: r.issues.length });
          return { status: "unavailable", message: HIGHLIGHT_UNAVAILABLE };
        }
        const picks: HighlightPick[] = [];
        for (const p of r.picks) {
          const part = refs.find((x) => x.ref === p.ref);
          if (!part || !p.candidate) continue;
          picks.push({
            partSpecId: part.id,
            box: pixelBox(p.candidate.box, size),
            mask: maskOutline(p.candidate),
            confidence: p.confidence,
          });
        }
        return { status: "found", picks, ...(r.hint ? { hint: r.hint } : {}) };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "highlight_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: HIGHLIGHT_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelHighlighter: Highlighter = {
  async find() {
    return { status: "unavailable", message: HIGHLIGHT_UNAVAILABLE };
  },
};
