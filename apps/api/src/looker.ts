// Point the camera (L1): Spark answers about a frame from the phone's camera and SAM outlines what
// the answer is about (@tandrix/ai lookAt). Model failures become "unavailable"; never stored.
import { imageData, lookAt, MetaApiError, MetaClient, type MetaConfig } from "@tandrix/ai";
import type { LookResponse } from "@tandrix/contracts";

export interface LookInput {
  photo: { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" };
  size: { width: number; height: number };
  question: string;
  context: string[];
}

export interface Looker {
  look(input: LookInput): Promise<Exclude<LookResponse, { status: "refused" }>>;
}

export const LOOK_UNAVAILABLE = "Tandrix can't look right now. Try again in a minute.";

export function metaLooker(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): Looker {
  return {
    async look({ photo, size, question, context }) {
      try {
        const r = await lookAt(client, config.models, {
          photo: imageData(photo.bytes, photo.mimeType),
          size,
          question,
          context,
        });
        if ("ok" in r) {
          log({ level: "warn", event: "look_invalid_output", issues: r.issues.length });
          return { status: "unavailable", message: LOOK_UNAVAILABLE };
        }
        // What happened (never the frame or the words).
        log({ event: "look", highlighted: !!r.highlight, segmented: r.segmented });
        return { status: "answered", reply: r.reply, highlight: r.highlight };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "look_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: LOOK_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelLooker: Looker = {
  async look() {
    return { status: "unavailable", message: LOOK_UNAVAILABLE };
  },
};
