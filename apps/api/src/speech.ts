// Tandrix's voice: replies spoken by Kokoro (Apache-2.0, an open 82M-parameter speech model) on
// this server, so the phone and the Mac sound the same and natural. Meta has no speech model. The
// model loads once (warmed at start), syntheses run one at a time, and recent phrases are cached.
// When this can't speak, the apps fall back to a Premium or Enhanced device voice, else text only;
// never a robotic voice.

export interface Speaker {
  /** The reply as a WAV, or null when speech isn't available. */
  speak(text: string): Promise<Uint8Array | null>;
}

export const MAX_SPEAK_CHARS = 600;
/** Kokoro's warmest English voice. */
export const VOICE = "af_heart";
const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const CACHE_ENTRIES = 200;

type Kokoro = {
  generate(
    text: string,
    opts: { voice: string },
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
};

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

export function kokoroSpeaker(log: (l: Record<string, unknown>) => void): Speaker & {
  warm(): void;
} {
  let model: Promise<Kokoro | null> | undefined;
  let readyModel: Kokoro | null = null;
  const load = () =>
    (model ??= import("kokoro-js")
      .then(({ KokoroTTS }) => KokoroTTS.from_pretrained(MODEL, { dtype: "q8", device: "cpu" }))
      .then((m) => {
        readyModel = m as unknown as Kokoro;
        return readyModel;
      })
      .catch((e: Error) => {
        log({ level: "warn", event: "speech_model_unavailable", error: e.message });
        model = undefined; // try again on the next reply
        return null;
      }));

  const cache = new Map<string, Uint8Array>();
  // One synthesis at a time: it's CPU-bound, and replies are short.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    warm() {
      const started = Date.now();
      void load().then(async (m) => {
        if (!m) return;
        log({ event: "speech_model_ready", ms: Date.now() - started });
        // Warm up and pre-cache common wake and completion phrases so they return instantly.
        for (const phrase of [
          "I'm here. What would you like to do?",
          "I'm here. Tell me what you want to do or ask about this step.",
          "Done.",
        ]) {
          try {
            const audio = await m.generate(phrase, { voice: VOICE });
            cache.set(phrase, pcm16Wav(audio.audio, audio.sampling_rate));
          } catch {
            // Ignore pre-warming failure.
          }
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
      const m = await load();
      if (!m) return null;
      const run = queue.then(async () => {
        const started = Date.now();
        const audio = await m.generate(text, { voice: VOICE });
        const wav = pcm16Wav(audio.audio, audio.sampling_rate);
        log({ event: "speech_generated", chars: text.length, ms: Date.now() - started });
        return wav;
      });
      queue = run.catch(() => undefined);
      try {
        const wav = await run;
        if (wav) {
          cache.set(text, wav);
          if (cache.size > CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
        }
        return wav;
      } catch (e) {
        log({ level: "warn", event: "speech_failed", error: (e as Error).message });
        return null;
      }
    },
  };
}

export const noSpeaker: Speaker = {
  async speak() {
    return null;
  },
};
