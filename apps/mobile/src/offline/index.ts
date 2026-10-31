// Offline support for the phone: the shared queue, how queued work is sent, the job cache, and the
// status screens show ("3 changes waiting", what the server turned down).
import type { JobDetailResponse } from "@tandrix/contracts";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { api, ApiError } from "@/lib/api";
import { uploadPhoto } from "@/lib/evidence";
import { createQueue, type FlushReport, type QueuedOp, type RunResult } from "./queue";
import { fileQueueStore, forgetPhoto, jobCache, manualCache, visualCache } from "./store";

export { keepPhoto, manualCache, visualCache } from "./store";
export type { QueuedOp } from "./queue";

/** Offline: no connection, the API down, or the session lapsed. Anything else is a real answer. */
export const isOffline = (e: unknown) =>
  !(e instanceof ApiError) || e.status === 0 || e.status === 401 || e.status >= 500;

const failure = (e: unknown): RunResult =>
  isOffline(e) ? { status: "offline" } : { status: "rejected", message: (e as Error).message };

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const offlineQueue = createQueue({
  store: fileQueueStore,
  newId,
  now: () => new Date(),
  runner: {
    async run(op: QueuedOp): Promise<RunResult> {
      try {
        if (op.kind === "action") {
          const r = await api.stepAction(op.jobId, op.jobStepId, op.body);
          return r.status === "applied"
            ? { status: "sent" }
            : { status: "rejected", message: r.message };
        }
        const evidence = await uploadPhoto(
          op.jobId,
          { ...op.photo, uri: op.photo.path },
          op.jobStepId,
        );
        if (op.then === "check" && op.jobStepId) {
          // The verdict shows on the step next time it's opened; a refusal is worth saying.
          const r = await api.checkStep(op.jobId, op.jobStepId, evidence.id);
          if (r.status === "rejected") {
            forgetPhoto(op.photo.path);
            return { status: "rejected", message: r.message };
          }
        }
        forgetPhoto(op.photo.path);
        return { status: "sent" };
      } catch (e) {
        return failure(e);
      }
    },
  },
});

// What screens show about the queue. Problems are kept until dismissed.
let problems: string[] = [];
let waiting = 0;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

offlineQueue.subscribe((ops) => {
  waiting = ops.length;
  changed();
});

export async function syncNow(): Promise<FlushReport> {
  const report = await offlineQueue.flush();
  if (report.rejected.length) {
    problems = [
      ...problems,
      ...report.rejected.map((r) => `When this synced, Tandrix couldn't save it: ${r.message}`),
    ];
    changed();
  }
  waiting = report.waiting;
  changed();
  return report;
}

export function useOfflineStatus() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    offlineQueue.pending().then((ops) => {
      waiting = ops.length;
      l();
    });
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    waiting,
    problems,
    dismiss: () => {
      problems = [];
      changed();
    },
  };
}

/** Sends queued work now, every 20 seconds while anything waits, and when the app comes back. */
export function useOfflineSync() {
  useEffect(() => {
    syncNow();
    const timer = setInterval(() => {
      if (waiting) syncNow();
    }, 20_000);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") syncNow();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);
}

/** The job from the API, cached for offline use; offline, the last copy seen. */
export async function loadJob(
  jobId: string,
): Promise<{ detail: JobDetailResponse; offline: boolean }> {
  try {
    const detail = await api.getJob(jobId);
    jobCache.save(detail);
    keepForSite(detail);
    // Online again: send anything that was waiting.
    if (waiting) syncNow();
    return { detail, offline: false };
  } catch (e) {
    if (!isOffline(e)) throw e;
    const cached = await jobCache.load(jobId);
    if (!cached) throw e;
    return { detail: cached, offline: true };
  }
}

/** A project's files are kept again at most this often while the app runs. */
const KEEP_EVERY_MS = 10 * 60_000;
const keptAt = new Map<string, number>();

/**
 * Keeps what the project needs on site in the background: the manual PDF and every step's
 * pictures, so they open without a connection. One step at a time, to stay out of the way.
 */
function keepForSite(detail: JobDetailResponse) {
  const jobId = detail.job.id;
  if (Date.now() - (keptAt.get(jobId) ?? 0) < KEEP_EVERY_MS) return;
  keptAt.set(jobId, Date.now());
  void (async () => {
    const manual = detail.manual;
    if (manual && !manualCache.file(manual.id).exists)
      await api
        .manualUrl(jobId, manual.id)
        .then((url) => manualCache.keep(manual.id, url))
        .catch(() => {});
    for (const step of detail.steps)
      await api
        .stepVisuals(jobId, step.id)
        .then((r) => visualCache.save(step.id, r.visuals))
        .catch(() => {});
  })();
}
