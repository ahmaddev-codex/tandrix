// The parts check: SAM finds every object on the photo of the laid-out parts and Spark assigns
// them to the parts list (@tandrix/ai checkParts). Model failures become "unavailable"; nothing is
// blocked on a check that didn't happen.
import {
  checkParts,
  imageData,
  MetaApiError,
  MetaClient,
  pixelBox,
  type MetaConfig,
} from "@tandrix/ai";
import type { Box, PartStatus } from "@tandrix/contracts";

export interface PartsCheckInput {
  photo: { bytes: Uint8Array; mimeType: string };
  size: { width: number; height: number };
  parts: Array<{ id: string; name: string; qty: number }>;
}

export type PartsCheckOutcome =
  | {
      status: "checked";
      results: Array<{
        partSpecId: string;
        status: PartStatus;
        boxes: Array<{ box: Box; confidence: number }>;
      }>;
    }
  | { status: "unavailable"; message: string };

export interface PartsChecker {
  check(input: PartsCheckInput): Promise<PartsCheckOutcome>;
}

export const PARTS_UNAVAILABLE =
  "Tandrix can't check the parts right now. Tick them off against the list instead.";

export function metaPartsChecker(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): PartsChecker {
  return {
    async check({ photo, size, parts }) {
      const mime = photo.mimeType === "image/png" ? "image/png" : "image/jpeg";
      // The model sees short refs, never database ids.
      const refs = parts.map((p, i) => ({ ...p, ref: `P${i + 1}` }));
      try {
        const r = await checkParts(client, config.models, {
          photo: imageData(photo.bytes, mime),
          parts: refs.map((p) => ({ ref: p.ref, name: p.name, qty: p.qty })),
        });
        if (!r.ok) {
          log({ level: "warn", event: "parts_check_invalid_output" });
          return { status: "unavailable", message: PARTS_UNAVAILABLE };
        }
        return {
          status: "checked",
          results: r.data.assignments.map((a) => ({
            partSpecId: refs.find((p) => p.ref === a.partRef)!.id,
            status: a.status,
            boxes: a.boxIndexes
              .map((i) => r.segments[i])
              .filter((s) => s !== undefined)
              .map((s) => ({ box: pixelBox(s.box, size), confidence: s.confidence ?? 0.5 })),
          })),
        };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "parts_check_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: PARTS_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelPartsChecker: PartsChecker = {
  async check() {
    return { status: "unavailable", message: PARTS_UNAVAILABLE };
  },
};
