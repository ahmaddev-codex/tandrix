import { HighlightResponse, type Job, type JobStep, type ProcedureDraft } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { HighlightInput, HighlightResult } from "../src/highlighter";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryDetections,
  memoryEvidence,
  memoryProcedures,
  memoryStorage,
  noManuals,
  scriptedReader,
  memoryAssets,
} from "./fakes";
import { PNG } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const B_JOB = "00000000-0000-4000-8000-000000000002";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const STEP_IDS = ["00000000-0000-4000-8000-00000000c001", "00000000-0000-4000-8000-00000000c002"];
const JOB_STEP = "00000000-0000-4000-8000-00000000e001";
const BARE_JOB_STEP = "00000000-0000-4000-8000-00000000e002";
const PART_IDS = ["P1", "P2", "P3", "P4"].map(
  (_, i) => `00000000-0000-4000-8000-00000000a${String(i + 1).padStart(3, "0")}`,
);

const DRAFT: ProcedureDraft = {
  title: "Assemble",
  parts: [
    { ref: "P1", name: "Impeller", qty: 1, partNumber: "96-01" },
    { ref: "P2", name: "Mechanical seal", qty: 1 },
    { ref: "P3", name: "Casing bolt", qty: 8 },
    { ref: "P4", name: "O-ring", qty: 1 },
  ],
  steps: [
    {
      order: 1,
      surface: "physical",
      title: "Fit the parts",
      instruction: "Fit the impeller, seal, bolts and O-ring.",
      partRefs: ["P1", "P2", "P3", "P4"],
      hazardTags: [],
      verification: "photo",
      expectedState: "All fitted.",
      citation: { kind: "generic" },
    },
    {
      order: 2,
      surface: "physical",
      title: "Check the area",
      instruction: "Clear the work area.",
      partRefs: [],
      hazardTags: [],
      verification: "user_confirm",
      expectedState: "Clear.",
      citation: { kind: "generic" },
    },
  ],
};

const jobStep = (id: string, procedureStepId: string): JobStep => ({
  id,
  jobId: JOB,
  procedureStepId,
  status: "todo",
  statusEvidenceId: null,
  startedAt: null,
  updatedAt: "2026-10-26T10:00:00.000Z",
  updatedBySurface: "phone",
});

const job = (id: string, ownerId: string): Job => ({
  id,
  ownerId,
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
});

async function setup(answer?: (input: HighlightInput) => HighlightResult) {
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "flowset|cr 3-10",
    manualId: null,
    draft: DRAFT,
    partIds: new Map(DRAFT.parts.map((p, i) => [p.ref, PART_IDS[i]!])),
    stepIds: STEP_IDS,
    surface: "phone",
    event: {},
  });
  const jobs = {
    async getForOwner(ownerId: string, id: string) {
      if (id === JOB && ownerId === A)
        return {
          job: job(JOB, A),
          steps: [jobStep(JOB_STEP, STEP_IDS[0]!), jobStep(BARE_JOB_STEP, STEP_IDS[1]!)],
        };
      if (id === B_JOB && ownerId === B)
        return { job: { ...job(B_JOB, B), procedureId: null }, steps: [] };
      return null;
    },
  } as unknown as JobsRepo;
  const evidence = memoryEvidence(
    new Map([
      [JOB, A],
      [B_JOB, B],
    ]),
  );
  const storage = memoryStorage();
  const detections = memoryDetections();
  const asked: HighlightInput[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    detections,
    highlighter: {
      async find(input) {
        asked.push(input);
        return answer
          ? answer(input)
          : { status: "unavailable", message: "Tandrix can't highlight the parts right now." };
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const call = (method: string, path: string, token: string, body?: object) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const photo = async (
    jobId: string,
    opts: { uploaded?: boolean; size?: boolean; kind?: "photo" | "screenshot" } = {},
  ) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId,
      jobStepId: null,
      kind: opts.kind ?? "photo",
      surface: "phone",
      storageKey: `${A}/${jobId}/${crypto.randomUUID()}.png`,
      mimeType: "image/png",
      byteSize: PNG.length,
      ...(opts.size === false ? {} : { width: 2000, height: 1500 }),
      capturedAt: "2026-10-26T10:00:00.000Z",
    });
    await storage.put(ev.storageKey, PNG, "image/png");
    return opts.uploaded === false ? ev : evidence.markUploaded(ev.id, PNG.length);
  };
  const highlight = (evidenceId: string, token = "a", step = JOB_STEP, jobId = JOB) =>
    call("POST", `/jobs/${jobId}/steps/${step}/highlight`, token, { evidenceId });
  return { call, photo, highlight, asked, detections };
}

const found = (input: HighlightInput): HighlightResult => ({
  status: "found",
  picks: [
    {
      partSpecId: input.parts[0]!.id,
      box: { x: 100, y: 100, w: 400, h: 300 },
      mask: { path: "M0 0L40 0L40 40Z", raster: { width: 40, height: 40 } },
      confidence: 0.91,
    },
    {
      partSpecId: input.parts[1]!.id,
      box: { x: 10, y: 10, w: 50, h: 50 },
      mask: null,
      confidence: 0.4,
    },
    // A part nobody asked about is ignored.
    { partSpecId: PART_IDS[3]!, box: { x: 1, y: 1, w: 5, h: 5 }, mask: null, confidence: 0.99 },
  ],
  hint: "Show the bolts laid out",
});

