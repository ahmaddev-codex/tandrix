// Where offline work lives on the device: the queue as JSON, queued photos, cached jobs, and each
// project's manual and step pictures, in the app's documents (never the cache directory, which the
// system may clear).
import { JobDetailResponse, type StepVisual } from "@tandrix/contracts";
import { Directory, File, Paths } from "expo-file-system";
import type { QueuedOp, QueuedPhoto, QueueStore } from "./queue";

const root = () => {
  const dir = new Directory(Paths.document, "offline");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

export const fileQueueStore: QueueStore = {
  async load() {
    const file = new File(root(), "queue.json");
    if (!file.exists) return [];
    try {
      return JSON.parse(await file.text()) as QueuedOp[];
    } catch {
      // A damaged queue file must not stop the app; start a fresh one.
      return [];
    }
  },
  async save(ops) {
    const file = new File(root(), "queue.json");
    if (!file.exists) file.create();
    file.write(JSON.stringify(ops));
  },
};

/** Keeps a copy of a prepared photo for the queue; the original sits in the cache directory. */
export function keepPhoto(uri: string, meta: Omit<QueuedPhoto, "path">, id: string): QueuedPhoto {
  const dir = new Directory(root(), "photos");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const dest = new File(dir, `${id}.jpg`);
  new File(uri).copy(dest);
  return { ...meta, path: dest.uri };
}

export function forgetPhoto(path: string) {
  const file = new File(path);
  if (file.exists) file.delete();
}

/** The last job detail seen online, so steps stay readable without a connection. */
export const jobCache = {
  save(detail: JobDetailResponse) {
    const dir = new Directory(root(), "jobs");
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const file = new File(dir, `${detail.job.id}.json`);
    if (!file.exists) file.create();
    file.write(JSON.stringify(detail));
  },
  async load(jobId: string): Promise<JobDetailResponse | null> {
    const file = new File(root(), "jobs", `${jobId}.json`);
    if (!file.exists) return null;
    const parsed = JobDetailResponse.safeParse(JSON.parse(await file.text()));
    return parsed.success ? parsed.data : null;
  },
};

const dirOf = (name: string) => {
  const dir = new Directory(root(), name);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const downloading = new Map<string, Promise<File>>();

/**
 * Downloads beside the file, then moves it into place, so a cut-off download never looks kept.
 * Asked for the same file twice at once (a step open while the project is being kept), both
 * share one download.
 */
function keepDownload(url: string, file: File): Promise<File> {
  if (file.exists) return Promise.resolve(file);
  const running = downloading.get(file.uri);
  if (running) return running;
  const part = new File(file.parentDirectory, `${file.name}.part`);
  const work = File.downloadFileAsync(url, part, { idempotent: true })
    .then(() => {
      part.move(file);
      return file;
    })
    .catch((e: unknown) => {
      if (part.exists) part.delete();
      throw e;
    })
    .finally(() => downloading.delete(file.uri));
  downloading.set(file.uri, work);
  return work;
}

/** The project's manual as a PDF on the phone, to read on site without a connection. */
export const manualCache = {
  file: (manualId: string) => new File(dirOf("manuals"), `${manualId}.pdf`),
  keep: (manualId: string, url: string) => keepDownload(url, manualCache.file(manualId)),
};

/** A picture's file name: manual pages are shared between steps, photos are the user's own. */
const visualName = (v: StepVisual) =>
  v.kind === "manual_page" ? `page-${v.manualId}-${v.page}` : `photo-${v.evidenceId}`;

/** Each step's pictures (its reference, the cited manual page, the latest photo), kept offline. */
export const visualCache = {
  async save(jobStepId: string, visuals: StepVisual[]) {
    const files = dirOf("visuals");
    const list = new File(dirOf("steps"), `${jobStepId}.json`);
    // A replaced reference or newer photo leaves its old file behind; pages may serve other steps.
    if (list.exists) {
      const before = (JSON.parse(await list.text()) as StepVisual[]).map(visualName);
      const now = new Set(visuals.map(visualName));
      for (const name of before)
        if (name.startsWith("photo-") && !now.has(name)) {
          const old = new File(files, name);
          if (old.exists) old.delete();
        }
    }
    await Promise.allSettled(
      visuals.map((v) => keepDownload(v.url, new File(files, visualName(v)))),
    );
    if (!list.exists) list.create();
    list.write(JSON.stringify(visuals));
  },
  /** The pictures last seen for the step, pointing at the kept files; [] if none were kept. */
  async load(jobStepId: string): Promise<StepVisual[]> {
    const list = new File(root(), "steps", `${jobStepId}.json`);
    if (!list.exists) return [];
    try {
      return (JSON.parse(await list.text()) as StepVisual[]).flatMap((v) => {
        const kept = new File(root(), "visuals", visualName(v));
        return kept.exists ? [{ ...v, url: kept.uri }] : [];
      });
    } catch {
      return [];
    }
  },
};
