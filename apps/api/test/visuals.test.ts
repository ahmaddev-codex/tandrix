// Step visuals: the user's reference photo, the cited manual page (rendered once) and the latest
// photo, and the reference reaching the photo check.
import {
  StepVisualsResponse,
  type Job,
  type JobStep,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { PageRenderer } from "../src/pdf-render";
import type { JobsRepo } from "../src/repos/jobs";
import type { CheckInput } from "../src/step-checker";
import {
  fakeRenderer,
  memoryAssets,
  memoryEvidence,
  memoryManualPages,
  memoryManuals,
  memoryProcedures,
  memoryStepState,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";
import { PNG } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const OTHER_JOB = "00000000-0000-4000-8000-000000000002";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const PSTEP = ["c001", "c002"].map((x) => `00000000-0000-4000-8000-00000000${x}`);
const JSTEP = ["e001", "e002"].map((x) => `00000000-0000-4000-8000-00000000${x}`);

async function setup(opts: { renderer?: PageRenderer; page?: number } = {}) {
  const manuals = memoryManuals();
  const manualStorage = memoryStorage();
  const manual = await manuals.insert({
    assetModelKey: "raspberry pi|5",
    title: "Build kit",
    sourceType: "upload",
    sourceUrl: null,
    storageKey: `${A}/manual.pdf`,
    pageCount: 22,
    ownerId: A,
  });
  await manualStorage.put(
    manual.storageKey,
    new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    "application/pdf",
  );
  const draft: ProcedureDraft = {
    title: "Fit the cooler",
    parts: [],
    steps: [
      {
        order: 1,
        surface: "physical",
        partRefs: [],
        hazardTags: [],
        title: "Fit the Active Cooler",
        instruction: "Push the pins through the holes.",
        verification: "photo",
        expectedState: "Cooler seated, both pins clipped.",
        citation: { kind: "manual", page: opts.page ?? 5, figure: "Fig. 2" },
      },
      {
        order: 2,
        surface: "physical",
        partRefs: [],
        hazardTags: [],
        title: "Connect the fan",
        instruction: "Plug it into FAN.",
        verification: "photo",
        expectedState: "Fan cable in FAN.",
        citation: { kind: "generic" },
      },
    ],
  };
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "raspberry pi|5",
    manualId: manual.id,
    draft,
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
      status: "in_progress",
      statusEvidenceId: null,
      startedAt: "2026-10-26T10:00:00.000Z",
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
  const renderer = opts.renderer ?? fakeRenderer(22);
  const manualPages = memoryManualPages();
  const checked: CheckInput[] = [];
  const logs: Array<Record<string, unknown>> = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    manuals,
    manualStorage,
    manualPages,
    pageRenderer: renderer,
    procedures,
    stepState,
    checker: {
      async check(input) {
        checked.push(input);
        return { status: "judged", result: "pass", reason: "Seated." };
      },
    },
    now: () => Date.UTC(2026, 9, 26, 12),
    corsOrigins: [],
    log: (l) => logs.push(l),
  });
  const req = (method: string, path: string, body?: object, token = "a") =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const photo = async (
    capturedAt: string,
    o: { job?: string; step?: number; uploaded?: boolean; kind?: "photo" | "audio" } = {},
  ) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId: o.job ?? JOB,
      jobStepId: JSTEP[(o.step ?? 1) - 1]!,
      kind: o.kind ?? "photo",
      surface: "phone",
      storageKey: `${A}/${JOB}/${crypto.randomUUID()}.png`,
      mimeType: "image/png",
      byteSize: PNG.length,
      width: 10,
      height: 10,
      capturedAt,
    });
    await storage.put(ev.storageKey, PNG, "image/png");
    return o.uploaded === false ? ev : evidence.markUploaded(ev.id, PNG.length);
  };
  const visuals = async (step = 1, token = "a") => {
    const res = await req("GET", `/jobs/${JOB}/steps/${JSTEP[step - 1]}/visuals`, undefined, token);
    return { res, body: res.ok ? StepVisualsResponse.parse(await res.json()) : null };
  };
  const setReference = (evidenceId: string, step = 1) =>
    req("PUT", `/jobs/${JOB}/steps/${JSTEP[step - 1]}/reference`, { evidenceId });
  return {
    req,
    photo,
    visuals,
    setReference,
    renderer,
    manualPages,
    manualStorage,
    manual,
    checked,
    logs,
    stepState,
  };
}

