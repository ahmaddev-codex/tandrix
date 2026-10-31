// Renders one PDF page to a JPEG, in a worker thread (see pdf-render.ts). Manuals are uploaded
// by users, so the PDF is untrusted: no system fonts and nothing fetched (pdf.js 6 never evaluates
// code from a PDF).
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parentPort } from "node:worker_threads";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface RenderJob {
  bytes: Uint8Array;
  page: number;
  maxWidth: number;
  maxHeight: number;
  quality: number;
}

export type RenderReply =
  | { ok: true; jpeg: Uint8Array; width: number; height: number }
  | { ok: false; reason: "no_page" | "unreadable" };

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
const asset = (dir: string) => `${pathToFileURL(join(pdfjsRoot, dir)).href}/`;

async function render(job: RenderJob): Promise<RenderReply> {
  const task = getDocument({
    data: job.bytes,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: asset("standard_fonts"),
    cMapUrl: asset("cmaps"),
    cMapPacked: true,
    verbosity: 0,
  });
  try {
    const doc = await task.promise;
    if (job.page < 1 || job.page > doc.numPages) return { ok: false, reason: "no_page" };
    const page = await doc.getPage(job.page);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(job.maxWidth / base.width, job.maxHeight / base.height);
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.floor(viewport.width));
    const height = Math.max(1, Math.floor(viewport.height));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    // Manual pages are drawn on paper: white behind transparent pages. A page colour, not UI.
    // eslint-disable-next-line no-restricted-syntax
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const jpeg = await canvas.encode("jpeg", job.quality);
    return { ok: true, jpeg: new Uint8Array(jpeg), width, height };
  } finally {
    await task.destroy();
  }
}

export interface WorkerRequest {
  id: number;
  job: RenderJob;
}

export interface WorkerResponse {
  id: number;
  reply: RenderReply;
}

if (parentPort) {
  const port = parentPort;
  // One job at a time per worker (the pool guarantees it), so replies need no queue.
  port.on("message", (req: WorkerRequest) => {
    render(req.job)
      .catch((): RenderReply => ({ ok: false, reason: "unreadable" }))
      .then((reply) =>
        port.postMessage({ id: req.id, reply } satisfies WorkerResponse, [
          ...(reply.ok ? [reply.jpeg.buffer as ArrayBuffer] : []),
        ]),
      );
  });
}
