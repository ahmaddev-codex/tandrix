// Do it for me on the Mac: Spark's computer-use loop, one turn per request. Model failures
// become "unavailable" and the Mac hands control back; nothing the model proposes runs here. The
// Mac runs each action through the action guard in @tandrix/core.
import {
  continueDoing,
  imageData,
  MetaApiError,
  MetaClient,
  startDoing,
  type DoTurn,
  type MetaConfig,
} from "@tandrix/ai";
import type { SafetyCheck } from "@tandrix/contracts";

export interface Shot {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
}

export type DoOutcome =
  { status: "turn"; turn: DoTurn } | { status: "unavailable"; message: string };

export interface ScreenDoer {
  start(input: { screenshot: Shot; task: string }): Promise<DoOutcome>;
  continue(input: {
    previousResponseId: string;
    callId: string;
    screenshot: Shot;
    acknowledged: SafetyCheck[];
  }): Promise<DoOutcome>;
}

export const DO_UNAVAILABLE =
  "Tandrix can't work on your screen right now. You have control back; try again in a minute.";

const dataUrl = (s: Shot) => `data:${s.mimeType};base64,${Buffer.from(s.bytes).toString("base64")}`;

export function metaScreenDoer(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): ScreenDoer {
  const run = async (f: () => Promise<DoTurn>): Promise<DoOutcome> => {
    try {
      const turn = await f();
      if (turn.dropped) log({ level: "warn", event: "do_actions_dropped", dropped: turn.dropped });
      return { status: "turn", turn };
    } catch (e) {
      if (e instanceof MetaApiError) {
        log({ level: "warn", event: "do_model_error", status: e.status, code: e.code });
        return { status: "unavailable", message: DO_UNAVAILABLE };
      }
      throw e;
    }
  };
  return {
    start: ({ screenshot, task }) =>
      run(() =>
        startDoing(client, config.models.computerUse, {
          screenshot: imageData(screenshot.bytes, screenshot.mimeType),
          task,
        }),
      ),
    continue: ({ previousResponseId, callId, screenshot, acknowledged }) =>
      run(() =>
        continueDoing(client, config.models.computerUse, {
          previousResponseId,
          callId,
          screenshotDataUrl: dataUrl(screenshot),
          acknowledged,
        }),
      ),
  };
}

export const noModelScreenDoer: ScreenDoer = {
  async start() {
    return { status: "unavailable", message: DO_UNAVAILABLE };
  },
  async continue() {
    return { status: "unavailable", message: DO_UNAVAILABLE };
  },
};
