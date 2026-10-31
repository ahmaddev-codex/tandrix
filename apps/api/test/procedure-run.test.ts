import { ProcedureRunResponse, type Job, type ProcedureDraft } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { GenerateResult } from "../src/procedure-generator";
import type { JobsRepo } from "../src/repos/jobs";
import {
  RUN_STALE_SECONDS,
  type ProcedureRun,
  type ProcedureRunsRepo,
} from "../src/repos/procedure-runs";
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
const JOB = "00000000-0000-4000-8000-000000000001";
const DRAFT: ProcedureDraft = {
  title: "Fit the cooler",
  parts: [],
  steps: [
    {
      order: 1,
      surface: "physical",
      title: "Press the pins home",
      instruction: "Press until they click.",
      partRefs: [],
      hazardTags: [],
      verification: "photo",
      expectedState: "Seated.",
      citation: { kind: "generic" },
    },
  ],
};

function memoryRuns(): ProcedureRunsRepo & { rows: Map<string, ProcedureRun> } {
  const rows = new Map<string, ProcedureRun>();
  return {
    rows,
    async claim(jobId) {
      const r = rows.get(jobId);
      const lost = r && Date.now() - Date.parse(r.startedAt) >= RUN_STALE_SECONDS * 1000;
      if (r?.status === "running" && !lost) return false;
      rows.set(jobId, {
        status: "running",
        message: null,
        citedSteps: null,
        startedAt: new Date().toISOString(),
      });
      return true;
    },
    async finish(jobId, o) {
      rows.set(jobId, {
        ...rows.get(jobId)!,
        status: o.status,
        message: o.status === "failed" ? o.message : null,
        citedSteps: o.status === "done" ? o.citedSteps : null,
      });
    },
    async get(jobId) {
      return rows.get(jobId) ?? null;
    },
  };
}

function setup(generate: () => Promise<GenerateResult>) {
  const procedures = memoryProcedures();
  const runs = memoryRuns();
  const job = { id: JOB, ownerId: A, assetId: null, procedureId: null, title: "Fit it" } as Job;
  const jobs = {
    async getForOwner(o: string, id: string) {
      if (o !== A || id !== JOB) return null;
      // save_procedure sets the job's procedure.
      const saved = procedures.saves.at(-1);
      return { job: { ...job, procedureId: saved?.procedureId ?? null }, steps: [] };
    },
  } as unknown as JobsRepo;
  let calls = 0;
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: "b" } : null),
    jobs,
    evidence: memoryEvidence(new Map([[JOB, A]])),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    procedureRuns: runs,
    stepState: memoryStepState(() => JOB),
    procedureGenerator: {
      generate() {
        calls++;
        return generate();
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const start = (token = "a") =>
    app.request(`/jobs/${JOB}/procedure/start`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ allowGeneric: true }),
    });
  const run = async () => {
    const res = await app.request(`/jobs/${JOB}/procedure/run`, {
      headers: { authorization: "Bearer a" },
    });
    return ProcedureRunResponse.parse(await res.json());
  };
  /** Polls as the apps do, until the run has an answer. */
  const answer = async () => {
    for (let i = 0; i < 200; i++) {
      const r = await run();
      if (r.status !== "writing") return r;
      await new Promise((f) => setTimeout(f, 2));
    }
    throw new Error("still writing");
  };
  return { start, run, answer, runs, calls: () => calls };
}

describe("writing the steps in the background", () => {
  it("answers straight away, then has the steps", async () => {
    const s = setup(async () => ({ status: "drafted", draft: DRAFT }));
    expect(await s.run()).toEqual({ status: "idle" });
    const res = await s.start();
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: "writing" });
    expect(await s.answer()).toMatchObject({ status: "created", citedSteps: 0 });
  });

  it("starting again while it writes finds the same run and writes once", async () => {
    let finish!: (r: GenerateResult) => void;
    const s = setup(() => new Promise((r) => (finish = r)));
    await s.start();
    const again = await s.start();
    expect(again.status).toBe(202);
    expect(s.calls()).toBe(1);
    finish({ status: "drafted", draft: DRAFT });
    await s.answer();
    // After it's done, starting returns the steps rather than writing more.
    const after = await s.start();
    expect(after.status).toBe(200);
    expect(await after.json()).toMatchObject({ status: "created" });
    expect(s.calls()).toBe(1);
  });

  it("says why when the model can't, and can be tried again", async () => {
    let answerWith: GenerateResult = { status: "unavailable", message: "Try again in a minute." };
    const s = setup(async () => answerWith);
    await s.start();
    expect(await s.answer()).toEqual({ status: "unavailable", message: "Try again in a minute." });
    answerWith = { status: "drafted", draft: DRAFT };
    await s.start();
    expect(await s.answer()).toMatchObject({ status: "created" });
    expect(s.calls()).toBe(2);
  });

  it("reports a crash in the work as a message, not a hang", async () => {
    const s = setup(async () => {
      throw new Error("boom");
    });
    await s.start();
    const r = await s.answer();
    expect(r.status).toBe("unavailable");
    expect(JSON.stringify(r)).not.toContain("boom");
  });

  it("treats a run lost to a restart as failed, and lets it be claimed again", async () => {
    const s = setup(async () => ({ status: "drafted", draft: DRAFT }));
    s.runs.rows.set(JOB, {
      status: "running",
      message: null,
      citedSteps: null,
      startedAt: new Date(Date.now() - (RUN_STALE_SECONDS + 5) * 1000).toISOString(),
    });
    expect((await s.run()).status).toBe("unavailable");
    await s.start();
    expect(await s.answer()).toMatchObject({ status: "created" });
  });

  it("is only for the job's owner", async () => {
    const s = setup(async () => ({ status: "drafted", draft: DRAFT }));
    expect((await s.start("b")).status).toBe(404);
    expect(s.calls()).toBe(0);
  });
});
