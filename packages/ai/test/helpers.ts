// Test doubles for the Meta API: a scripted fetch and builders for Responses payloads.
export type Reply = Response | Error;

export function scriptedFetch(replies: Reply[]) {
  const calls: Array<{
    url: string;
    method: string;
    body: Record<string, unknown>;
    form?: FormData;
  }> = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    const form = init?.body instanceof FormData ? init.body : undefined;
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: form ? {} : JSON.parse(String(init?.body ?? "{}")),
      ...(form ? { form } : {}),
    });
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

/** A real PCM WAV: `ms` of silence, with an extra chunk before data the way iOS writes one. */
export function makeWav(
  opts: {
    ms?: number;
    sampleRate?: number;
    channels?: number;
    bits?: number;
    format?: number;
    extraChunk?: boolean;
  } = {},
): Uint8Array {
  const {
    ms = 500,
    sampleRate = 16000,
    channels = 1,
    bits = 16,
    format = 1,
    extraChunk = true,
  } = opts;
  const blockAlign = (channels * bits) / 8;
  const dataBytes = Math.round((sampleRate * ms) / 1000) * blockAlign;
  const extra = extraChunk ? 8 + 4 : 0;
  const buf = new ArrayBuffer(44 + extra + dataBytes);
  const v = new DataView(buf);
  const str = (at: number, s: string) =>
    [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + extra + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, format, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * blockAlign, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bits, true);
  let at = 36;
  if (extraChunk) {
    str(at, "FLLR");
    v.setUint32(at + 4, 4, true);
    at += 12;
  }
  str(at, "data");
  v.setUint32(at + 4, dataBytes, true);
  return new Uint8Array(buf);
}
