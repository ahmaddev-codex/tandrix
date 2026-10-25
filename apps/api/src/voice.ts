// Push-to-talk: the phone records one turn as WAV while the talk button is held, and the API
// transcribes it with Muse Voice Transcribe. The Meta key never reaches the phone.
import {
  answerStepQuestion,
  MetaApiError,
  MetaClient,
  wavInfo,
  type MetaConfig,
  type StepQuestion,
} from "@tandrix/ai";
import type { TranscribeResponse } from "@tandrix/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "./auth";
import { HttpError, invalid } from "./errors";

/** One minute of 24 kHz mono 16-bit audio, with room for the header. */
export const MAX_TURN_BYTES = 3 * 1024 * 1024;
export const MAX_TURN_MS = 60_000;

export interface Transcriber {
  transcribe(wav: Uint8Array, keywords: string[]): Promise<TranscribeResponse>;
}

export const HEAR_UNAVAILABLE = "Tandrix can't listen right now. Tap the buttons instead.";
export const HEAR_UNCLEAR = "Tandrix didn't catch that. Hold the button and try again.";

export type StepAnswerResult =
  | { status: "answer"; answer: string; fromStep: boolean }
  | { status: "unavailable"; message: string };

export interface StepAnswerer {
  answer(q: Omit<StepQuestion, "signal">): Promise<StepAnswerResult>;
}

export const ANSWER_UNAVAILABLE =
  "Tandrix can't answer right now. The step and its source are on screen.";

export function metaVoice(
  config: MetaConfig,
  log: (l: Record<string, unknown>) => void,
  client: MetaClient = new MetaClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    timeoutMs: Math.min(config.timeoutMs, 30_000),
  }),
): Transcriber & StepAnswerer {
  return {
    async transcribe(wav, keywords) {
      try {
        const r = await client.transcribe(wav, { model: config.models.transcribe, keywords });
        const transcript = r.transcript.trim();
        return transcript
          ? { status: "heard", transcript, durationMs: r.audioDurationMs }
          : { status: "unclear", message: HEAR_UNCLEAR };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "transcribe_error", status: e.status, code: e.code });
          return { status: "unavailable", message: HEAR_UNAVAILABLE };
        }
        throw e;
      }
    },
    async answer(q) {
      try {
        const r = await answerStepQuestion(client, config.models, q);
        if (!r.ok) {
          log({ level: "warn", event: "step_answer_invalid_output" });
          return { status: "unavailable", message: ANSWER_UNAVAILABLE };
        }
        return { status: "answer", answer: r.data.answer, fromStep: r.data.fromStep };
      } catch (e) {
        if (e instanceof MetaApiError) {
          log({ level: "warn", event: "step_answer_error", status: e.status, code: e.code });
          return { status: "unavailable", message: ANSWER_UNAVAILABLE };
        }
        throw e;
      }
    },
  };
}

export const noModelVoice: Transcriber & StepAnswerer = {
  async transcribe() {
    return { status: "unavailable", message: HEAR_UNAVAILABLE };
  },
  async answer() {
    return { status: "unavailable", message: ANSWER_UNAVAILABLE };
  },
};

const Keywords = z.array(z.string().trim().min(1).max(40)).max(20);

export function voiceRoutes(transcriber: Transcriber) {
  return new Hono<AuthEnv>().post("/transcribe", async (c) => {
    // Refuse oversized bodies before reading them.
    const declared = Number(c.req.header("content-length") ?? 0);
    if (declared > MAX_TURN_BYTES + 64 * 1024) {
      throw new HttpError(
        413,
        "invalid_request",
        "That recording is too long. Keep it under a minute.",
      );
    }
    const body = await c.req.parseBody().catch(() => null);
    const audio = body?.audio;
    if (!(audio instanceof File)) throw invalid(["audio: a WAV recording is required"]);
    if (audio.size > MAX_TURN_BYTES) {
      throw new HttpError(
        413,
        "invalid_request",
        "That recording is too long. Keep it under a minute.",
      );
    }
    const wav = new Uint8Array(await audio.arrayBuffer());
    const check = wavInfo(wav);
    if (!check.ok) throw invalid([`audio: ${check.reason}`]);
    if (check.info.durationMs > MAX_TURN_MS) {
      throw new HttpError(
        413,
        "invalid_request",
        "That recording is too long. Keep it under a minute.",
      );
    }
    // A tap without speech: don't spend a model call on it.
    if (check.info.durationMs < 300) {
      return c.json({ status: "unclear" as const, message: HEAR_UNCLEAR });
    }
    let keywords: string[] = [];
    if (typeof body?.keywords === "string") {
      let raw: unknown;
      try {
        raw = JSON.parse(body.keywords || "[]");
      } catch {
        throw invalid(["keywords: a JSON array of short terms"]);
      }
      const parsed = Keywords.safeParse(raw);
      if (!parsed.success) throw invalid(["keywords: up to 20 short terms"]);
      keywords = parsed.data;
    }
    return c.json(await transcriber.transcribe(wav, keywords));
  });
}
