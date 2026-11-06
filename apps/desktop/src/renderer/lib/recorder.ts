// Records one spoken question from the microphone as a 16 kHz mono WAV, measuring how loud it is
// as it goes so a tapped question ends itself after a pause (the turn rules in @tandrix/core,
// shared with the phone).
import {
  addLevel,
  endedTurn,
  startLevels,
  tappedTurn,
  type TurnLevels,
  type TurnStep,
} from "@tandrix/core";
import workletUrl from "./pcm-capture.worklet.js?url";
import { chunkDb, encodeWav, joinChunks } from "./wav";

export const SAMPLE_RATE = 16_000;
/** A question longer than this is sent as it stands. */
export const MAX_SECONDS = 30;

export interface Recording {
  /** Stops and returns the WAV. */
  stop(): Promise<Uint8Array>;
  /** Stops and throws the audio away. */
  cancel(): void;
  /** From now on the turn ends itself: after a pause once the user has spoken. */
  tap(): void;
  /** How the turn stands if the user ends it now: worth sending, or nothing was said. */
  ended(): Exclude<TurnStep, "listen">;
}

/** `onEnd` fires once when the turn ends by itself: a pause after a tapped question, or the limit. */
/** A chunk's level as 0 (room) to 1 (loud speech), for the presence bar's meter. */
export const meterLevel = (db: number) => Math.max(0, Math.min(1, (db + 60) / 45));
const LEVEL_EVERY_MS = 66;

export async function startRecording(
  onEnd: (step: Exclude<TurnStep, "listen">) => void,
  onLevel?: (level: number) => void,
  /** Each piece of audio as it's recorded, for hearing it on this Mac while the user talks. */
  onSamples?: (samples: Float32Array) => void,
): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  // Chromium resamples the microphone to the context's rate.
  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  try {
    await ctx.audioWorklet.addModule(workletUrl);
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
    throw e;
  }
  const node = new AudioWorkletNode(ctx, "pcm-capture", { numberOfOutputs: 0 });
  const chunks: Float32Array[] = [];
  let samples = 0;
  let levels: TurnLevels = startLevels();
  let tapped = false;
  let done = false;
  const endBy = (step: Exclude<TurnStep, "listen">) => {
    if (done) return;
    done = true;
    onEnd(step);
  };
  let sinceLevel = 0;
  let loudest = -160;
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data);
    samples += e.data.length;
    onSamples?.(e.data);
    const db = chunkDb(e.data);
    const ms = (e.data.length / SAMPLE_RATE) * 1000;
    levels = addLevel(levels, db, ms);
    loudest = Math.max(loudest, db);
    sinceLevel += ms;
    if (onLevel && sinceLevel >= LEVEL_EVERY_MS) {
      onLevel(meterLevel(loudest));
      sinceLevel = 0;
      loudest = -160;
    }
    if (tapped) {
      const step = tappedTurn(levels);
      if (step !== "listen") endBy(step);
    } else if (samples >= SAMPLE_RATE * MAX_SECONDS) endBy(endedTurn(levels));
  };
  ctx.createMediaStreamSource(stream).connect(node);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    node.port.onmessage = null;
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return {
    async stop() {
      close();
      return encodeWav(joinChunks(chunks), SAMPLE_RATE);
    },
    cancel: close,
    tap() {
      tapped = true;
    },
    ended: () => endedTurn(levels),
  };
}
