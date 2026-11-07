// The question heard on this Mac as it's said (main/hear.ts): its audio goes to the on-device
// recogniser in 100 ms pieces while the user talks, so letting go gives the text at once. When the
// Mac can't hear it, or hears nothing usable, the caller uploads the recording instead.
import type { TandrixBridge } from "../../shared/bridge";

type HearBridge = TandrixBridge["voice"]["hear"];

/** Samples per piece sent: 100 ms at 16 kHz. */
const PIECE = 1600;

/** 16-bit little-endian PCM, as the recogniser takes it. */
export function pcm16(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const v = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return out;
}

/** Text worth asking with: some word in it. Otherwise the server has a go at the recording. */
export function usable(text: string | undefined | null): string | null {
  const t = text?.replace(/\s+/g, " ").trim() ?? "";
  return /\p{L}{2,}|\p{N}/u.test(t) ? t : null;
}

export interface Hearing {
  push(samples: Float32Array): void;
  /** The question's text, or null to upload the recording. */
  end(): Promise<string | null>;
  cancel(): void;
}

export function startHearing(
  bridge: HearBridge = window.tandrix.voice.hear,
  words: string[] = [],
): Hearing {
  const id = bridge.begin(words).catch(() => 0);
  let pieces: Float32Array[] = [];
  let length = 0;
  let over = false;
  const flush = () => {
    if (!length) return;
    const all = new Float32Array(length);
    let at = 0;
    for (const p of pieces) {
      all.set(p, at);
      at += p.length;
    }
    pieces = [];
    length = 0;
    const bytes = pcm16(all);
    // In order: every send waits on the same id.
    void id.then((i) => {
      if (i) bridge.audio(i, bytes);
    });
  };
  return {
    push(samples) {
      if (over) return;
      pieces.push(samples);
      length += samples.length;
      if (length >= PIECE) flush();
    },
    async end() {
      if (over) return null;
      flush();
      over = true;
      const i = await id;
      if (!i) return null;
      const r = await bridge.end(i).catch(() => null);
      return usable(r?.text);
    },
    cancel() {
      if (over) return;
      over = true;
      void id.then((i) => {
        if (i) void bridge.cancel(i).catch(() => undefined);
      });
    },
  };
}
