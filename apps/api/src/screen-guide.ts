// Show me on the Mac: Spark's computer-use tool looks at a screenshot and says what to do and
// where. Model failures become "unavailable"; nothing the model proposes is executed here.
import {
  askScreen,
  imageData,
  MetaApiError,
  MetaClient,
  needsOnlineLookup,
  searchOnlineSolution,
  type MetaConfig,
  onlineNotes,
} from "@tandrix/ai";
import type { DesktopAction, MarkKind } from "@tandrix/contracts";

export interface ScreenQuestionInput {
  screenshot: { bytes: Uint8Array; mimeType: string; width: number; height: number };
  question: string;
  context: string[];
  /** A guided lesson: one step at a time with check-ins. */
  lesson?: boolean;
  /** Explain what's on screen rather than point at a control. */
  explain?: boolean;
}

export type ScreenGuideOutcome =
  | {
      status: "answered";
      reply: string;
      actions: DesktopAction[];
      /** Written beside the annotation; what it frames; each part marked up. */
      note?: string;
      label?: string;
      regions?: Array<{
        label: string;
        detail?: string;
        say?: string;
        point?: { x: number; y: number };
        mark?: MarkKind;
        box: { x: number; y: number; w: number; h: number };
      }>;
      intro?: string;
    }
  | { status: "unavailable"; message: string };

export interface ScreenGuide {
  ask(input: ScreenQuestionInput): Promise<ScreenGuideOutcome>;
}

export const SCREEN_UNAVAILABLE =
  "Tandrix can't look at your screen right now. Try again in a minute.";

export function metaScreenGuide(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
  }),
): ScreenGuide {
  return {
    async ask({ screenshot, question, context, lesson, explain }) {
      const mime = screenshot.mimeType === "image/png" ? "image/png" : "image/jpeg";
      try {
        let enrichedContext = context;
        if (needsOnlineLookup(question)) {
          const online = await searchOnlineSolution(
            client,
            config.models.reasoning,
            question,
          ).catch(() => null);
          if (online?.notes) {
            enrichedContext = [...context, onlineNotes(online.notes)];
          }
        }
        const r = await askScreen(client, config.models.computerUse, {
          screenshot: imageData(screenshot.bytes, mime),
          question,
          context: enrichedContext,
          ...(lesson ? { lesson } : {}),
          ...(explain ? { explain } : {}),
          size: { width: screenshot.width, height: screenshot.height },
        });
        if (r.dropped || r.safetyChecks)
          log({
            level: "warn",
            event: "screen_ask_dropped",
            dropped: r.dropped,
            safetyChecks: r.safetyChecks,
          });
        return {
          status: "answered",
          reply: r.reply,
          actions: r.actions,
          ...(r.note ? { note: r.note } : {}),
          ...(r.label ? { label: r.label } : {}),
          ...(r.regions ? { regions: r.regions } : {}),
          ...(r.intro ? { intro: r.intro } : {}),
        };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "screen_ask_model_error", status: e.status, code: e.code });
          return { status: "unavailable", message: SCREEN_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelScreenGuide: ScreenGuide = {
  async ask() {
    return { status: "unavailable", message: SCREEN_UNAVAILABLE };
  },
};
