import { describe, expect, it } from "vitest";
import { createBoard, type AgentTask } from "../src/renderer/lib/agents";

const tick = () => new Promise((r) => setTimeout(r, 0));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("agent board", () => {
  it("runs screen tasks one after another, and each to the end", async () => {
    const order: string[] = [];
    const gates: Record<string, ReturnType<typeof deferred<void>>> = {};
    const finished: AgentTask[] = [];
    const board = createBoard({
      runScreen: async (task) => {
        order.push(`start ${task}`);
        gates[task] = deferred<void>();
        await gates[task]!.promise;
        order.push(`end ${task}`);
        return { status: "done", reply: `Did ${task}` };
      },
      background: async () => ({ status: "unavailable", message: "x" }),
      onChange: () => undefined,
      onFinish: (t) => finished.push(t),
    });
    board.addScreen("A");
    board.addScreen("B");
    await tick();
    expect(order).toEqual(["start A"]);
    gates.A!.resolve();
    await tick();
    await tick();
    expect(order).toEqual(["start A", "end A", "start B"]);
    gates.B!.resolve();
    await tick();
    await tick();
    expect(finished.map((t) => t.result)).toEqual(["Did A", "Did B"]);
  });

  it("runs background tasks at the same time as screen work, a few at once", async () => {
    const running: string[] = [];
    let peak = 0;
    const gates: Array<() => void> = [];
    const board = createBoard({
      runScreen: () => new Promise(() => undefined),
      background: (task) => {
        running.push(task);
        peak = Math.max(peak, running.length);
        return new Promise((resolve) =>
          gates.push(() => {
            running.splice(running.indexOf(task), 1);
            resolve({ status: "done", spoken: `${task} done`, detail: "", sources: [] });
          }),
        );
      },
      onChange: () => undefined,
      onFinish: () => undefined,
      parallel: 2,
    });
    board.addScreen("screen work");
    for (const t of ["one", "two", "three"]) board.addBackground(t);
    await tick();
    expect(board.screenBusy()).toBe(true);
    expect(running).toEqual(["one", "two"]);
    gates.shift()!();
    await tick();
    await tick();
    expect(running).toEqual(["two", "three"]);
    expect(peak).toBe(2);
  });

  it("passes corrections to the running screen task and stops on request", async () => {
    let seen: string[] = [];
    let stopped = false;
    const gate = deferred<void>();
    const board = createBoard({
      runScreen: async (_t, io) => {
        await gate.promise;
        seen = io.steer();
        stopped = io.stopped();
        return { status: "stopped", reply: "Stopped." };
      },
      background: async () => ({ status: "unavailable", message: "x" }),
      onChange: () => undefined,
      onFinish: () => undefined,
    });
    expect(board.steer("too early")).toBe(false);
    board.addScreen("Book it");
    board.addScreen("Then this");
    await tick();
    expect(board.steer("No, Friday")).toBe(true);
    board.stopScreen();
    gate.resolve();
    await tick();
    await tick();
    expect(seen).toEqual(["No, Friday"]);
    expect(stopped).toBe(true);
    expect(board.list().map((t) => t.status)).toEqual(["stopped", "stopped"]);
  });
});
