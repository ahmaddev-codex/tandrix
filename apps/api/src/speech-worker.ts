// Tandrix's voice, in a worker thread (see speech.ts): Kokoro's synthesis is CPU-bound and, run on
// the server's own thread, held up every other request while it spoke (a 20 ms profile read took
// 5 s while replies were being voiced). Here it runs beside them. One phrase at a time.
import { totalmem } from "node:os";
import { parentPort } from "node:worker_threads";

export type SpeechRequest =
  { id: number; text: string; voice: string } | { id: number; warm: true };
export type SpeechReply =
  | { id: number; ok: true; samples: Float32Array; rate: number }
  | { id: number; ok: false; error: string };

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
/**
 * Full precision where there's room: 1.3 s a phrase on a laptop CPU, against 2.3 s for the 8-bit
 * model (which spends its time unpacking weights), but about 325 MB to the 8-bit model's 90. A
 * small server (512 MB) keeps the 8-bit model.
 */
const DTYPE = totalmem() >= 2 * 1024 ** 3 ? "fp32" : "q8";

type Kokoro = {
  generate(
    text: string,
    opts: { voice: string },
  ): Promise<{ audio: Float32Array; sampling_rate: number }>;
};

let model: Promise<Kokoro> | undefined;
const load = () =>
  (model ??= import("kokoro-js")
    .then(
      ({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(MODEL, {
          dtype: DTYPE,
          device: "cpu",
        }) as unknown as Promise<Kokoro>,
    )
    .catch((e: unknown) => {
      model = undefined;
      throw e;
    }));

let queue: Promise<unknown> = Promise.resolve();

parentPort?.on("message", (req: SpeechRequest) => {
  queue = queue.then(async () => {
    try {
      const m = await load();
      if ("warm" in req)
        return parentPort!.postMessage({
          id: req.id,
          ok: true,
          samples: new Float32Array(0),
          rate: 0,
        });
      const audio = await m.generate(req.text, { voice: req.voice });
      const reply: SpeechReply = {
        id: req.id,
        ok: true,
        samples: audio.audio,
        rate: audio.sampling_rate,
      };
      parentPort!.postMessage(reply, [audio.audio.buffer as ArrayBuffer]);
    } catch (e) {
      const reply: SpeechReply = { id: req.id, ok: false, error: (e as Error).message };
      parentPort!.postMessage(reply);
    }
  });
});
