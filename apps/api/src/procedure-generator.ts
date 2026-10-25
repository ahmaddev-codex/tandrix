// Drafts a procedure with Muse Spark from the manual PDF (or generically, without one). Model
// failures become "unavailable" so the app can explain and offer to retry; they never 500.
import {
  fileRef,
  generateProcedure,
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
}

export type GenerateResult =
  { status: "drafted"; draft: ProcedureDraft } | { status: "unavailable"; message: string };

export interface ProcedureGenerator {
  generate(input: GenerateInput): Promise<GenerateResult>;
}

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
    async generate({ asset, task, manual }) {
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

export const noModelGenerator: ProcedureGenerator = {
  async generate() {
    return { status: "unavailable", message: GENERATE_UNAVAILABLE };
  },
};
