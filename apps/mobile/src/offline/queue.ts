// Work done offline waits here and is sent, in order, when the API can be reached again. Pure: the
// store and the runner are injected, so the ordering and retry rules are unit tested.
import type { StepActionRequest } from "@tandrix/contracts";

export interface QueuedPhoto {
  /** A copy of the prepared JPEG in the app's documents, safe from cache clean-up. */
  path: string;
  width: number;
  height: number;
  byteSize: number;
  capturedAt: string;
}

export type QueuedOp =
  | {
      id: string;
      kind: "photo";
      jobId: string;
      jobStepId?: string;
      photo: QueuedPhoto;
      /** "check": run Check my work on it once uploaded. */
      then?: "check";
      queuedAt: string;
    }
  | {
      id: string;
      kind: "action";
      jobId: string;
      jobStepId: string;
      body: StepActionRequest;
      queuedAt: string;
    };

export type QueuedOpInput = QueuedOp extends infer T
  ? T extends QueuedOp
    ? Omit<T, "id" | "queuedAt">
    : never
  : never;

/** What happened when one op was sent: sent, try later (offline), or turned down for good. */
export type RunResult =
  { status: "sent" } | { status: "offline" } | { status: "rejected"; message: string };

export interface QueueStore {
  load(): Promise<QueuedOp[]>;
  save(ops: QueuedOp[]): Promise<void>;
}

export interface QueueRunner {
  run(op: QueuedOp): Promise<RunResult>;
}

export interface FlushReport {
  sent: number;
  /** Ops the server turned down, with why, for the user to see. */
  rejected: Array<{ op: QueuedOp; message: string }>;
  /** Ops still waiting because the API couldn't be reached. */
  waiting: number;
}

export function createQueue(deps: {
  store: QueueStore;
  runner: QueueRunner;
  newId: () => string;
  now: () => Date;
}) {
  let flushing: Promise<FlushReport> | null = null;
  const listeners = new Set<(ops: QueuedOp[]) => void>();
  const notify = (ops: QueuedOp[]) => listeners.forEach((l) => l(ops));

  const queue = {
    async enqueue(input: QueuedOpInput): Promise<QueuedOp> {
      const op = { ...input, id: deps.newId(), queuedAt: deps.now().toISOString() } as QueuedOp;
      const ops = [...(await deps.store.load()), op];
      await deps.store.save(ops);
      notify(ops);
      return op;
    },

    async pending(filter: { jobId?: string; jobStepId?: string } = {}): Promise<QueuedOp[]> {
      return (await deps.store.load()).filter(
        (op) =>
          (!filter.jobId || op.jobId === filter.jobId) &&
          (!filter.jobStepId || ("jobStepId" in op && op.jobStepId === filter.jobStepId)),
      );
    },

    /**
     * Sends ops oldest first. Stops at the first one that can't reach the API, so later work
     * never overtakes earlier work (a step's "done" must not arrive before its "start").
     * One flush at a time: a second call shares the first.
     */
    flush(): Promise<FlushReport> {
      if (flushing) return flushing;
      flushing = (async () => {
        const report: FlushReport = { sent: 0, rejected: [], waiting: 0 };
        let ops = await deps.store.load();
        while (ops.length) {
          const op = ops[0]!;
          const r = await deps.runner.run(op).catch((): RunResult => ({ status: "offline" }));
          if (r.status === "offline") break;
          if (r.status === "sent") report.sent++;
          else report.rejected.push({ op, message: r.message });
          ops = ops.slice(1);
          await deps.store.save(ops);
          notify(ops);
        }
        report.waiting = ops.length;
        return report;
      })().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    subscribe(listener: (ops: QueuedOp[]) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return queue;
}

export type OfflineQueue = ReturnType<typeof createQueue>;
