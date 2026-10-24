// Test doubles for the Meta API: a scripted fetch and builders for Responses payloads.
export type Reply = Response | Error;

export function scriptedFetch(replies: Reply[]) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    const next = replies.shift();
    if (!next) throw new Error("No scripted reply left");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
  return { fetch: fn, calls };
}

export const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

export const apiError = (
  status: number,
  type: string,
  code: string | null,
  headers: Record<string, string> = {},
) =>
  json(
    status,
    { error: { message: `${type} ${code ?? ""}`.trim(), type, param: null, code } },
    headers,
  );

export const responseWithText = (text: string, id = "resp_1") =>
  json(200, {
    id,
    object: "response",
    status: "completed",
    model: "muse-spark-1.3",
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text }] }],
    usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
  });

/** A text/event-stream body, optionally split mid-event to exercise buffering. */
export function sse(events: unknown[], splitEvery?: number): Response {
  const raw = events
    .map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`)
    .join("");
  const enc = new TextEncoder();
  const chunks = splitEvery
    ? Array.from({ length: Math.ceil(raw.length / splitEvery) }, (_, i) =>
        raw.slice(i * splitEvery, (i + 1) * splitEvery),
      )
    : [raw];
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** SAM streaming events for one image line, as documented. */
export function samStream(line: string, splitEvery?: number): Response {
  return sse(
    [
      { type: "response.created", response: { id: "resp_sam", status: "in_progress" } },
      {
        type: "response.output_text.delta",
        item_id: "msg_1",
        output_index: 0,
        content_index: 0,
        delta: line,
      },
      {
        type: "response.output_text.done",
        item_id: "msg_1",
        output_index: 0,
        content_index: 0,
        text: line,
      },
      { type: "response.completed", response: { id: "resp_sam", status: "completed" } },
    ],
    splitEvery,
  );
}

// From Meta's "Read SAM segmentation output" docs (video example, frame 0), used as an image line.
export const DOC_SAM_LINE =
  "<0f>0<|box;x1=211;y1=228;x2=270;y2=254;w=320;h=334|><|mask;x=0;y=0;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>,1<|box;x1=155;y1=228;x2=202;y2=254;w=320;h=334|><|mask;x=0;y=0;data=27,48,~!!!!J!0c[q=Pj_zs=*4C4(/./x#:/`S_GnD`=o3?X{emCgO$y@|>";

export const noSleep = async () => {};
