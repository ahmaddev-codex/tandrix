// POST /voice/speak: Tandrix's spoken voice, or 204 so the app uses a natural device voice.
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../src/auth";
import { HttpError } from "../src/errors";
import { rateLimiter } from "../src/rate-limit";
import type { Speaker } from "../src/speech";
import { noModelVoice } from "../src/voice";
import { voiceRoutes } from "../src/voice";

const WAV = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

function app(speaker: Speaker | undefined, limit = 20) {
  const spoken: string[] = [];
  const s: Speaker | undefined = speaker && {
    async speak(text) {
      spoken.push(text);
      return speaker.speak(text);
    },
  };
  const a = new Hono<AuthEnv>();
  a.use(async (c, next) => {
    c.set("user", { id: "u1" } as never);
    await next();
  });
  a.route("/voice", voiceRoutes(noModelVoice, s, rateLimiter(limit, 60_000)));
  a.onError((e, c) => c.json({ error: e.message }, e instanceof HttpError ? e.status : 500));
  const say = (body: unknown) =>
    a.request("/voice/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  return { say, spoken };
}

describe("POST /voice/speak", () => {
  it("returns the reply as a WAV", async () => {
    const s = app({ speak: async () => WAV });
    const res = await s.say({ text: "  Click   Export.  " });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(WAV);
    expect(s.spoken).toEqual(["Click   Export."]);
  });

  it("says 204 when speech isn't available, so the app falls back", async () => {
    expect((await app({ speak: async () => null }).say({ text: "Hi" })).status).toBe(204);
    expect((await app(undefined).say({ text: "Hi" })).status).toBe(204);
  });

  it("refuses empty or overlong text", async () => {
    const s = app({ speak: async () => WAV });
    expect((await s.say({ text: "   " })).status).toBe(400);
    expect((await s.say({ text: "x".repeat(601) })).status).toBe(400);
    expect((await s.say({})).status).toBe(400);
  });

  it("limits how many replies one user can have spoken a minute", async () => {
    const s = app({ speak: async () => WAV }, 2);
    expect((await s.say({ text: "One" })).status).toBe(200);
    expect((await s.say({ text: "Two" })).status).toBe(200);
    expect((await s.say({ text: "Three" })).status).toBe(429);
  });
});

describe("pcm16Wav", () => {
  it("writes a 16-bit mono WAV header and clamps samples", async () => {
    const { pcm16Wav } = await import("../src/speech");
    const wav = pcm16Wav(new Float32Array([0, 1, -1, 2]), 24000);
    const v = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.subarray(0, 4))).toBe("RIFF");
    expect(v.getUint16(22, true)).toBe(1);
    expect(v.getUint32(24, true)).toBe(24000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8);
    expect([0, 1, 2, 3].map((i) => v.getInt16(44 + i * 2, true))).toEqual([
      0, 32767, -32768, 32767,
    ]);
  });
});
