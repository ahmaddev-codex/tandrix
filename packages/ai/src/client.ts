// Minimal Meta Model API client for the Responses API. Server-side only: it holds the API key.
// Retries transient failures (429, 5xx, network) with backoff, honouring Retry-After, and never
// logs or echoes request bodies.

export interface MetaClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Longest Retry-After we'll wait inside one call; longer waits fail fast so callers can fall back. */
  maxRetryAfterMs?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface ResponseUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface ResponseOutputContent {
  type: string;
  text?: string;
  refusal?: string;
}

export interface ResponseOutputItem {
  type: string;
  id?: string;
  role?: string;
  content?: ResponseOutputContent[];
  [key: string]: unknown;
}

export interface MetaResponse {
  id: string;
  status: string;
  model: string;
  output: ResponseOutputItem[];
  usage?: ResponseUsage;
  error?: { code?: string | null; message?: string } | null;
}

export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly type: string | null,
    readonly code: string | null,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export class MetaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly maxRetryAfterMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly opts: MetaClientOptions) {
    if (!opts.apiKey) throw new Error("MetaClient needs an API key");
    this.baseUrl = (opts.baseUrl ?? "https://api.meta.ai/v1").replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.maxAttempts = opts.maxAttempts ?? 3;
    this.maxRetryAfterMs = opts.maxRetryAfterMs ?? 15_000;
    this.fetchImpl = opts.fetch ?? fetch;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** POST /responses, non-streaming. */
  async respond(body: Record<string, unknown>, signal?: AbortSignal): Promise<MetaResponse> {
    const res = await this.post("/responses", { store: false, ...body, stream: false }, signal);
    const json = (await res.json()) as MetaResponse;
    if (json.status === "failed") {
      throw new MetaApiError(
        json.error?.message ?? "Response failed",
        res.status,
        "server_error",
        json.error?.code ?? null,
        true,
      );
    }
    return json;
  }

  /** POST /responses with stream: true. Retries only happen before the first event arrives. */
  async *stream(body: Record<string, unknown>, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    const res = await this.post(
      "/responses",
      { store: false, ...body, stream: true },
      signal,
      "text/event-stream",
    );
    if (!res.body) throw new MetaApiError("Empty stream", res.status, null, null, true);
    yield* parseSse(res.body);
  }

  /**
   * POST /files (purpose user_data) for inputs too large to send inline. Set an expiry and delete
   * after use: uploaded files otherwise persist and count against team storage.
   */
  async uploadFile(
    bytes: Uint8Array,
    opts: { filename: string; mimeType: string; expiresAfterSec?: number },
    signal?: AbortSignal,
  ): Promise<{ id: string }> {
    const form = () => {
      // purpose and expiry before the file part, as the API recommends.
      const f = new FormData();
      f.append("purpose", "user_data");
      if (opts.expiresAfterSec) {
        f.append("expires_after[anchor]", "created_at");
        f.append("expires_after[seconds]", String(opts.expiresAfterSec));
      }
      f.append("file", new Blob([bytes as BlobPart], { type: opts.mimeType }), opts.filename);
      return f;
    };
    const res = await this.send("/files", { method: "POST", body: form }, signal);
    const json = (await res.json()) as { id?: unknown };
    if (typeof json.id !== "string")
      throw new MetaApiError("Upload returned no file id", res.status, null, null, false);
    return { id: json.id };
  }

  /** DELETE /files/:id. A file that is already gone counts as deleted. */
  async deleteFile(id: string, signal?: AbortSignal): Promise<void> {
    try {
      await this.send(`/files/${encodeURIComponent(id)}`, { method: "DELETE" }, signal);
    } catch (e) {
      if (e instanceof MetaApiError && e.status === 404) return;
      throw e;
    }
  }

  private post(path: string, body: unknown, signal?: AbortSignal, accept = "application/json") {
    return this.send(
      path,
      { method: "POST", body: () => JSON.stringify(body), contentType: "application/json" },
      signal,
      accept,
    );
  }

  /** One request with retries. `body` is a factory so each attempt sends a fresh body. */
  private async send(
    path: string,
    req: { method: string; body?: () => BodyInit; contentType?: string },
    signal?: AbortSignal,
    accept = "application/json",
  ): Promise<Response> {
    let lastError: MetaApiError | null = null;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const timeout = AbortSignal.timeout(this.timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let res: Response;
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: req.method,
          headers: {
            Authorization: `Bearer ${this.opts.apiKey}`,
            ...(req.contentType ? { "Content-Type": req.contentType } : {}),
            Accept: accept,
          },
          ...(req.body ? { body: req.body() } : {}),
          signal: combined,
        });
      } catch (e) {
        if (signal?.aborted) throw e;
        const timedOut = timeout.aborted;
        lastError = new MetaApiError(
          timedOut ? "Request timed out" : "Network error",
          null,
          null,
          timedOut ? "timeout" : "network_error",
          true,
        );
        if (attempt < this.maxAttempts) {
          await this.sleep(backoffMs(attempt));
          continue;
        }
        throw lastError;
      }

      if (res.ok) return res;

      const err = await toApiError(res);
      if (!err.retryable || attempt === this.maxAttempts) throw err;
      if (err.retryAfterMs !== null && err.retryAfterMs > this.maxRetryAfterMs) throw err;
      lastError = err;
      await this.sleep(err.retryAfterMs ?? backoffMs(attempt));
    }
    throw lastError ?? new MetaApiError("Request failed", null, null, null, false);
  }
}

function backoffMs(attempt: number): number {
  return 2 ** (attempt - 1) * 500 + Math.floor(Math.random() * 250);
}

async function toApiError(res: Response): Promise<MetaApiError> {
  const retryAfter = res.headers.get("retry-after");
  const retryAfterMs =
    retryAfter && /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000 : null;
  let type: string | null = null;
  let code: string | null = null;
  let message = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as {
      error?: { message?: string; type?: string; code?: string | null };
    };
    if (body.error) {
      message = body.error.message ?? message;
      type = body.error.type ?? null;
      code = body.error.code ?? null;
    }
  } catch {
    // 404 on unknown paths has no body; keep the status-based message.
  }
  return new MetaApiError(
    message,
    res.status,
    type,
    code,
    RETRYABLE_STATUS.has(res.status),
    retryAfterMs,
  );
}

/** Parses a text/event-stream body into JSON events. A terminal `error` event throws. */
export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let sep: number;
    while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, "");
      const event = parseSseBlock(raw);
      if (event) yield event;
    }
  }
  const tail = parseSseBlock(buffer);
  if (tail) yield tail;
}

function parseSseBlock(block: string): StreamEvent | null {
  const data = block
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return null;
  const event = JSON.parse(data) as StreamEvent;
  if (event.type === "error") {
    const e = event as { code?: string; message?: string };
    throw new MetaApiError(
      e.message ?? "Stream error",
      null,
      "server_error",
      e.code ?? null,
      e.code === "server_shutting_down",
    );
  }
  return event;
}

/** Concatenated assistant text from a non-streaming response. Refusals throw. */
export function outputText(res: MetaResponse): string {
  const parts: string[] = [];
  for (const item of res.output) {
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type === "refusal")
        throw new MetaApiError(c.refusal ?? "Model refused", null, "refusal", "refusal", false);
      if (c.type === "output_text" && c.text) parts.push(c.text);
    }
  }
  return parts.join("");
}
