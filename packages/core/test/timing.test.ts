import { describe, expect, it } from "vitest";
import { replyClock, taskMeter, timingLine, type ReplyTiming } from "../src/timing";

describe("reply clock", () => {
  it("lets the voice take a reply over, so the reply ending doesn't end it", () => {
    const out: ReplyTiming[] = [];
    const c = replyClock((t) => out.push(t));
    c.start("typed");
    c.mark("answered");
    const voice = c.take();
    c.end();
    expect(out).toHaveLength(0);
    voice!.mark("sounding");
    voice!.end();
    expect(Object.keys(out[0]!.stages)).toEqual(["answered", "sounding"]);
  });
});

describe("task meter", () => {
  it("adds up where a task's time went, counting model turns", async () => {
    let t = 0;
    const m = taskMeter(() => t);
    const wait = (ms: number) => async () => {
      t += ms;
      return ms;
    };
    await m.time("looking", wait(50));
    await m.time("model", wait(2000));
    await m.time("acting", wait(300));
    await m.time("model", wait(1500));
    await m.time("model", wait(400), false);
    await expect(m.time("acting", () => Promise.reject(new Error("no")))).rejects.toThrow();
    expect(m.end("done")).toEqual({
      kind: "task",
      total: 4250,
      turns: 2,
      model: 3900,
      acting: 300,
      looking: 50,
      status: "done",
    });
  });
});

describe("timing log line", () => {
  it("keeps a task's numbers and status only", () => {
    expect(
      timingLine({
        kind: "task",
        total: 9000,
        turns: 3,
        model: 7000,
        acting: 900,
        looking: 200,
        status: "done",
        task: "email my boss",
      }),
    ).toEqual({
      event: "task_timing",
      status: "done",
      total: 9000,
      turns: 3,
      model: 7000,
      acting: 900,
      looking: 200,
    });
  });

  it("refuses a task timing with words where numbers go, or an unknown status", () => {
    const ok = {
      kind: "task",
      total: 1,
      turns: 1,
      model: 1,
      acting: 1,
      looking: 1,
      status: "done",
    };
    expect(timingLine({ ...ok, status: "email sent to Sam" })).toBeNull();
    expect(timingLine({ ...ok, turns: "3" })).toBeNull();
    expect(timingLine({ ...ok, model: 1.5 })).toBeNull();
  });
});
