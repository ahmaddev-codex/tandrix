// Manual pages as images, for step visuals. Rendering runs in a small pool of warm worker
// threads with a time limit: a heavy or hostile PDF can't block the API, a hung render is
// terminated, and renders stop paying pdf.js startup on every page.
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import type { RenderJob, WorkerRequest, WorkerResponse } from "./pdf-render-worker";

export interface RenderedPage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

export interface PageRenderer {
  /** The page as a JPEG, or null if the PDF has no such page or can't be read. */
  render(pdf: Uint8Array, page: number): Promise<RenderedPage | null>;
}

/** Wide enough to zoom into a figure on a phone; a tall page is capped by height. */
export const PAGE_MAX_WIDTH = 1600;
export const PAGE_MAX_HEIGHT = 2400;
export const RENDER_TIMEOUT_MS = 20_000;
/** Two warm workers: step visuals rarely need more renders at once. */
export const RENDER_POOL_SIZE = 2;

// Built, the worker sits next to the server bundle as .js; under tsx it is the .ts source.
const workerUrl = new URL(
  import.meta.url.endsWith(".ts") ? "./pdf-render-worker.ts" : "./pdf-render-worker.js",
  import.meta.url,
);

type SpawnWorker = () => Worker;
const defaultSpawn: SpawnWorker = () => {
  const w = new Worker(workerUrl, {
    resourceLimits: { maxOldGenerationSizeMb: 512 },
  });
  // Pool workers must not keep a CLI or test process alive on their own.
  w.unref();
  return w;
};

/** Length plus a hash of the head, middle and tail: distinct PDFs stop sharing renders. */
function pdfKey(pdf: Uint8Array, page: number): string {
  const h = createHash("sha256");
  const n = pdf.byteLength;
  h.update(pdf.subarray(0, Math.min(4096, n)));
  if (n > 8192) {
    h.update(pdf.subarray((n >> 1) - 2048, (n >> 1) + 2048));
    h.update(pdf.subarray(n - 4096));
  }
  h.update(String(n));
  return `${h.digest("hex")}:${page}`;
}

export function workerPageRenderer(
  timeoutMs = RENDER_TIMEOUT_MS,
  poolSize = RENDER_POOL_SIZE,
  spawn: SpawnWorker = defaultSpawn,
): PageRenderer {
  const inflight = new Map<string, Promise<RenderedPage | null>>();
  const idle: Worker[] = [];
  const waiting: Array<(w: Worker) => void> = [];
  let live = 0;
  const spawnPooled = (): Worker => {
    const w = spawn();
    // A pooled worker's own job handler settles its render; this keeps a rare idle error
    // from throwing unhandled.
    w.on("error", () => {});
    return w;
  };
  const acquire = (): Promise<Worker> =>
    new Promise((resolve) => {
      const w = idle.pop();
      if (w) return resolve(w);
      if (live < poolSize) {
        live++;
        return resolve(spawnPooled());
      }
      waiting.push(resolve);
    });
  const release = (w: Worker) => {
    const next = waiting.shift();
    if (next) next(w);
    else idle.push(w);
  };
  const discard = (w: Worker) => {
    void w.terminate();
    // A hung worker's slot goes straight to the next waiter, so the queue never stalls.
    const next = waiting.shift();
    if (next) next(spawnPooled());
    else live--;
  };
  let nextId = 0;
  const runOne = async (job: RenderJob): Promise<RenderedPage | null> => {
    const worker = await acquire();
    return new Promise<RenderedPage | null>((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => {
        cleanup();
        discard(worker);
        reject(new Error("Rendering the manual page took too long"));
      }, timeoutMs);
      // One job per worker at a time, so the id only guards against a late reply.
      const onMessage = (res: WorkerResponse) => {
        if (res.id !== id) return;
        cleanup();
        release(worker);
        const reply = res.reply;
        resolve(reply.ok ? { jpeg: reply.jpeg, width: reply.width, height: reply.height } : null);
      };
      const onError = (e: Error) => {
        cleanup();
        discard(worker);
        reject(e);
      };
      const cleanup = () => {
        clearTimeout(timer);
        worker.off("message", onMessage);
        worker.off("error", onError);
      };
      worker.on("message", onMessage);
      worker.on("error", onError);
      worker.postMessage({ id, job } satisfies WorkerRequest);
    });
  };
  return {
    render(pdf, page) {
      const key = pdfKey(pdf, page);
      const existing = inflight.get(key);
      if (existing) return existing;
      const job: RenderJob = {
        bytes: pdf,
        page,
        maxWidth: PAGE_MAX_WIDTH,
        maxHeight: PAGE_MAX_HEIGHT,
        quality: 82,
      };
      const promise = runOne(job).finally(() => {
        inflight.delete(key);
      });
      inflight.set(key, promise);
      return promise;
    },
  };
}
