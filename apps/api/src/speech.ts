// Tandrix's voice: replies spoken by Kokoro (Apache-2.0, an open 82M-parameter speech model) on
// this server, so the phone and the Mac sound the same and natural. Meta has no speech model. The
// model runs in a worker thread (speech-worker.ts), so voicing a reply never holds up the server's
// other requests; it loads once (warmed at start), speaks one phrase at a time, and recent phrases
// are cached.
// When this can't speak, the apps fall back to a Premium or Enhanced device voice, else text only;
// never a robotic voice.
import { Worker } from "node:worker_threads";
import { ASSISTANT_LINES } from "@tandrix/core";
import type { SpeechReply, SpeechRequest } from "./speech-worker";

export interface Speaker {
  /** The reply as a WAV, or null when speech isn't available. */
  speak(text: string): Promise<Uint8Array | null>;
}

export const MAX_SPEAK_CHARS = 600;
/** Kokoro's warmest English voice. */
export const VOICE = "af_heart";
const CACHE_ENTRIES = 200;

/** 16-bit mono PCM WAV: half the size of the model's float output, and plays everywhere. */
export function pcm16Wav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const ascii = (at: number, s: string) =>
    [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  ascii(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return out;
}

export function kokoroSpeaker(
  log: (l: Record<string, unknown>) => void,
  /** The worker the voice runs in (tests pass a stand-in). */
  spawn: () => Worker = defaultSpawn,
): Speaker & {
  warm(): void;
} {
  let worker: Worker | null = null;
  let nextId = 1;
  const waiting = new Map<number, (r: SpeechReply) => void>();
  const fail = (error: string) => {
    for (const done of waiting.values()) done({ id: 0, ok: false, error });
    waiting.clear();
    worker = null;
  };
  const ask = (req: Omit<SpeechRequest, "id">): Promise<SpeechReply> => {
    if (!worker) {
      worker = spawn();
      worker.on("message", (r: SpeechReply) => {
        waiting.get(r.id)?.(r);
        waiting.delete(r.id);
      });
      worker.on("error", (e) => fail(e.message));
      worker.on("exit", (code) => code !== 0 && fail(`exited ${code}`));
    }
    const id = nextId++;
    return new Promise((resolve) => {
      waiting.set(id, resolve);
      worker!.postMessage({ ...req, id } as SpeechRequest);
    });
  };

  let ready = false;
  let attempts = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Loads the model in the worker, retrying in the background (the first load downloads it). */
  const load = async (): Promise<boolean> => {
    if (ready) return true;
    const r = await ask({ warm: true });
    if (r.ok) return (ready = true);
    log({ level: "warn", event: "speech_model_unavailable", error: r.error, attempt: ++attempts });
    clearTimeout(retry);
    retry = setTimeout(() => void load(), Math.min(60_000, 2_000 * 2 ** Math.min(attempts, 5)));
    retry.unref?.();
    return false;
  };

  const cache = new Map<string, Uint8Array>();
  /** A phrase already being spoken: asked for again, it's the same voice, made once. */
  const making = new Map<string, Promise<Uint8Array | null>>();
  const generate = async (text: string): Promise<Uint8Array | null> => {
    const started = Date.now();
    const r = await ask({ text, voice: VOICE });
    if (!r.ok) {
      log({ level: "warn", event: "speech_failed", error: r.error });
      return null;
    }
    const wav = pcm16Wav(r.samples, r.rate);
    log({ event: "speech_generated", chars: text.length, ms: Date.now() - started });
    cache.set(text, wav);
    if (cache.size > CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    return wav;
  };

  return {
    warm() {
      const started = Date.now();
      void load().then(async (ok) => {
        if (!ok) return;
        log({ event: "speech_model_ready", ms: Date.now() - started });
        // Common wake and completion phrases, made now so they come back at once; never ahead of
        // a reply someone is waiting to hear (each waits until no reply is being voiced).
        const idle = async () => {
          while (making.size) await Promise.allSettled([...making.values()]);
        };
        for (const phrase of [
          "I'm here. What would you like to do?",
          "I'm here. Tell me what you want to do or ask about this step.",
          "Done.",
          // The openers Show me's replies start with: voiced first and alone (SP4), so instant.
          "Got it.",
          "Sure thing.",
          "Sure.",
          "Okay.",
          "Let's learn it.",
          ...ASSISTANT_LINES,
        ]) {
          await idle();
          if (!cache.has(phrase)) await generate(phrase);
        }
      });
    },
    async speak(raw) {
      const text = raw.replace(/\s+/g, " ").trim().slice(0, MAX_SPEAK_CHARS);
      if (!text) return null;
      const hit = cache.get(text);
      if (hit) {
        // Most recently used last.
        cache.delete(text);
        cache.set(text, hit);
        return hit;
      }
      const already = making.get(text);
      if (already) return already;
      const made = load().then((ok) => (ok ? generate(text) : null));
      making.set(text, made);
      try {
        return await made;
      } finally {
        making.delete(text);
      }
    },
  };
}

const workerUrl = new URL(
  import.meta.url.endsWith(".ts") ? "./speech-worker.ts" : "./speech-worker.js",
  import.meta.url,
);
const defaultSpawn = () => {
  const w = new Worker(workerUrl);
  // The voice must not keep a CLI or test process alive on its own.
  w.unref();
  return w;
};

export const noSpeaker: Speaker = {
  async speak() {
    return null;
  },
};