describe("POST /jobs/:id/steps/:stepId/highlight", () => {
  it("highlights up to three parts, saves each as a detection and reports the rest", async () => {
    const s = await setup(found);
    const ev = await s.photo(JOB);
    const res = await s.highlight(ev.id);
    expect(res.status).toBe(200);
    const body = HighlightResponse.parse(await res.json());
    if (body.status !== "found") throw new Error(body.status);

    // At most three parts asked for, with the photo's bytes, size and the step instruction.
    expect(s.asked[0]!.parts.map((p) => p.name)).toEqual([
      "Impeller",
      "Mechanical seal",
      "Casing bolt",
    ]);
    expect(s.asked[0]!.size).toEqual({ width: 2000, height: 1500 });
    expect(s.asked[0]!.photo.bytes).toEqual(PNG);
    expect(s.asked[0]!.instruction).toContain("impeller");

    expect(body.size).toEqual({ width: 2000, height: 1500 });
    expect(body.targets.map((t) => [t.label, t.geometry.kind, t.possible])).toEqual([
      ["Impeller", "mask", false],
      ["Mechanical seal", "box", true],
    ]);
    expect(body.targets[0]!.partNumber).toBe("96-01");
    expect(body.missing.map((m) => m.name)).toEqual(["Casing bolt"]);
    expect(body.hint).toBe("Show the bolts laid out");

    expect(s.detections.rows.size).toBe(2);
    const saved = s.detections.rows.get(body.targets[0]!.detectionId)!;
    expect(saved).toMatchObject({ evidenceId: ev.id, label: "Impeller", confirmedByUser: null });
  });

  it("passes on the fallback message and saves nothing when the model can't help", async () => {
    const s = await setup();
    const res = await s.highlight((await s.photo(JOB)).id);
    expect(HighlightResponse.parse(await res.json())).toMatchObject({ status: "unavailable" });
    expect(s.detections.rows.size).toBe(0);
  });

  it("says so when the step names no parts, without calling the model", async () => {
    const s = await setup(found);
    const res = await s.highlight((await s.photo(JOB)).id, "a", BARE_JOB_STEP);
    expect(await res.json()).toEqual({ status: "no_parts" });
    expect(s.asked).toEqual([]);
  });

  it("only uses the job's own uploaded photos, with a recorded size", async () => {
    const s = await setup(found);
    for (const ev of [
      await s.photo(JOB, { uploaded: false }),
      await s.photo(B_JOB),
      await s.photo(JOB, { kind: "screenshot" }),
    ]) {
      expect((await s.highlight(ev.id)).status).toBe(404);
    }
    expect((await s.highlight((await s.photo(JOB, { size: false })).id)).status).toBe(422);
    expect(s.asked).toEqual([]);
  });

  it("hides other users' jobs and steps that aren't on the job", async () => {
    const s = await setup(found);
    const ev = await s.photo(JOB);
    expect((await s.highlight(ev.id, "b")).status).toBe(404);
    expect((await s.highlight(ev.id, "a", "00000000-0000-4000-8000-00000000e999")).status).toBe(
      404,
    );
    expect((await s.highlight(ev.id, "a", "not-a-uuid")).status).toBe(404);
  });
});

describe("PATCH /jobs/:id/detections/:detectionId", () => {
  async function withDetection() {
    const s = await setup(found);
    const res = HighlightResponse.parse(await (await s.highlight((await s.photo(JOB)).id)).json());
    if (res.status !== "found") throw new Error(res.status);
    const id = res.targets[0]!.detectionId;
    const patch = (body: object, token = "a", jobId = JOB) =>
      s.call("PATCH", `/jobs/${jobId}/detections/${id}`, token, body);
    return { s, id, patch };
  }

  it("records a confirmation and a rejection", async () => {
    const { s, id, patch } = await withDetection();
    expect((await patch({ verdict: "confirmed" })).status).toBe(200);
    expect(s.detections.rows.get(id)!.confirmedByUser).toBe(true);
    await patch({ verdict: "wrong" });
    expect(s.detections.rows.get(id)!.confirmedByUser).toBe(false);
  });

  it("relabels it as another part of the procedure", async () => {
    const { s, id, patch } = await withDetection();
    const res = await patch({ verdict: "other_part", partSpecId: PART_IDS[3] });
    expect(res.status).toBe(200);
    expect(s.detections.rows.get(id)).toMatchObject({
      confirmedByUser: true,
      correctedLabel: "O-ring",
      partSpecId: PART_IDS[3],
    });
  });

  it("refuses a part outside the procedure, and other users", async () => {
    const { patch } = await withDetection();
    expect(
      (await patch({ verdict: "other_part", partSpecId: "00000000-0000-4000-8000-0000000000ff" }))
        .status,
    ).toBe(400);
    expect((await patch({ verdict: "confirmed" }, "b", B_JOB)).status).toBe(404);
    expect((await patch({ verdict: "maybe" })).status).toBe(400);
  });
});
