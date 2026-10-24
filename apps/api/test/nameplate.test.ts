import { MetaClient, type MetaConfig } from "@tandrix/ai";
import { describe, expect, it } from "vitest";
import { metaNameplateReader, UNAVAILABLE_MESSAGE, UNREADABLE_MESSAGE } from "../src/nameplate";

const config: MetaConfig = {
  apiKey: "k",
  baseUrl: "https://api.meta.ai/v1",
  timeoutMs: 1000,
  models: {
    reasoning: "muse-spark-1.3",
    segmentation: "sam-3.1",
    computerUse: "x",
    transcribe: "y",
  },
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const text = (t: string) =>
  reply(200, {
    id: "r",
    status: "completed",
    model: "m",
    output: [{ type: "message", content: [{ type: "output_text", text: t }] }],
  });

function reader(replies: Array<Response | Error>) {
  const logs: Array<Record<string, unknown>> = [];
  const sent: unknown[] = [];
  const client = new MetaClient({
    apiKey: "k",
    sleep: async () => {},
    maxAttempts: 1,
    fetch: (async (_u: unknown, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      const r = replies.shift();
      if (!r) throw new Error("no reply");
      if (r instanceof Error) throw r;
      return r;
    }) as typeof fetch,
  });
  return { r: metaNameplateReader(config, (l) => logs.push(l), client), logs, sent };
}
const jpeg = { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), mimeType: "image/jpeg" };

describe("metaNameplateReader", () => {
  it("returns a reading and sends the photo as an inline image", async () => {
    const { r, sent } = reader([
      text(
        JSON.stringify({
          unreadable: false,
          make: "FlowSet",
          model: "CR 3-10",
          serial: "4521-0098",
          ratings: [],
          confidence: 0.93,
        }),
      ),
    ]);
    expect(await r.read(jpeg)).toEqual({
      status: "read",
      reading: {
        unreadable: false,
        make: "FlowSet",
        model: "CR 3-10",
        serial: "4521-0098",
        ratings: [],
        confidence: 0.93,
      },
    });
    expect(JSON.stringify(sent[0])).toContain("data:image/jpeg;base64,/9j/4A==");
  });

  it("treats an unreadable plate, or one missing make or model, as unreadable", async () => {
    for (const out of [
      { unreadable: true, confidence: 0.1 },
      { unreadable: false, make: "FlowSet", confidence: 0.5 },
    ]) {
      const { r } = reader([text(JSON.stringify(out))]);
      expect(await r.read(jpeg)).toEqual({
        status: "unavailable",
        reason: "unreadable",
        message: UNREADABLE_MESSAGE,
      });
    }
  });

  it("turns API failures (billing, rate limit, server) into 'unavailable' without throwing", async () => {
    for (const [status, code] of [
      [402, "billing_not_configured"],
      [429, "rate_limit_exceeded"],
      [503, "service_overloaded"],
    ] as const) {
      const { r, logs } = reader([reply(status, { error: { message: "x", type: "t", code } })]);
      expect(await r.read(jpeg)).toEqual({
        status: "unavailable",
        reason: "model_unavailable",
        message: UNAVAILABLE_MESSAGE,
      });
      expect(logs[0]).toMatchObject({ event: "nameplate_model_error", status, code });
    }
  });

  it("treats output that fails the schema twice as unavailable", async () => {
    const { r } = reader([text("not json"), text('{"nope":1}')]);
    expect(await r.read(jpeg)).toMatchObject({
      status: "unavailable",
      reason: "model_unavailable",
    });
  });

  it("doesn't put the image or key in logs", async () => {
    const { r, logs } = reader([
      reply(402, { error: { message: "x", type: "t", code: "billing_not_configured" } }),
    ]);
    await r.read(jpeg);
    expect(JSON.stringify(logs)).not.toMatch(/base64|\/9j\/|"k"/);
  });
});
