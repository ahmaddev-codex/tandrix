import { describe, expect, it } from "vitest";
import {
  transitionStep,
  type StepContext,
  type StepEvent,
  type StepState,
  type TransitionResult,
} from "../src";

const T0 = "2026-10-26T10:00:00Z";
const T1 = "2026-10-26T10:05:00Z";
const BEFORE = "2026-10-26T09:59:00Z";

const state = (over: Partial<StepState> = {}): StepState => ({
  status: "todo",
  startedAt: null,
  statusEvidenceId: null,
  lastCheck: null,
  ...over,
});
const started = (over: Partial<StepState> = {}) =>
  state({ status: "in_progress", startedAt: T0, ...over });

const photo: StepContext = { verification: "photo", hazardTags: [], confirmedGates: [] };
const userConfirm: StepContext = {
  verification: "user_confirm",
  hazardTags: [],
  confirmedGates: [],
};
const torque: StepContext = {
  verification: "measurement",
  hazardTags: [],
  confirmedGates: [],
  measurement: { target: 25, tolerance: 1, unit: "Nm" },
};

const check = (result: "pass" | "fail" | "not_verifiable", capturedAt = T1): StepEvent => ({
  type: "check",
  result,
  evidenceId: "ev-1",
  evidenceCapturedAt: capturedAt,
  at: T1,
});

const expectOk = (r: TransitionResult) => {
  if (!r.ok) throw new Error(`Expected ok, got ${r.code}: ${r.message}`);
  return r.state;
};
const expectErr = (r: TransitionResult) => {
  if (r.ok) throw new Error(`Expected error, got ${r.state.status}`);
  return r;
};

describe("start", () => {
  it("moves todo to in_progress and records the start time", () => {
    const s = expectOk(transitionStep(state(), { type: "start", at: T0 }, photo));
    expect(s).toMatchObject({ status: "in_progress", startedAt: T0 });
  });

  it("requires every safety gate for the step's hazards", () => {
    const ctx: StepContext = {
      ...photo,
      hazardTags: ["electrical_isolation", "pressure"],
      confirmedGates: ["isolate_power"],
    };
    const e = expectErr(transitionStep(state(), { type: "start", at: T0 }, ctx));
    expect(e.code).toBe("safety_gate_required");
    expect(e.gates).toEqual(["release_pressure"]);
    const ok = expectOk(
      transitionStep(
        state(),
        { type: "start", at: T0 },
        { ...ctx, confirmedGates: ["isolate_power", "release_pressure"] },
      ),
    );
    expect(ok.status).toBe("in_progress");
  });

  it("refuses live electrical work", () => {
    const e = expectErr(
      transitionStep(
        state(),
        { type: "start", at: T0 },
        { ...photo, hazardTags: ["live_electrical"] },
      ),
    );
    expect(e.code).toBe("refused");
  });

  it("can't start a blocked step", () => {
    expect(
      expectErr(transitionStep(state({ status: "blocked" }), { type: "start", at: T0 }, photo))
        .code,
    ).toBe("invalid_transition");
  });
});

describe("check", () => {
  it("verifies only on a pass, and records the evidence", () => {
    const s = expectOk(transitionStep(started(), check("pass"), photo));
    expect(s).toMatchObject({ status: "verified", statusEvidenceId: "ev-1", lastCheck: "pass" });
  });

  it("marks needs_attention on a fail, and a later pass verifies", () => {
    const failed = expectOk(transitionStep(started(), check("fail"), photo));
    expect(failed.status).toBe("needs_attention");
    expect(expectOk(transitionStep(failed, check("pass"), photo)).status).toBe("verified");
  });

  it("keeps the step open when a photo can't tell", () => {
    const s = expectOk(transitionStep(started(), check("not_verifiable"), photo));
    expect(s).toMatchObject({ status: "in_progress", lastCheck: "not_verifiable" });
  });

  it("rejects photos taken before the step started", () => {
    expect(expectErr(transitionStep(started(), check("pass", BEFORE), photo)).code).toBe(
      "stale_evidence",
    );
  });

  it("doesn't apply to user-confirmed or measurement steps", () => {
    expect(expectErr(transitionStep(started(), check("pass"), userConfirm)).code).toBe(
      "check_not_applicable",
    );
    expect(expectErr(transitionStep(started(), check("pass"), torque)).code).toBe(
      "check_not_applicable",
    );
  });

  it("can't check a step that hasn't started", () => {
    expect(expectErr(transitionStep(state(), check("pass"), photo)).code).toBe(
      "invalid_transition",
    );
  });
});

