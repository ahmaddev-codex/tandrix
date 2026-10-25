// Where offline work lives on the device: the queue as JSON, queued photos and cached jobs in the
// app's documents (never the cache directory, which the system may clear).
import { JobDetailResponse } from "@tandrix/contracts";
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
