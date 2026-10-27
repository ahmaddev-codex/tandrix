// Manual pages as images, for step visuals. Rendering runs in a worker thread with a time limit:
// a heavy or hostile PDF can't block the API, and a hung render is terminated.
import { Worker } from "node:worker_threads";
import type { RenderJob, RenderReply } from "./pdf-render-worker";

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

// Built, the worker sits next to the server bundle as .js; under tsx it is the .ts source.
const workerUrl = new URL(
  import.meta.url.endsWith(".ts") ? "./pdf-render-worker.ts" : "./pdf-render-worker.js",
  import.meta.url,
);

export function workerPageRenderer(timeoutMs = RENDER_TIMEOUT_MS): PageRenderer {
  return {
    render(pdf, page) {
      const job: RenderJob = {
        bytes: pdf,
        page,
        maxWidth: PAGE_MAX_WIDTH,
        maxHeight: PAGE_MAX_HEIGHT,
        quality: 82,
      };
      return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl, {
          workerData: job,
          resourceLimits: { maxOldGenerationSizeMb: 512 },
        });
        const timer = setTimeout(() => {
          void worker.terminate();
          reject(new Error("Rendering the manual page took too long"));
        }, timeoutMs);
        const done = () => clearTimeout(timer);
        worker.once("message", (reply: RenderReply) => {
          done();
          void worker.terminate();
          resolve(reply.ok ? { jpeg: reply.jpeg, width: reply.width, height: reply.height } : null);
        });
        worker.once("error", (e) => {
          done();
          reject(e);
        });
        worker.once("exit", (code) => {
          done();
          if (code !== 0) reject(new Error(`Page renderer exited with code ${code}`));
        });
      });
    },
  };
}
