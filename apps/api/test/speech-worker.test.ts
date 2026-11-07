import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { kokoroSpeaker } from "../src/speech";
import type { SpeechRequest } from "../src/speech-worker";

/** A stand-in for the voice's worker thread: answers every phrase with a short tone. */
function fakeWorker(opts: { failLoad?: boolean } = {}) {
  const spoken: string[] = [];
  const w = new EventEmitter() as EventEmitter & { postMessage(r: SpeechRequest): void };
  w.postMessage = (r) => {
    setTimeout(() => {
      if ("warm" in r)
        return w.emit(
          "message",
          opts.failLoad
            ? { id: r.id, ok: false, error: "no model" }
            : { id: r.id, ok: true, samples: new Float32Array(0), rate: 0 },
        );
      spoken.push(r.text);
      w.emit("message", { id: r.id, ok: true, samples: new Float32Array(240), rate: 24000 });
    }, 5);
  };
  return { spawn: () => w as unknown as Worker, spoken };
}

describe("Tandrix's voice, in its own thread", () => {
  it("speaks a phrase once, however many ask for it at the same time", async () => {
    const f = fakeWorker();
    const speaker = kokoroSpeaker(() => {}, f.spawn);
    const [a, b] = await Promise.all([
      speaker.speak("Here's the atlas."),
      speaker.speak("Here's the atlas."),
    ]);
    expect(a).toBe(b);
    expect(a!.length).toBe(44 + 240 * 2);
    expect(f.spoken).toEqual(["Here's the atlas."]);
  });

  it("answers a phrase it has said before from memory", async () => {
    const f = fakeWorker();
    const speaker = kokoroSpeaker(() => {}, f.spawn);
    await speaker.speak("Done.");
    await speaker.speak("Done.");
    expect(f.spoken).toEqual(["Done."]);
  });

  it("goes quiet, not wrong, when the model can't load", async () => {
    const logs: Array<Record<string, unknown>> = [];
    const speaker = kokoroSpeaker((l) => logs.push(l), fakeWorker({ failLoad: true }).spawn);
    expect(await speaker.speak("Hello.")).toBeNull();
    expect(logs.some((l) => l.event === "speech_model_unavailable")).toBe(true);
  });
});
