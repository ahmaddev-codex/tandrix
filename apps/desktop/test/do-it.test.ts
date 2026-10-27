import type { DesktopAction } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { ANNOUNCE_MS, runBatch, type BatchDeps } from "../src/main/do-it";
import type { DriverCommand } from "../src/main/input-driver";

const geometry = {
  displayId: "1",
  imageWidth: 1280,
  imageHeight: 800,
  originX: 100,
  originY: 0,
  displayWidth: 2560,
  displayHeight: 1600,
};

function deps(over: Partial<BatchDeps> = {}) {
  let t = 0;
  const driven: DriverCommand[] = [];
  const announced: Array<string | undefined> = [];
  const asked: string[] = [];
  const d: BatchDeps = {
    mode: () => "do",
    drive: async (cmd) => {
      driven.push(cmd);
      return cmd.op === "focus" ? { ok: true, secure: false } : { ok: true };
    },
    confirm: async (p) => {
      asked.push(p);
      return true;
    },
    announce: (_at, c) => announced.push(c),
    waitOrStop: async (ms) => {
      t += ms;
      return false;
    },
    stopped: () => false,
    now: () => t,
    history: [],
    ...over,
  };
  return { d, driven, announced, asked };
}

const batch = (actions: DesktopAction[], intent = "Open settings", safetyChecks = []) => ({
  actions,
  geometry,
  intent,
  safetyChecks,
});

describe("runBatch", () => {
  it("maps screenshot pixels to the display, announces, then acts", async () => {
    const s = deps();
    const r = await runBatch(batch([{ type: "click", x: 640, y: 400, button: "left" }]), s.d);
    expect(r).toEqual({ status: "ran", ran: 1, acknowledged: [] });
    expect(s.driven).toEqual([{ op: "click", x: 1380, y: 800, button: "left", count: 1 }]);
    expect(s.announced[0]).toBe("Clicking here");
  });

  it("does nothing in Show me mode", async () => {
    const s = deps({ mode: () => "show" });
    const r = await runBatch(batch([{ type: "click", x: 1, y: 1, button: "left" }]), s.d);
    expect(r.status).toBe("refused");
    expect(s.driven).toEqual([]);
  });

  it("stops when the user takes control during the announcement", async () => {
    const s = deps({ waitOrStop: async () => true });
    const r = await runBatch(
      batch([
        { type: "click", x: 1, y: 1, button: "left" },
        { type: "click", x: 2, y: 2, button: "left" },
      ]),
      s.d,
    );
    expect(r).toMatchObject({ status: "stopped", ran: 0 });
    expect(s.driven).toEqual([]);
  });

  it("asks before something sensitive and stops when told no", async () => {
    const s = deps({ confirm: async () => false });
    const r = await runBatch(
      batch([{ type: "click", x: 1, y: 1, button: "left" }], "Click Send to email the report"),
      s.d,
    );
    expect(r).toMatchObject({ status: "stopped" });
    expect(s.driven).toEqual([]);
  });

  it("puts the model's safety checks to the user before anything runs", async () => {
    const check = { id: "sc_1", code: "sensitive", message: "This deletes a file" };
    const s = deps();
    const r = await runBatch(
      { ...batch([{ type: "move", x: 1, y: 1 }]), safetyChecks: [check] },
      s.d,
    );
    expect(s.asked).toEqual(["This deletes a file"]);
    expect(r).toMatchObject({ status: "ran", acknowledged: [check] });
  });

  it("leaves the routine per-action check to the guard, and asks about any other", async () => {
    const routine = {
      id: "x".repeat(1200),
      code: "computer_action_requires_confirmation",
      message: "Review",
    };
    const other = { id: "sc_2", code: "sensitive_domain", message: "This site handles payments" };
    const s = deps();
    const r = await runBatch(
      { ...batch([{ type: "move", x: 1, y: 1 }]), safetyChecks: [routine, other] },
      s.d,
    );
    expect(s.asked).toEqual(["This site handles payments"]);
    expect(r).toMatchObject({ status: "ran", acknowledged: [routine, other] });
  });

  it("never types into a password field", async () => {
    const s = deps({
      drive: async (cmd) => (cmd.op === "focus" ? { ok: true, secure: true } : { ok: true }),
    });
    const r = await runBatch(batch([{ type: "type", text: "hunter2" }]), s.d);
    expect(r).toMatchObject({ status: "refused", message: expect.stringContaining("password") });
  });

  it("waits out the gap between actions instead of rushing", async () => {
    const s = deps();
    const r = await runBatch(
      batch([
        { type: "click", x: 1, y: 1, button: "left" },
        { type: "click", x: 2, y: 2, button: "left" },
      ]),
      s.d,
    );
    expect(r).toMatchObject({ status: "ran", ran: 2 });
    expect(s.d.history[1]! - s.d.history[0]!).toBeGreaterThanOrEqual(ANNOUNCE_MS);
  });
});