describe("GET /jobs/:id/steps/:stepId/visuals", () => {
  it("shows the cited manual page, rendered once and reused", async () => {
    const s = await setup();
    const first = await s.visuals();
    expect(first.body?.visuals).toEqual([
      {
        kind: "manual_page",
        manualId: s.manual.id,
        page: 5,
        figure: "Fig. 2",
        url: expect.stringContaining(`pages/${s.manual.id}/5.jpg`),
        width: 800,
        height: 1131,
      },
    ]);
    expect(first.body?.urlExpiresAt).toBe("2026-10-26T12:15:00.000Z");
    expect(s.manualStorage.objects.get(`pages/${s.manual.id}/5.jpg`)?.contentType).toBe(
      "image/jpeg",
    );

    await s.visuals();
    expect((s.renderer as ReturnType<typeof fakeRenderer>).renders).toEqual([5]);
  });

  it("shows nothing for a generic step with no photos", async () => {
    const s = await setup();
    expect((await s.visuals(2)).body?.visuals).toEqual([]);
  });

  it("leaves out a page the manual doesn't have, without rendering", async () => {
    const s = await setup({ page: 40 });
    expect((await s.visuals()).body?.visuals).toEqual([]);
    expect((s.renderer as ReturnType<typeof fakeRenderer>).renders).toEqual([]);
  });

  it("leaves out a page that fails to render, and logs it", async () => {
    const s = await setup({
      renderer: {
        async render() {
          throw new Error("Rendering the manual page took too long");
        },
      },
    });
    const r = await s.visuals();
    expect(r.res.status).toBe(200);
    expect(r.body?.visuals).toEqual([]);
    expect(s.logs).toContainEqual(
      expect.objectContaining({ event: "manual_page_render_failed", page: 5 }),
    );
  });

  it("shows the latest uploaded photo of the step, not other steps' or pending ones", async () => {
    const s = await setup();
    await s.photo("2026-10-26T10:05:00.000Z");
    const newest = await s.photo("2026-10-26T10:20:00.000Z");
    await s.photo("2026-10-26T10:30:00.000Z", { step: 2 });
    await s.photo("2026-10-26T10:40:00.000Z", { uploaded: false });
    const kinds = (await s.visuals()).body?.visuals.map((v) => v.kind);
    expect(kinds).toEqual(["manual_page", "latest"]);
    expect((await s.visuals()).body?.visuals[1]).toMatchObject({
      kind: "latest",
      evidenceId: newest.id,
      evidenceKind: "photo",
      capturedAt: newest.capturedAt,
      width: 10,
      height: 10,
    });
  });

  it("is not found for someone else's job", async () => {
    const s = await setup();
    expect((await s.visuals(1, "b")).res.status).toBe(404);
  });
});

describe("PUT and DELETE /jobs/:id/steps/:stepId/reference", () => {
  it("puts the reference first and keeps it out of the latest photo", async () => {
    const s = await setup();
    const ref = await s.photo("2026-10-26T10:10:00.000Z");
    const res = await s.setReference(ref.id);
    expect(res.status).toBe(200);
    const body = StepVisualsResponse.parse(await res.json());
    expect(body.visuals.map((v) => v.kind)).toEqual(["reference", "manual_page"]);
    expect(body.visuals[0]).toMatchObject({ evidenceId: ref.id, evidenceKind: "photo" });

    const later = await s.photo("2026-10-26T10:20:00.000Z");
    const again = (await s.visuals()).body!.visuals;
    expect(again.map((v) => v.kind)).toEqual(["reference", "manual_page", "latest"]);
    expect(again[2]).toMatchObject({ evidenceId: later.id });

    const cleared = await s.req("DELETE", `/jobs/${JOB}/steps/${JSTEP[0]}/reference`);
    expect(StepVisualsResponse.parse(await cleared.json()).visuals.map((v) => v.kind)).toEqual([
      "manual_page",
      "latest",
    ]);
  });

  it("refuses a photo from another job, one not uploaded yet, or audio", async () => {
    const s = await setup();
    const other = await s.photo("2026-10-26T10:10:00.000Z", { job: OTHER_JOB });
    const pending = await s.photo("2026-10-26T10:10:00.000Z", { uploaded: false });
    const audio = await s.photo("2026-10-26T10:10:00.000Z", { kind: "audio" });
    for (const ev of [other, pending, audio])
      expect((await s.setReference(ev.id)).status).toBe(404);
    expect(s.stepState.references.size).toBe(0);
  });

  it("rejects a body without an evidence id", async () => {
    const s = await setup();
    const res = await s.req("PUT", `/jobs/${JOB}/steps/${JSTEP[0]}/reference`, {});
    expect(res.status).toBe(400);
  });
});

describe("the photo check's reference", () => {
  const check = async (s: Awaited<ReturnType<typeof setup>>, step = 1) => {
    const p = await s.photo("2026-10-26T11:00:00.000Z", { step });
    return s.req("POST", `/jobs/${JOB}/steps/${JSTEP[step - 1]}/check`, { evidenceId: p.id });
  };

  it("compares with the user's reference photo when there is one", async () => {
    const s = await setup();
    const ref = await s.photo("2026-10-26T10:10:00.000Z");
    await s.setReference(ref.id);
    expect((await check(s)).status).toBe(200);
    expect(s.checked[0]?.reference).toMatchObject({ kind: "reference", mimeType: "image/png" });
  });

  it("falls back to the cited manual page", async () => {
    const s = await setup();
    expect((await check(s)).status).toBe(200);
    expect(s.checked[0]?.reference).toMatchObject({ kind: "manual_page", mimeType: "image/jpeg" });
  });

  it("checks on words alone for a generic step without a reference", async () => {
    const s = await setup();
    expect((await check(s, 2)).status).toBe(200);
    expect(s.checked[0]?.reference).toBeUndefined();
  });
});
