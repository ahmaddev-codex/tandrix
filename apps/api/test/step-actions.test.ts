import {
  StepActionResponse,
  type Job,
  type JobStep,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { actionTime, clientSurface } from "../src/routes/steps";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryAssets,
  memoryEvidence,
  memoryProcedures,
  memoryStepState,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const id = (prefix: string, n: number) =>
  `00000000-0000-4000-8000-${prefix}${String(n).padStart(12 - prefix.length, "0")}`;
const PSTEP = [1, 2, 3, 4].map((n) => id("c", n));
const JSTEP = [1, 2, 3, 4].map((n) => id("e", n));

const base = {
  surface: "physical" as const,
  partRefs: [],
  expectedState: "Done.",
  citation: { kind: "generic" as const },
};
const DRAFT: ProcedureDraft = {
  title: "Service the pump",
  parts: [],
  steps: [
    {
      ...base,
      order: 1,
      title: "Open the casing",
      instruction: "Remove the casing bolts.",
      hazardTags: ["electrical_isolation", "pressure"],
      verification: "user_confirm",
    },
    {
      ...base,
      order: 2,
      title: "Rewire the motor",
      instruction: "Connect the motor leads to the supply.",
      hazardTags: ["live_electrical"],
      verification: "user_confirm",
    },
    {
      ...base,
      order: 3,
      title: "Torque the casing bolts",
      instruction: "Tighten the bolts in a cross pattern.",
      hazardTags: [],
      verification: "measurement",
      measurement: { quantity: "torque", unit: "Nm", target: 25, tolerance: 2 },
    },
    {
      ...base,
      order: 4,
      title: "Fit the impeller",
      instruction: "Slide the impeller on.",
      hazardTags: [],
      verification: "photo",
    },
  ],
};

const job: Job = {
  id: JOB,
  ownerId: A,
  assetId: null,
  procedureId: PROC,
  title: "Service",
  status: "active",
  currentStepId: null,
  activeSurface: "phone",
  controlMode: "show",
  language: "en",
  createdAt: "2026-10-26T10:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
};

async function setup() {
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "x|y",
    manualId: null,
    draft: DRAFT,
    partIds: new Map(),
    stepIds: PSTEP,
    surface: "phone",
    event: {},
  });
  const stepState = memoryStepState(() => JOB);
  JSTEP.forEach((sid, i) =>
    stepState.steps.set(sid, {
      id: sid,
      jobId: JOB,
      procedureStepId: PSTEP[i]!,
      status: "todo",
      statusEvidenceId: null,
      startedAt: null,
      updatedAt: "2026-10-26T10:00:00.000Z",
      updatedBySurface: "phone",
    } satisfies JobStep),
  );
  // The job's steps are whatever the transitions last saved.
  const jobs = {
    async getForOwner(ownerId: string, jobId: string) {
      return ownerId === A && jobId === JOB ? { job, steps: [...stepState.steps.values()] } : null;
    },
  } as unknown as JobsRepo;
  let clock = Date.UTC(2026, 9, 26, 10);
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    stepState,
    now: () => (clock += 1000),
    corsOrigins: [],
    log: () => {},
  });
  const act = async (step: number, body: object, token = "a") => {
    const res = await app.request(`/jobs/${JOB}/steps/${JSTEP[step - 1]}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return { res, body: res.ok ? StepActionResponse.parse(await res.json()) : null };
  };
  return { act, stepState };
}

describe("safety gates", () => {
  it("won't start a hazardous step until every gate is confirmed", async () => {
    const s = await setup();
    const first = await s.act(1, { action: "start" });
    expect(first.body).toMatchObject({
      status: "rejected",
      code: "safety_gate_required",
      gates: ["isolate_power", "release_pressure"],
    });
    expect(s.stepState.transitions).toEqual([]);

    const one = await s.act(1, { action: "confirm_safety", gate: "isolate_power" });
    expect(one.body).toMatchObject({ status: "applied" });
    const still = await s.act(1, { action: "start" });
    expect(still.body).toMatchObject({ code: "safety_gate_required", gates: ["release_pressure"] });

    await s.act(1, { action: "confirm_safety", gate: "release_pressure" });
    const started = await s.act(1, { action: "start" });
    expect(started.body).toMatchObject({ status: "applied", step: { status: "in_progress" } });
    if (started.body?.status !== "applied") throw new Error();
    expect(started.body.confirmations.map((x) => x.gate)).toEqual([
      "isolate_power",
      "release_pressure",
    ]);
    expect(s.stepState.transitions[0]).toMatchObject({
      fromStatus: "todo",
      event: { action: "start" },
    });
  });

  it("confirms a gate once, and only gates the step needs", async () => {
    const s = await setup();
    await s.act(1, { action: "confirm_safety", gate: "isolate_power" });
    await s.act(1, { action: "confirm_safety", gate: "isolate_power" });
    expect(s.stepState.confirmationsList).toHaveLength(1);
    expect((await s.act(1, { action: "confirm_safety", gate: "lifting_plan" })).res.status).toBe(
      400,
    );
    expect((await s.act(3, { action: "confirm_safety", gate: "isolate_power" })).res.status).toBe(
      400,
    );
  });

  it("refuses live electrical work, with nothing to confirm", async () => {
    const s = await setup();
    const start = await s.act(2, { action: "start" });
    expect(start.body).toMatchObject({ status: "rejected", code: "refused" });
    expect(start.body?.status === "rejected" && start.body.message).toMatch(
      /qualified electrician/,
    );
    const gate = await s.act(2, { action: "confirm_safety", gate: "isolate_power" });
    expect(gate.body).toMatchObject({ status: "rejected", code: "refused" });
    expect(s.stepState.confirmationsList).toEqual([]);
  });
});

describe("finishing steps", () => {
  it("checks a measured value against the manual", async () => {
    const s = await setup();
    await s.act(3, { action: "start" });
    expect((await s.act(3, { action: "confirm_done" })).body).toMatchObject({
      code: "measurement_required",
    });
    const off = await s.act(3, { action: "confirm_done", measuredValue: 30 });
    expect(off.body).toMatchObject({ code: "measurement_out_of_range" });
    expect(off.body?.status === "rejected" && off.body.message).toContain("25 Nm");
    const ok = await s.act(3, { action: "confirm_done", measuredValue: 26 });
    expect(ok.body).toMatchObject({ status: "applied", step: { status: "user_confirmed" } });
    expect(s.stepState.transitions.at(-1)?.event).toMatchObject({ measured_value: 26 });
  });

  it("asks for a photo check before a photo step can be confirmed", async () => {
    const s = await setup();
    await s.act(4, { action: "start" });
    expect((await s.act(4, { action: "confirm_done" })).body).toMatchObject({
      code: "confirmation_not_allowed",
    });
    // After a check that a photo can't settle, the user may confirm it.
    const started = s.stepState.steps.get(JSTEP[3]!)!.startedAt!;
    s.stepState.checks.push({ jobStepId: JSTEP[3]!, result: "not_verifiable", at: started });
    expect((await s.act(4, { action: "confirm_done" })).body).toMatchObject({
      status: "applied",
      step: { status: "user_confirmed" },
    });
  });

  it("skips with a reason and reopens with a fresh start", async () => {
    const s = await setup();
    const skipped = await s.act(3, {
      action: "skip",
      reason: "Bolts already torqued by the fitter",
    });
    expect(skipped.body).toMatchObject({
      step: { status: "skipped", note: "Bolts already torqued by the fitter" },
    });
    const reopened = await s.act(3, { action: "reopen" });
    expect(reopened.body).toMatchObject({ step: { status: "in_progress" } });
    expect((await s.act(3, { action: "skip" })).res.status).toBe(400);
  });

  it("hides other users' steps", async () => {
    const s = await setup();
    expect((await s.act(1, { action: "start" }, "b")).res.status).toBe(404);
  });
});

describe("actions replayed from the offline queue", () => {
  it("keep when they happened, within a day and never in the future", () => {
    const now = Date.UTC(2026, 9, 26, 12);
    expect(actionTime("2026-10-26T11:30:00.000Z", now)).toBe("2026-10-26T11:30:00.000Z");
    expect(actionTime("2026-10-26T13:00:00.000Z", now)).toBe("2026-10-26T12:00:00.000Z");
    expect(actionTime("2026-10-24T11:00:00.000Z", now)).toBe("2026-10-26T12:00:00.000Z");
    expect(actionTime(undefined, now)).toBe("2026-10-26T12:00:00.000Z");
  });

  it("start a step at the time it was started offline", async () => {
    const s = await setup();
    const r = await s.act(3, { action: "start", occurredAt: "2026-10-26T09:59:30.000Z" });
    expect(r.body).toMatchObject({
      status: "applied",
      step: { startedAt: "2026-10-26T09:59:30.000Z" },
    });
  });
});

describe("clientSurface", () => {
  it("takes a known surface from the header and defaults to the phone", () => {
    expect(clientSurface("desktop")).toBe("desktop");
    expect(clientSurface("glasses")).toBe("glasses");
    expect(clientSurface(undefined)).toBe("phone");
    expect(clientSurface("toaster")).toBe("phone");
  });
});
