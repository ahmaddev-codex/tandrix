import { describe, expect, it } from "vitest";
import { chunkDb, encodeWav, joinChunks } from "../src/renderer/lib/wav";

const text = (b: Uint8Array, at: number, n: number) =>
  String.fromCharCode(...b.subarray(at, at + n));

describe("encodeWav", () => {
  it("writes a mono 16-bit PCM header the transcription API accepts", () => {
    const wav = encodeWav(new Float32Array(16_000), 16_000);
    const v = new DataView(wav.buffer);
    expect(text(wav, 0, 4)).toBe("RIFF");
    expect(text(wav, 8, 8)).toBe("WAVEfmt ");
    expect(v.getUint16(20, true)).toBe(1);
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(16_000);
    expect(v.getUint32(28, true)).toBe(32_000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(text(wav, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(32_000);
    expect(v.getUint32(4, true)).toBe(wav.length - 8);
  });

  it("scales and clips samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2, -2, 0.5]), 16_000);
    const v = new DataView(wav.buffer);
    const s = (i: number) => v.getInt16(44 + i * 2, true);
    expect([s(0), s(1), s(2), s(3), s(4), s(5)]).toEqual([0, 32767, -32768, 32767, -32768, 16383]);
  });
});

describe("joinChunks", () => {
  it("keeps samples in order", () => {
    expect([
      ...joinChunks([new Float32Array([1, 2]), new Float32Array([]), new Float32Array([3])]),
    ]).toEqual([1, 2, 3]);
  });
});

describe("chunkDb", () => {
  it("is 0 dB at full scale and very low for silence", () => {
    expect(chunkDb(new Float32Array(160).fill(1))).toBeCloseTo(0);
    expect(chunkDb(new Float32Array(160))).toBeLessThan(-100);
  });
  it("puts quiet speech above the room and a hum below it", () => {
    expect(chunkDb(new Float32Array(160).fill(0.05))).toBeGreaterThan(-42);
    expect(chunkDb(new Float32Array(160).fill(0.002))).toBeLessThan(-42);
  });
});
