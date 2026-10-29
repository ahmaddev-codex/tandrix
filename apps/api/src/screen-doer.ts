// Do it for me on the Mac: Spark's computer-use loop, one turn per request. Model failures
// become "unavailable" and the Mac hands control back; nothing the model proposes runs here. The
// Mac runs each action through the action guard in @tandrix/core.
import {
  continueDoing,
  imageData,
  MetaApiError,
  MetaClient,
  needsOnlineLookup,
  planTask,
  searchOnlineSolution,
  startDoing,
  type DoTurn,
  type MetaConfig,
  onlineNotes,
} from "@tandrix/ai";
import type { SafetyCheck } from "@tandrix/contracts";

export interface Shot {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
}

export type DoOutcome =
  { status: "turn"; turn: DoTurn } | { status: "unavailable"; message: string };

export interface ScreenDoer {
  /** Which installed app the task needs, if not the one in front; null on any failure. */
  plan(input: { task: string; frontApp?: string; apps: string[] }): Promise<string | null>;
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
    async plan({ task, frontApp, apps }) {
      if (!apps.length) return null;
      const lower = task.toLowerCase();
      const byLength = [...apps].sort((a, b) => b.length - a.length);
      const named = byLength.find((a) => a.length >= 3 && lower.includes(a.toLowerCase()));
      if (named) {
        if (frontApp && named.toLowerCase() === frontApp.toLowerCase()) return null;
        if (/\b(open|launch|switch to|go to|in)\b/i.test(task)) return named;
      }
      try {
        const r = await planTask(client, config.models, {
          task,
          apps,
          ...(frontApp ? { frontApp } : {}),
        });
        return r.ok ? r.data.openApp : null;
      } catch (e) {
        if (e instanceof MetaApiError) return null;
        throw e;
      }
    },
    start: ({ screenshot, task }) =>
      run(async () => {
        let context: string[] | undefined;
        if (needsOnlineLookup(task)) {
          const online = await searchOnlineSolution(client, config.models.reasoning, task).catch(
            () => null,
          );
          if (online?.notes) context = [onlineNotes(online.notes)];
        }
        return startDoing(client, config.models.computerUse, {
          screenshot: imageData(screenshot.bytes, screenshot.mimeType),
          task,
          ...(context ? { context } : {}),
        });
      }),
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
  async plan() {
    return null;
  },
  async start() {
    return { status: "unavailable", message: DO_UNAVAILABLE };
  },
  async continue() {
    return { status: "unavailable", message: DO_UNAVAILABLE };
  },
};
