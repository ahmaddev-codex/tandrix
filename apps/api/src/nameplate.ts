// Reads a nameplate photo with Muse Spark. Any model failure becomes "unavailable" so the app
// falls back to typing the details; it never blocks the job.
import {
  identifyNameplate,
  imageData,
  MetaApiError,
  MetaClient,
  type MetaConfig,
} from "@tandrix/ai";
import type { IdentifyAssetResponse } from "@tandrix/contracts";

export interface NameplateReader {
  read(image: { bytes: Uint8Array; mimeType: string }): Promise<IdentifyAssetResponse>;
}

const unavailable = (message: string): IdentifyAssetResponse => ({
  status: "unavailable",
  reason: "model_unavailable",
  message,
});

export const UNAVAILABLE_MESSAGE =
  "Tandrix can't read the nameplate right now. Type the details instead.";
export const UNREADABLE_MESSAGE =
  "Tandrix couldn't read this nameplate. Type the details, or retake the photo closer and in better light.";

export function metaNameplateReader(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): NameplateReader {
  return {
    async read({ bytes, mimeType }) {
      const mime = mimeType === "image/png" || mimeType === "image/webp" ? mimeType : "image/jpeg";
      try {
        const r = await identifyNameplate(client, config.models, imageData(bytes, mime));
        if (!r.ok) {
          log({ level: "warn", event: "nameplate_invalid_output", issues: r.issues.length });
          return unavailable(UNAVAILABLE_MESSAGE);
        }
        const reading = r.data;
        if (reading.unreadable || !reading.make || !reading.model) {
          return { status: "unavailable", reason: "unreadable", message: UNREADABLE_MESSAGE };
        }
        return { status: "read", reading };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "nameplate_model_error", status: e.status, code: e.code });
          return unavailable(UNAVAILABLE_MESSAGE);
        }
        throw e;
      }
    },
  };
}

/** Used when no Meta key is configured (e.g. local dev without a key). */
export const noModelReader: NameplateReader = {
  async read() {
    return unavailable(UNAVAILABLE_MESSAGE);
  },
};
