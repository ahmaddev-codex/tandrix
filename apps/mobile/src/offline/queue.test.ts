import { describe, expect, it } from "vitest";
import { createQueue, type QueuedOp, type RunResult } from "./queue";

function setup(script: Array<RunResult | "throw"> = []) {
  let saved: QueuedOp[] = [];
  let n = 0;
  const ran: string[] = [];
  const queue = createQueue({
    store: {
      async load() {
        return saved;
      },
      async save(ops) {
        saved = ops;
      },
    },
    runner: {
      async run(op) {
        ran.push(op.kind === "action" ? op.body.action : "photo");
        const next = script.shift() ?? { status: "sent" };
        if (next === "throw") throw new Error("network");
        return next;
      },
    },
    newId: () => `op-${++n}`,
    now: () => new Date("2026-10-26T10:00:00Z"),
  });
  return { queue, ran, saved: () => saved };
}

const action = (action: "start" | "confirm_done", jobStepId = "s1") =>
  ({ kind: "action", jobId: "j1", jobStepId, body: { action } }) as const;

describe("offline queue", () => {
  it("sends in the order the work was done", async () => {
    const s = setup();
    await s.queue.enqueue(action("start"));
    await s.queue.enqueue(action("confirm_done"));
    const report = await s.queue.flush();
    expect(s.ran).toEqual(["start", "confirm_done"]);
    expect(report).toEqual({ sent: 2, rejected: [], waiting: 0 });
    expect(s.saved()).toEqual([]);
  });

  it("stops at the first op that can't reach the API, so nothing overtakes it", async () => {
    const s = setup([{ status: "sent" }, { status: "offline" }]);
    await s.queue.enqueue(action("start"));
    await s.queue.enqueue(action("confirm_done"));
    await s.queue.enqueue(action("start", "s2"));
    const report = await s.queue.flush();
    expect(s.ran).toEqual(["start", "confirm_done"]);
    expect(report.waiting).toBe(2);
    expect(s.saved().map((o) => o.kind === "action" && o.body.action)).toEqual([
      "confirm_done",
      "start",
    ]);
  });

  it("treats a thrown error as offline and keeps the op", async () => {
    const s = setup(["throw"]);
    await s.queue.enqueue(action("start"));
    expect((await s.queue.flush()).waiting).toBe(1);
    expect(s.saved()).toHaveLength(1);
  });

  it("drops what the server turned down and says why", async () => {
    const s = setup([{ status: "rejected", message: "Confirm the safety steps first." }]);
    await s.queue.enqueue(action("start"));
    await s.queue.enqueue(action("confirm_done"));
    const report = await s.queue.flush();
    expect(report.rejected).toEqual([
      {
        op: expect.objectContaining({ kind: "action" }),
        message: "Confirm the safety steps first.",
      },
    ]);
    expect(report.sent).toBe(1);
    expect(s.saved()).toEqual([]);
  });

  it("runs one flush at a time", async () => {
    const s = setup();
    await s.queue.enqueue(action("start"));
    const [a, b] = await Promise.all([s.queue.flush(), s.queue.flush()]);
    expect(a).toBe(b);
    expect(s.ran).toEqual(["start"]);
  });

  it("lists what's waiting for a job or step, and tells subscribers", async () => {
    const s = setup();
    const seen: number[] = [];
    s.queue.subscribe((ops) => seen.push(ops.length));
    await s.queue.enqueue(action("start", "s1"));
    await s.queue.enqueue(action("start", "s2"));
    expect((await s.queue.pending({ jobStepId: "s2" })).map((o) => o.id)).toEqual(["op-2"]);
    expect((await s.queue.pending({ jobId: "other" })).length).toBe(0);
    await s.queue.flush();
    expect(seen).toEqual([1, 2, 1, 0]);
  });
});
