import { afterEach, describe, expect, it } from "vitest";
import {
  MetaApiError,
  MetaClient,
  segmentationCost,
  setSpendMeter,
  tokenCost,
  transcriptionCost,
  type SpendEntry,
} from "../src";
import { noSleep, responseWithText, scriptedFetch } from "./helpers";

afterEach(() => setSpendMeter(null));

describe("pricing", () => {
  it("prices Spark tokens, with cached input cheaper", () => {
    expect(tokenCost("muse-spark-1.3", { input_tokens: 1_000_000, output_tokens: 0 }).usd).toBe(
      1.25,
    );
    expect(tokenCost("muse-spark-1.3", { input_tokens: 0, output_tokens: 1_000_000 }).usd).toBe(
      4.25,
    );
    expect(
      tokenCost("muse-spark-1.3", {
        input_tokens: 1_000_000,
        output_tokens: 0,
        input_tokens_details: { cached_tokens: 1_000_000 },
      }).usd,
    ).toBeCloseTo(0.15);
  });

  it("never under-prices a model it doesn't know", () => {
    expect(tokenCost("muse-something-new", { output_tokens: 1_000_000 }).usd).toBe(4.25);
  });

  it("prices SAM per image and transcription per whole second", () => {
    expect(segmentationCost("sam-3.1").usd).toBe(0.0025);
    expect(transcriptionCost("muse-voice-transcribe-1.0", 3999).seconds).toBe(3);
    expect(transcriptionCost("muse-voice-transcribe-1.0", 3_600_000).usd).toBeCloseTo(0.18);
  });
});

describe("spend meter", () => {
  it("records what each response cost", async () => {
    const seen: SpendEntry[] = [];
    setSpendMeter({ allow: () => undefined, record: (e) => seen.push(e) });
    const s = scriptedFetch([responseWithText("ok")]);
    await new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep }).respond({
      model: "muse-spark-1.3",
      input: "hi",
    });
    expect(seen).toEqual([
      expect.objectContaining({ model: "muse-spark-1.3", inputTokens: 10, outputTokens: 5 }),
    ]);
  });

  it("stops a call before it is sent when the cap says no", async () => {
    setSpendMeter({
      allow: () => {
        throw new MetaApiError("Spend cap reached", 402, "spend_cap", "spend_cap", false);
      },
      record: () => undefined,
    });
    const s = scriptedFetch([responseWithText("ok")]);
    const client = new MetaClient({ apiKey: "k", fetch: s.fetch, sleep: noSleep });
    await expect(client.respond({ model: "muse-spark-1.3", input: "hi" })).rejects.toThrow(
      "Spend cap reached",
    );
    expect(s.calls).toHaveLength(0);
  });
});
