import { describe, expect, it } from "vitest";
import { answerStepQuestion, MetaClient, prompts, wavInfo } from "../src";
import { json, makeWav, noSleep, responseWithText, scriptedFetch } from "./helpers";

describe("wavInfo", () => {
  it("reads a mono 16-bit WAV, skipping chunks before the audio", () => {
    expect(wavInfo(makeWav({ ms: 1500 }))).toEqual({
      ok: true,
      info: { sampleRate: 16000, channels: 1, bitsPerSample: 16, durationMs: 1500 },
    });
    expect(wavInfo(makeWav({ sampleRate: 24000, extraChunk: false }))).toMatchObject({ ok: true });
  });

  it.each([
    [{ channels: 2 }, "mono"],
    [{ bits: 8 }, "16-bit"],
    [{ sampleRate: 44100 }, "16 or 24 kHz"],
    [{ format: 3 }, "plain PCM"],
  ])("refuses %j", (opts, reason) => {
    expect(wavInfo(makeWav(opts))).toEqual({ ok: false, reason: expect.stringContaining(reason) });
  });

  it("refuses something that isn't a WAV", () => {
    expect(
      wavInfo(new TextEncoder().encode("ID3 not a wav at all, an mp3 header and more bytes")),
    ).toMatchObject({
      ok: false,
    });
  });
});

describe("MetaClient.transcribe", () => {
  it("posts the request settings and the clip as multipart, in push-to-talk mode", async () => {
    const s = scriptedFetch([
      json(200, { sessionId: "s1", transcript: "next step", audioDurationMs: 900, turns: [] }),
    ]);
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    const r = await client.transcribe(makeWav(), {
      model: "muse-voice-transcribe-1.0",
      keywords: ["impeller"],
    });
    expect(r).toEqual({ transcript: "next step", audioDurationMs: 900, sessionId: "s1" });
    expect(s.calls[0]!.url).toBe("https://api.meta.ai/v1/asr/transcribe");
    const form = s.calls[0]!.form!;
    expect([...form.keys()]).toEqual(["request", "audio"]);
    expect(JSON.parse(await (form.get("request") as Blob).text())).toEqual({
      model: "muse-voice-transcribe-1.0",
      audioEncoding: "WAV",
      mode: "PUSH_TO_TALK",
      keywords: ["impeller"],
    });
    expect((form.get("audio") as File).type).toBe("audio/wav");
  });
});

describe("answerStepQuestion", () => {
  it("answers in the step's context with the step-chat prompt", async () => {
    const s = scriptedFetch([
      responseWithText(
        JSON.stringify({ answer: "Vanes face the inlet.", fromStep: true, confidence: 0.9 }),
      ),
    ]);
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    const r = await answerStepQuestion(
      client,
      { reasoning: "muse-spark-1.3", segmentation: "sam-3.1" },
      {
        step: {
          title: "Fit the impeller",
          instruction: "Slide it on.",
          reason: "Vanes face the inlet.",
          parts: ["Impeller"],
          hazards: [],
        },
        equipment: "FlowSet CR 3-10",
        question: "Which way round does it go?",
      },
    );
    expect(r.ok && r.data.answer).toBe("Vanes face the inlet.");
    const body = s.calls[0]!.body as {
      instructions: string;
      input: Array<{ content: Array<{ text: string }> }>;
    };
    expect(body.instructions).toBe(prompts.stepChat);
    const sent = body.input[0]!.content[0]!.text;
    expect(sent).toContain("Step: Fit the impeller");
    expect(sent).toContain("Equipment: FlowSet CR 3-10");
    expect(sent).toContain("The user asks: Which way round does it go?");
  });
});
