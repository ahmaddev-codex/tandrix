// Drafts a procedure with Muse Spark from the manual PDF (or generically, without one). Model
// failures become "unavailable" so the app can explain and offer to retry; they never 500.
import {
  fileRef,
  generateProcedure,
  stepsFromRecording,
  imageData,
  INLINE_FILE_MAX_BYTES,
  MetaApiError,
  MetaClient,
  pdfData,
  type MetaConfig,
} from "@tandrix/ai";
import type { ProcedureDraft } from "@tandrix/contracts";

export interface GenerateInput {
  /** Null for a project with no equipment: steps come from the task alone. */
  asset: { make: string; model: string } | null;
  task: string;
  manual: { bytes: Uint8Array; pages: number } | null;
  notes?: string;
  /** Photos of where the work stands now. */
  photos?: Array<{ bytes: Uint8Array; mimeType: string }>;
}

export type GenerateResult =
  { status: "drafted"; draft: ProcedureDraft } | { status: "unavailable"; message: string };

export interface RecordingInput {
  asset: { make: string; model: string } | null;
  task: string;
  /** In order: what was said over each photo, and when. */
  moments: Array<{ atSec: number; said: string; photo: { bytes: Uint8Array; mimeType: string } }>;
}

export interface ProcedureGenerator {
  generate(input: GenerateInput): Promise<GenerateResult>;
  /** Record mode: the steps from someone doing the job and saying what they do. */
  fromRecording?(input: RecordingInput): Promise<GenerateResult>;
}

export const RECORDING_INVALID =
  "Tandrix couldn't turn this recording into steps. Try again, or add a moment for each thing you did.";

export const GENERATE_UNAVAILABLE =
  "Tandrix can't write the steps right now. Try again in a minute.";
export const GENERATE_INVALID =
  "Tandrix couldn't turn this manual into steps. Try again, or check the manual is for this equipment.";

/** Files API uploads expire on their own after an hour, even if deleting them fails. */
const UPLOAD_EXPIRY_SEC = 3600;

export function metaProcedureGenerator(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  // Reading a whole manual takes longer than a photo; allow up to 3 minutes per attempt.
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: Math.max(config.timeoutMs, 180_000),
    maxAttempts: 2,
  }),
): ProcedureGenerator {
  return {
    async generate({ asset, task, manual, notes, photos }) {
      let uploadedId: string | null = null;
      try {
        let part;
        if (manual && manual.bytes.length <= INLINE_FILE_MAX_BYTES) {
          part = pdfData(manual.bytes, "manual.pdf");
        } else if (manual) {
          ({ id: uploadedId } = await client.uploadFile(manual.bytes, {
            filename: "manual.pdf",
            mimeType: "application/pdf",
            expiresAfterSec: UPLOAD_EXPIRY_SEC,
          }));
          part = fileRef(uploadedId);
        }
        const r = await generateProcedure(client, config.models, {
          ...(part ? { manual: part, manualPages: manual!.pages } : {}),
          ...(asset ? { asset } : {}),
          job: task,
          ...(notes ? { notes } : {}),
          ...(photos?.length
            ? {
                photos: photos.map((p) =>
                  imageData(p.bytes, p.mimeType === "image/png" ? "image/png" : "image/jpeg"),
                ),
              }
            : {}),
        });
        if (!r.ok) {
          log({ level: "warn", event: "procedure_invalid_output", issues: r.issues.length });
          return { status: "unavailable", message: GENERATE_INVALID };
        }
        if (r.repaired) log({ level: "info", event: "procedure_repaired" });
        return { status: "drafted", draft: r.data };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "procedure_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: GENERATE_UNAVAILABLE };
        }
        throw e;
      } finally {
        // Private manuals shouldn't stay on Meta's side longer than the call needs.
        if (uploadedId) {
          await client
            .deleteFile(uploadedId)
            .catch((e: unknown) =>
              log({ level: "warn", event: "manual_file_delete_failed", error: String(e) }),
            );
        }
      }
    },
  };
}

/** Record mode with Spark: each moment's photo and words, in order. */
export function withRecording(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  base: ProcedureGenerator,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: Math.max(config.timeoutMs, 180_000),
    maxAttempts: 2,
  }),
): ProcedureGenerator {
  return {
    ...base,
    async fromRecording({ asset, task, moments }) {
      try {
        const r = await stepsFromRecording(client, config.models, {
          job: task,
          ...(asset ? { asset } : {}),
          moments: moments.map((m) => ({
            atSec: m.atSec,
            said: m.said,
            photo: imageData(
              m.photo.bytes,
              m.photo.mimeType === "image/png" ? "image/png" : "image/jpeg",
            ),
          })),
        });
        if (!r.ok) {
          log({ level: "warn", event: "recording_invalid_output", issues: r.issues.length });
          return { status: "unavailable", message: RECORDING_INVALID };
        }
        return { status: "drafted", draft: r.data };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "recording_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: GENERATE_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelGenerator: ProcedureGenerator = {
  async generate() {
    return { status: "unavailable", message: GENERATE_UNAVAILABLE };
  },
};