describe("confirm_done", () => {
  it("ends user-confirm steps at user_confirmed, never verified", () => {
    expect(
      expectOk(transitionStep(started(), { type: "confirm_done", at: T1 }, userConfirm)).status,
    ).toBe("user_confirmed");
  });

  it("needs a not_verifiable check before confirming a photo step", () => {
    expect(expectErr(transitionStep(started(), { type: "confirm_done", at: T1 }, photo)).code).toBe(
      "confirmation_not_allowed",
    );
    const nv = started({ lastCheck: "not_verifiable" });
    expect(expectOk(transitionStep(nv, { type: "confirm_done", at: T1 }, photo)).status).toBe(
      "user_confirmed",
    );
  });

  it("won't let a user confirm over a failed check", () => {
    const failed = started({ status: "needs_attention", lastCheck: "fail" });
    const e = expectErr(transitionStep(failed, { type: "confirm_done", at: T1 }, photo));
    expect(e.code).toBe("confirmation_not_allowed");
    expect(e.message).toMatch(/check again|skip/);
  });

  it("checks measurements against the manual's tolerance", () => {
    expect(
      expectErr(transitionStep(started(), { type: "confirm_done", at: T1 }, torque)).code,
    ).toBe("measurement_required");
    const low = expectErr(
      transitionStep(started(), { type: "confirm_done", at: T1, measuredValue: 18 }, torque),
    );
    expect(low.code).toBe("measurement_out_of_range");
    expect(low.message).toContain("25 Nm");
    expect(
      expectOk(
        transitionStep(started(), { type: "confirm_done", at: T1, measuredValue: 24.5 }, torque),
      ).status,
    ).toBe("user_confirmed");
  });
});

describe("skip, block, reopen", () => {
  it("skips with a reason kept for the report", () => {
    const s = expectOk(
      transitionStep(started(), { type: "skip", reason: "Fitted at the factory", at: T1 }, photo),
    );
    expect(s).toMatchObject({ status: "skipped", note: "Fitted at the factory" });
  });

  it("can't skip a finished step", () => {
    expect(
      expectErr(
        transitionStep(state({ status: "verified" }), { type: "skip", reason: "x", at: T1 }, photo),
      ).code,
    ).toBe("invalid_transition");
  });

  it("blocks and unblocks back to todo", () => {
    const b = expectOk(
      transitionStep(started(), { type: "block", reason: "Missing O-ring", at: T1 }, photo),
    );
    expect(b.status).toBe("blocked");
    expect(expectOk(transitionStep(b, { type: "unblock", at: T1 }, photo)).status).toBe("todo");
  });

  it("reopening a verified step discards its evidence", () => {
    const v = started({ status: "verified", statusEvidenceId: "ev-1", lastCheck: "pass" });
    const r = expectOk(transitionStep(v, { type: "reopen", at: T1 }, photo));
    expect(r).toEqual({
      status: "in_progress",
      startedAt: T1,
      statusEvidenceId: null,
      lastCheck: null,
    });
    // The old photo predates the reopen, so it can't re-verify.
    expect(expectErr(transitionStep(r, check("pass", T0), photo)).code).toBe("stale_evidence");
  });
});

describe("no shortcut to verified", () => {
  const events: StepEvent[] = [
    { type: "start", at: T0 },
    { type: "confirm_done", at: T1, measuredValue: 25 },
    { type: "skip", reason: "x", at: T1 },
    { type: "block", reason: "x", at: T1 },
    { type: "unblock", at: T1 },
    { type: "reopen", at: T1 },
    check("fail"),
    check("not_verifiable"),
  ];
  const statuses = [
    "todo",
    "in_progress",
    "needs_attention",
    "user_confirmed",
    "blocked",
    "skipped",
  ] as const;
  for (const status of statuses) {
    for (const ctx of [photo, userConfirm, torque]) {
      it(`${status} never becomes verified without a passing check (${ctx.verification})`, () => {
        for (const ev of events) {
          const r = transitionStep(started({ status, lastCheck: "not_verifiable" }), ev, ctx);
          if (r.ok) expect(r.state.status).not.toBe("verified");
        }
      });
    }
  }
});
