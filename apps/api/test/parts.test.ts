import {
  CorrectPartResponse,
  JobDetailResponse,
  PartsCheckResponse,
  type Job,
  type JobStep,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { PartsCheckOutcome } from "../src/parts-checker";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryAssets,
  memoryEvidence,
  memoryPartsChecks,
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
const PART = {
  impeller: "00000000-0000-4000-8000-00000000a001",
  seal: "00000000-0000-4000-8000-00000000a002",
  oring: "00000000-0000-4000-8000-00000000a003",
};
const PSTEP = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000c00${n}`);
const JSTEP = [1, 2, 3, 4].map((n) => `00000000-0000-4000-8000-00000000e00${n}`);

const step = (
  order: number,
  title: string,
  partRefs: string[],
): ProcedureDraft["steps"][number] => ({
  order,
  surface: "physical",
  title,
  instruction: title,
  partRefs,
  hazardTags: [],
  verification: "user_confirm",
  expectedState: "Done.",
  citation: { kind: "generic" },
});

const DRAFT: ProcedureDraft = {
  title: "Assemble",
  parts: [
    { ref: "P1", name: "Impeller", qty: 1 },
    { ref: "P2", name: "Mechanical seal", qty: 1 },
    { ref: "P3", name: "O-ring", qty: 1 },
  ],
  steps: [
    step(1, "Fit the impeller", ["P1"]),
    step(2, "Seat the O-ring", ["P3"]),
    step(3, "Clean up", []),
    step(4, "Close the casing", ["P3"]),
  ],
};

async function setup(
  opts: {
    answer?: PartsCheckOutcome;
    draft?: ProcedureDraft;
    statuses?: Array<Partial<JobStep>>;
  } = {},
) {
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "x|y",
    manualId: null,
    draft: opts.draft ?? DRAFT,
    partIds: new Map([
      ["P1", PART.impeller],
      ["P2", PART.seal],
      ["P3", PART.oring],
    ]),
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
      ...opts.statuses?.[i],
    } satisfies JobStep),
  );
  const job: Job = {
    id: JOB,
    ownerId: A,
    assetId: null,
    procedureId: PROC,
    title: "Assemble",
    status: "active",
    currentStepId: null,
    activeSurface: "phone",
    controlMode: "show",
    language: "en",
    createdAt: "2026-10-26T10:00:00.000Z",
    updatedAt: "2026-10-26T10:00:00.000Z",
  };
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
  const partsChecks = memoryPartsChecks(stepState.steps);
  let calls = 0;
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
    partsChecks,
    partsChecker: {
      async check(input) {
        calls++;
        return (
          opts.answer ?? {
            status: "checked",
            // The O-ring isn't reported at all: it must count as missing.
            results: [
              {
                partSpecId: input.parts[0]!.id,
                status: "found",
                boxes: [{ box: { x: 1, y: 1, w: 5, h: 5 }, confidence: 0.9 }],
              },
              {
                partSpecId: input.parts[1]!.id,
                status: "possible",
                boxes: [{ box: { x: 9, y: 9, w: 5, h: 5 }, confidence: 0.5 }],
              },
            ],
          }
        );
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const send = (method: string, path: string, body: object) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", authorization: "Bearer a" },
      body: JSON.stringify(body),
    });
  const photo = async (jobId = JOB) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId,
      jobStepId: null,
      kind: "photo",
      surface: "phone",
      storageKey: `${A}/${jobId}/${crypto.randomUUID()}.png`,
      mimeType: "image/png",
      byteSize: PNG.length,
      width: 100,
      height: 80,
      capturedAt: "2026-10-26T10:00:00.000Z",
    });
    await storage.put(ev.storageKey, PNG, "image/png");
    return evidence.markUploaded(ev.id, PNG.length);
  };
  const check = async (evidenceId: string) => {
    const res = await send("POST", `/jobs/${JOB}/parts-check`, { evidenceId });
    return { res, body: res.ok ? PartsCheckResponse.parse(await res.json()) : null };
  };
  return { send, photo, check, stepState, partsChecks, calls: () => calls, app };
}

const status = (s: Awaited<ReturnType<typeof setup>>, i: number) =>
  s.stepState.steps.get(JSTEP[i]!)!;

describe("POST /jobs/:id/parts-check", () => {
  it("reports every part, and blocks the steps that need a missing one", async () => {
    const s = await setup();
    const { body } = await s.check((await s.photo()).id);
    if (body?.status !== "checked") throw new Error(String(body?.status));
    expect(body.partsCheck.results.map((r) => [r.partSpecId, r.status])).toEqual([
      [PART.impeller, "found"],
      [PART.seal, "possible"],
      [PART.oring, "missing"],
    ]);
    expect(body.detections.map((d) => d.label)).toEqual(["Impeller", "Mechanical seal"]);
    expect(status(s, 1)).toMatchObject({
      status: "blocked",
      blockedBy: "parts",
      note: "Missing part: O-ring",
    });
    expect(status(s, 3)).toMatchObject({ status: "blocked", note: "Missing part: O-ring" });
    expect(status(s, 0).status).toBe("todo");
    expect(status(s, 2).status).toBe("todo");
    expect(body.steps.filter((x) => x.status === "blocked")).toHaveLength(2);
  });

  it("leaves finished steps and steps blocked for other reasons alone", async () => {
    const s = await setup({
      statuses: [
        {},
        { status: "user_confirmed" },
        {},
        { status: "blocked", blockedBy: "other", note: "Waiting on the fitter" },
      ],
    });
    await s.check((await s.photo()).id);
    expect(status(s, 1).status).toBe("user_confirmed");
    expect(status(s, 3)).toMatchObject({ blockedBy: "other", note: "Waiting on the fitter" });
  });

  it("shows on the job", async () => {
    const s = await setup();
    await s.check((await s.photo()).id);
    const detail = await s.app.request(`/jobs/${JOB}`, { headers: { authorization: "Bearer a" } });
    const parsed = JobDetailResponse.parse(await detail.json());
    expect(parsed.partsCheck?.results).toHaveLength(3);
  });

  it("passes on the fallback and blocks nothing when the model can't help", async () => {
    const s = await setup({ answer: { status: "unavailable", message: "Tick them off instead." } });
    const { body } = await s.check((await s.photo()).id);
    expect(body).toEqual({ status: "unavailable", message: "Tick them off instead." });
    expect(s.partsChecks.checks).toEqual([]);
    expect(status(s, 1).status).toBe("todo");
  });

  it("says so when there's no parts list, without calling the model", async () => {
    const s = await setup({
      draft: { ...DRAFT, parts: [], steps: DRAFT.steps.map((x) => ({ ...x, partRefs: [] })) },
    });
    expect((await s.check((await s.photo()).id)).body).toEqual({ status: "no_parts" });
    expect(s.calls()).toBe(0);
  });

  it("only takes the job's own photos", async () => {
    const s = await setup();
    expect((await s.check((await s.photo(OTHER_JOB)).id)).res.status).toBe(404);
  });
});

describe("PATCH /jobs/:id/parts-check/:id/parts/:partSpecId", () => {
  it("lifts the blocks when a missing part turns out to be there", async () => {
    const s = await setup();
    const { body } = await s.check((await s.photo()).id);
    if (body?.status !== "checked") throw new Error();
    const res = await s.send(
      "PATCH",
      `/jobs/${JOB}/parts-check/${body.partsCheck.id}/parts/${PART.oring}`,
      {
        status: "found",
      },
    );
    const fixed = CorrectPartResponse.parse(await res.json());
    expect(fixed.partsCheck.results.find((r) => r.partSpecId === PART.oring)!.status).toBe("found");
    expect(status(s, 1).status).toBe("todo");
    expect(status(s, 1).blockedBy).toBeUndefined();
    expect(status(s, 3).status).toBe("todo");
  });

  it("blocks when a part found earlier is marked missing", async () => {
    const s = await setup();
    const { body } = await s.check((await s.photo()).id);
    if (body?.status !== "checked") throw new Error();
    await s.send("PATCH", `/jobs/${JOB}/parts-check/${body.partsCheck.id}/parts/${PART.impeller}`, {
      status: "missing",
    });
    expect(status(s, 0)).toMatchObject({ status: "blocked", note: "Missing part: Impeller" });
  });

  it("refuses unknown checks and parts", async () => {
    const s = await setup();
    const { body } = await s.check((await s.photo()).id);
    if (body?.status !== "checked") throw new Error();
    const base = `/jobs/${JOB}/parts-check`;
    expect(
      (
        await s.send("PATCH", `${base}/${body.partsCheck.id}/parts/${JSTEP[0]}`, {
          status: "found",
        })
      ).status,
    ).toBe(404);
    expect(
      (await s.send("PATCH", `${base}/${JSTEP[0]}/parts/${PART.oring}`, { status: "found" }))
        .status,
    ).toBe(404);
    expect(
      (
        await s.send("PATCH", `${base}/${body.partsCheck.id}/parts/${PART.oring}`, {
          status: "gone",
        })
      ).status,
    ).toBe(400);
  });
});
