// Judges a check photo (or, for a step done in software, a screenshot) against the step with Muse Spark. Model failures become "unavailable" and
// the step stays where it was; the user can try again or confirm it themselves where allowed.
import { checkStep, imageData, MetaApiError, MetaClient, type MetaConfig } from "@tandrix/ai";
import type { CheckResult } from "@tandrix/contracts";

export interface CheckInput {
  jobStepId: string;
  /** A photo of the work, or a screenshot for a step done in software. */
  medium: "photo" | "screen";
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
export const SCREEN_CHECK_UNAVAILABLE =
  "Tandrix can't check your screen right now. Try again in a minute.";
const unavailable = (medium: CheckInput["medium"]) => ({
  status: "unavailable" as const,
  message: medium === "screen" ? SCREEN_CHECK_UNAVAILABLE : CHECK_UNAVAILABLE,
});

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
    async check({ medium, photo, instruction, expectedState }) {
      const mime = photo.mimeType === "image/png" ? "image/png" : "image/jpeg";
      try {
        const r = await checkStep(client, config.models, {
          photo: imageData(photo.bytes, mime),
          medium,
          instruction,
          expectedState,
        });
        if (!r.ok) {
          log({ level: "warn", event: "check_invalid_output", issues: r.issues.length });
          return unavailable(medium);
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
          return unavailable(medium);
        }
        throw e;
      }
    },
  };
}

export const noModelChecker: StepChecker = {
  async check({ medium }) {
    return unavailable(medium);
  },
};
