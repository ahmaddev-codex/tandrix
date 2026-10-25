import {
  CheckStepResponse,
  StepActionResponse,
  type Job,
  type JobStep,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import type { CheckOutcome } from "../src/step-checker";
import {
  memoryAssets,
  memoryEvidence,
  memoryProcedures,
  memoryStepState,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";
import { PNG } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const JOB = "00000000-0000-4000-8000-000000000001";
const OTHER_JOB = "00000000-0000-4000-8000-000000000002";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const PSTEP = ["c001", "c002"].map((x) => `00000000-0000-4000-8000-00000000${x}`);
const JSTEP = ["e001", "e002"].map((x) => `00000000-0000-4000-8000-00000000${x}`);

const base = {
  surface: "physical" as const,
  partRefs: [],
  hazardTags: [],
  citation: { kind: "generic" as const },
};
const DRAFT: ProcedureDraft = {
  title: "Assemble",
  parts: [],
  steps: [
    {
      ...base,
      order: 1,
      title: "Fit the impeller",
      instruction: "Slide it on.",
      verification: "photo",
      expectedState: "Impeller seated against the shoulder.",
    },
    {
      ...base,
      order: 2,
      title: "Torque the bolts",
      instruction: "Tighten them.",
      verification: "measurement",
      measurement: { quantity: "torque", unit: "Nm", target: 25 },
      expectedState: "At 25 Nm.",
    },
  ],
};

async function setup(answers: CheckOutcome[]) {
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
  const job = { id: JOB, ownerId: A, assetId: null, procedureId: PROC } as Job;
  const jobs = {
    async getForOwner(o: string, id: string) {
      return o === A && id === JOB ? { job, steps: [...stepState.steps.values()] } : null;
    },
  } as unknown as JobsRepo;
  const evidence = memoryEvidence(
    new Map([
      [JOB, A],
      [OTHER_JOB, A],
    ]),
  );
  const storage = memoryStorage();
  const checked: string[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : null),
    jobs,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    stepState,
    checker: {
      async check(input) {
        checked.push(input.expectedState);
        return answers.shift() ?? { status: "unavailable", message: "No answer scripted." };
      },
    },
    // Steps start at 10:00 on 26 Oct.
    now: () => Date.UTC(2026, 9, 26, 10),
    corsOrigins: [],
    log: () => {},
  });
  const post = (path: string, body: object) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer a" },
      body: JSON.stringify(body),
    });
  const photo = async (capturedAt: string, opts: { job?: string; uploaded?: boolean } = {}) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId: opts.job ?? JOB,
      jobStepId: JSTEP[0]!,
      kind: "photo",
      surface: "phone",
      storageKey: `${A}/${JOB}/${crypto.randomUUID()}.png`,
      mimeType: "image/png",
      byteSize: PNG.length,
      width: 10,
      height: 10,
      capturedAt,
    });
    await storage.put(ev.storageKey, PNG, "image/png");
    return opts.uploaded === false ? ev : evidence.markUploaded(ev.id, PNG.length);
  };
  const check = async (step: number, evidenceId: string) => {
    const res = await post(`/jobs/${JOB}/steps/${JSTEP[step - 1]}/check`, { evidenceId });
    return { res, body: res.ok ? CheckStepResponse.parse(await res.json()) : null };
  };
  const act = async (step: number, body: object) =>
    StepActionResponse.parse(
      await (await post(`/jobs/${JOB}/steps/${JSTEP[step - 1]}/actions`, body)).json(),
    );
  return { check, act, photo, checked, stepState };
}

const LATER = "2026-10-26T11:00:00.000Z";
const EARLIER = "2026-10-26T09:00:00.000Z";

describe("POST /jobs/:id/steps/:stepId/check", () => {
  it("needs attention on a wrong stage, then verifies on a right one", async () => {
    const s = await setup([
      {
        status: "judged",
        result: "fail",
        reason: "There's a gap at the shoulder.",
        whatToShowNext: "Side view.",
      },
      { status: "judged", result: "pass", reason: "Seated against the shoulder." },
    ]);
    await s.act(1, { action: "start" });

    const wrong = await s.check(1, (await s.photo(LATER)).id);
    expect(wrong.body).toMatchObject({
      status: "checked",
      check: {
        result: "fail",
        reason: "There's a gap at the shoulder.",
        whatToShowNext: "Side view.",
      },
      step: { status: "needs_attention" },
    });

    const right = await s.photo(LATER);
    const ok = await s.check(1, right.id);
    expect(ok.body).toMatchObject({
      status: "checked",
      step: { status: "verified", statusEvidenceId: right.id },
    });
    expect(s.checked).toEqual([
      "Impeller seated against the shoulder.",
      "Impeller seated against the shoulder.",
    ]);
  });

  it("lets the user confirm what a photo can't show", async () => {
    const s = await setup([
      { status: "judged", result: "not_verifiable", reason: "Fit is inside the casing." },
    ]);
    await s.act(1, { action: "start" });
    expect((await s.act(1, { action: "confirm_done" })).status).toBe("rejected");
    const r = await s.check(1, (await s.photo(LATER)).id);
    expect(r.body).toMatchObject({
      step: { status: "in_progress" },
      check: { result: "not_verifiable" },
    });
    expect(await s.act(1, { action: "confirm_done" })).toMatchObject({
      status: "applied",
      step: { status: "user_confirmed" },
    });
  });

  it("turns down old photos, inactive steps and measured steps without a model call", async () => {
    const s = await setup([]);
    expect((await s.check(1, (await s.photo(LATER)).id)).body).toMatchObject({
      code: "invalid_transition",
    });
    await s.act(1, { action: "start" });
    expect((await s.check(1, (await s.photo(EARLIER)).id)).body).toMatchObject({
      code: "stale_evidence",
    });
    await s.act(2, { action: "start" });
    expect((await s.check(2, (await s.photo(LATER)).id)).body).toMatchObject({
      code: "check_not_applicable",
    });
    expect(s.checked).toEqual([]);
  });

  it("passes on the fallback and leaves the step alone when the model can't help", async () => {
    const s = await setup([{ status: "unavailable", message: "Try again in a minute." }]);
    await s.act(1, { action: "start" });
    const r = await s.check(1, (await s.photo(LATER)).id);
    expect(r.body).toEqual({ status: "unavailable", message: "Try again in a minute." });
    expect(s.stepState.steps.get(JSTEP[0]!)!.status).toBe("in_progress");
    expect(s.stepState.checks).toEqual([]);
  });

  it("only takes the job's own uploaded photos", async () => {
    const s = await setup([]);
    await s.act(1, { action: "start" });
    expect((await s.check(1, (await s.photo(LATER, { job: OTHER_JOB })).id)).res.status).toBe(404);
    expect((await s.check(1, (await s.photo(LATER, { uploaded: false })).id)).res.status).toBe(404);
  });
});
