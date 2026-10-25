// Judges a check photo against the step with Muse Spark. Model failures become "unavailable" and
// the step stays where it was; the user can try again or confirm it themselves where allowed.
import { checkStep, imageData, MetaApiError, MetaClient, type MetaConfig } from "@tandrix/ai";
import type { CheckResult } from "@tandrix/contracts";

export interface CheckInput {
  jobStepId: string;
  photo: { bytes: Uint8Array; mimeType: string };
  instruction: string;
  expectedState: string;
}

export type CheckOutcome =
  | { status: "judged"; result: CheckResult; reason: string; whatToShowNext?: string }
  | { status: "unavailable"; message: string };

export interface StepChecker {
  check(input: CheckInput): Promise<CheckOutcome>;
}

export const CHECK_UNAVAILABLE = "Tandrix can't check this photo right now. Try again in a minute.";

export function metaStepChecker(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): StepChecker {
  return {
    async check({ photo, instruction, expectedState }) {
      const mime = photo.mimeType === "image/png" ? "image/png" : "image/jpeg";
      try {
        const r = await checkStep(client, config.models, {
          photo: imageData(photo.bytes, mime),
          instruction,
          expectedState,
        });
        if (!r.ok) {
          log({ level: "warn", event: "check_invalid_output", issues: r.issues.length });
          return { status: "unavailable", message: CHECK_UNAVAILABLE };
        }
        return {
          status: "judged",
          result: r.data.result,
          reason: r.data.reason,
          ...(r.data.whatToShowNext ? { whatToShowNext: r.data.whatToShowNext } : {}),
        };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "check_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: CHECK_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelChecker: StepChecker = {
  async check() {
    return { status: "unavailable", message: CHECK_UNAVAILABLE };
  },
};
