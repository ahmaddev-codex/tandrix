import { EventEmitter } from "node:events";
import type { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";
import { workerPageRenderer } from "../src/pdf-render";
import type { RenderReply, WorkerRequest, WorkerResponse } from "../src/pdf-render-worker";

class FakeWorker extends EventEmitter {
  jobs: WorkerRequest[] = [];
  terminated = false;
  postMessage = (msg: WorkerRequest) => {
    this.jobs.push(msg);
  };
  terminate = async () => {
    this.terminated = true;
  };
  reply(id: number, reply: RenderReply) {
    this.emit("message", { id, reply } satisfies WorkerResponse);
  }
}

const ok = (width = 100): RenderReply => ({
  ok: true,
  jpeg: new Uint8Array([1, 2, 3]),
  width,
  height: 140,
});
const pdf = (fill: number) => new Uint8Array(9000).fill(fill);

describe("workerPageRenderer", () => {
  it("renders through a pooled worker and dedupes identical inflight renders", async () => {
    const workers: FakeWorker[] = [];
    const pooled = workerPageRenderer(1000, 2, () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
    const bytes = pdf(7);
    const [p1, p2] = [pooled.render(bytes, 1), pooled.render(bytes, 1)];
    await Promise.resolve();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.jobs).toHaveLength(1);
    workers[0]!.reply(workers[0]!.jobs[0]!.id, ok(120));
    expect(await p1).toMatchObject({ width: 120, height: 140 });
    expect(await p2).toMatchObject({ width: 120 });
    // A later render reuses the warm worker.
    const p3 = pooled.render(bytes, 2);
    await Promise.resolve();
    workers[0]!.reply(workers[0]!.jobs[1]!.id, ok());
    await p3;
    expect(workers).toHaveLength(1);
  });

  it("queues renders past the pool size", async () => {
    const workers: FakeWorker[] = [];
    const renderer = workerPageRenderer(1000, 1, () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
    const p1 = renderer.render(pdf(7), 1);
    const p2 = renderer.render(pdf(8), 1);
    await Promise.resolve();
    expect(workers).toHaveLength(1);
    expect(workers[0]!.jobs).toHaveLength(1);
    workers[0]!.reply(workers[0]!.jobs[0]!.id, ok());
    await p1;
    expect(workers[0]!.jobs).toHaveLength(2);
    workers[0]!.reply(workers[0]!.jobs[1]!.id, { ok: false, reason: "no_page" });
    expect(await p2).toBeNull();
  });

  it("times out a hung render and replaces the worker", async () => {
    const workers: FakeWorker[] = [];
    const renderer = workerPageRenderer(5, 1, () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    });
    await expect(renderer.render(pdf(7), 1)).rejects.toThrow(/took too long/);
    expect(workers[0]!.terminated).toBe(true);
    const p = renderer.render(pdf(7), 1);
    await Promise.resolve();
    expect(workers).toHaveLength(2);
    workers[1]!.reply(workers[1]!.jobs[0]!.id, ok());
    expect((await p)?.width).toBe(100);
  });
});
