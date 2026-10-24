import { describe, expect, it } from "vitest";
import { MetaApiError, MetaClient, outputText } from "../src";
import { apiError, json, noSleep, responseWithText, scriptedFetch, sse } from "./helpers";

const make = (
  replies: Parameters<typeof scriptedFetch>[0],
  extra: Partial<ConstructorParameters<typeof MetaClient>[0]> = {},
) => {
  const s = scriptedFetch(replies);
  const sleeps: number[] = [];
  const client = new MetaClient({
    apiKey: "test-key",
    fetch: s.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    ...extra,
  });
  return { client, calls: s.calls, sleeps };
};

describe("MetaClient.respond", () => {
  it("posts to /responses with auth, store: false and stream: false", async () => {
    const { client, calls } = make([responseWithText("hi")]);
    const res = await client.respond({ model: "muse-spark-1.3", input: "x" });
    expect(outputText(res)).toBe("hi");
    expect(calls[0]!.url).toBe("https://api.meta.ai/v1/responses");
    expect(calls[0]!.body).toMatchObject({ model: "muse-spark-1.3", store: false, stream: false });
  });

  it("retries 429 using Retry-After", async () => {
    const { client, calls, sleeps } = make([
      apiError(429, "rate_limit_error", "rate_limit_exceeded", { "retry-after": "2" }),
      responseWithText("ok"),
    ]);
    await client.respond({ model: "m", input: "x" });
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it("retries 5xx with backoff, then gives up after maxAttempts", async () => {
    const { client, calls } = make([
      apiError(503, "server_error", "service_overloaded", { "retry-after": "1" }),
      apiError(500, "server_error", null),
      apiError(502, "server_error", null),
    ]);
    await expect(client.respond({ model: "m", input: "x" })).rejects.toMatchObject({
      status: 502,
      retryable: true,
    });
    expect(calls).toHaveLength(3);
  });

  it("fails fast when Retry-After is longer than we'll wait", async () => {
    const { client, calls } = make([
      apiError(503, "server_error", "service_overloaded", { "retry-after": "60" }),
    ]);
    await expect(client.respond({ model: "m", input: "x" })).rejects.toMatchObject({
      code: "service_overloaded",
      retryAfterMs: 60_000,
    });
    expect(calls).toHaveLength(1);
  });

  it("does not retry client errors", async () => {
    const { client, calls } = make([apiError(400, "invalid_request_error", null)]);
    await expect(client.respond({ model: "m", input: "x" })).rejects.toMatchObject({
      status: 400,
      retryable: false,
    });
    expect(calls).toHaveLength(1);
  });

  it("handles 404 with no body", async () => {
    const { client } = make([new Response(null, { status: 404 })]);
    await expect(client.respond({ model: "m", input: "x" })).rejects.toMatchObject({
      status: 404,
      message: "HTTP 404",
    });
  });

  it("retries network errors", async () => {
    const { client, calls } = make([new TypeError("fetch failed"), responseWithText("ok")]);
    await client.respond({ model: "m", input: "x" });
    expect(calls).toHaveLength(2);
  });

  it("does not put the API key in errors", async () => {
    const { client } = make([apiError(401, "authentication_error", "invalid_api_key")]);
    const err = await client.respond({ model: "m", input: "x" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(MetaApiError);
    expect(JSON.stringify({ ...(err as object), message: (err as Error).message })).not.toContain(
      "test-key",
    );
  });

  it("treats a failed response status as a retryable error", async () => {
    const { client } = make([
      json(200, {
        id: "r",
        status: "failed",
        model: "m",
        output: [],
        error: { code: "server_error", message: "boom" },
      }),
    ]);
    await expect(client.respond({ model: "m", input: "x" })).rejects.toMatchObject({
      message: "boom",
    });
  });
});

describe("outputText", () => {
  it("throws on refusals", () => {
    expect(() =>
      outputText({
        id: "r",
        status: "completed",
        model: "m",
        output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
      }),
    ).toThrow(MetaApiError);
  });
});

describe("MetaClient.stream", () => {
  it("parses events split across chunks", async () => {
    const events = [
      { type: "response.created" },
      { type: "response.output_text.delta", delta: "hello " },
      { type: "response.output_text.delta", delta: "world" },
      { type: "response.completed" },
    ];
    const { client, calls } = make([sse(events, 7)]);
    const got = [];
    for await (const e of client.stream({ model: "m", input: "x" })) got.push(e);
    expect(got).toEqual(events);
    expect(calls[0]!.body).toMatchObject({ stream: true, store: false });
  });

  it("throws on a terminal error event", async () => {
    const { client } = make([
      sse([
        { type: "response.created" },
        { type: "error", code: "server_shutting_down", message: "draining" },
      ]),
    ]);
    const run = async () => {
      for await (const _ of client.stream({ model: "m", input: "x" })) void _;
    };
    await expect(run()).rejects.toMatchObject({ code: "server_shutting_down", retryable: true });
  });
});

describe("constructor", () => {
  it("requires an API key", () => {
    expect(() => new MetaClient({ apiKey: "", sleep: noSleep })).toThrow(/API key/);
  });
});
