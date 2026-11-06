import { describe, expect, it } from "vitest";
import { pcm16, startHearing, usable } from "../src/renderer/lib/hear";

const bridge = (text: string | null, id = 7) => {
  const sent: Array<{ id: number; bytes: number }> = [];
  const log: string[] = [];
  return {
    sent,
    log,
    b: {
      begin: async () => id,
      audio: (i: number, pcm: Uint8Array) => void sent.push({ id: i, bytes: pcm.length }),
      end: async (i: number) => {
        log.push(`end ${i}`);
        return text === null ? null : { text, ms: 40, engine: "analyzer" };
      },
      cancel: async (i: number) => void log.push(`cancel ${i}`),
    },
  };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("hearing a question on the Mac", () => {
  it("turns samples into 16-bit little-endian PCM", () => {
    expect([...pcm16(new Float32Array([0, 1, -1, 2]))]).toEqual([0, 0, 255, 127, 0, 128, 255, 127]);
  });

  it("sends audio in 100 ms pieces as it's recorded, then gives the text", async () => {
    const h = bridge("Open Calendar.");
    const hearing = startHearing(h.b);
    for (let i = 0; i < 25; i++) hearing.push(new Float32Array(128));
    await flush();
    expect(h.sent).toEqual([{ id: 7, bytes: 3328 }]);
    expect(await hearing.end()).toBe("Open Calendar.");
    expect(h.sent.at(-1)).toEqual({ id: 7, bytes: 3072 });
  });

  it("gives null, so the recording is uploaded, when the Mac can't hear or heard nothing", async () => {
    expect(await startHearing(bridge("Open Calendar.", 0).b).end()).toBeNull();
    expect(await startHearing(bridge(null).b).end()).toBeNull();
    expect(await startHearing(bridge("  ").b).end()).toBeNull();
    expect(usable("ok")).toBe("ok");
    expect(usable("…")).toBeNull();
  });

  it("cancels once and sends nothing after", async () => {
    const h = bridge("x");
    const hearing = startHearing(h.b);
    hearing.cancel();
    hearing.push(new Float32Array(4000));
    expect(await hearing.end()).toBeNull();
    await flush();
    expect(h.log).toEqual(["cancel 7"]);
    expect(h.sent).toEqual([]);
  });
});
