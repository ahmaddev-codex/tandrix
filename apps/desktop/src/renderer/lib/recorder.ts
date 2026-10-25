// Records one spoken question from the microphone as a 16 kHz mono WAV.
import workletUrl from "./pcm-capture.worklet.js?url";
import { encodeWav, joinChunks } from "./wav";

export const SAMPLE_RATE = 16_000;
/** A question longer than this is sent as it stands. */
export const MAX_SECONDS = 30;

export interface Recording {
  /** Stops and returns the WAV. */
  stop(): Promise<Uint8Array>;
  /** Stops and throws the audio away. */
  cancel(): void;
}

export async function startRecording(onLimit: () => void): Promise<Recording> {
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
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data);
    samples += e.data.length;
    if (samples >= SAMPLE_RATE * MAX_SECONDS) onLimit();
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
  };
}
