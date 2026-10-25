import { ScreenAskResponse, type Job, type JobStep, type ProcedureDraft } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import { CANT_POINT, pointerFor } from "../src/routes/screen";
import type { ScreenGuideOutcome, ScreenQuestionInput } from "../src/screen-guide";
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
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const PSTEP = ["c001", "c002"].map((x) => `00000000-0000-4000-8000-00000000${x}`);
const JSTEP = ["e001", "e002"].map((x) => `00000000-0000-4000-8000-00000000${x}`);

const base = { partRefs: [], hazardTags: [], citation: { kind: "generic" as const } };
const DRAFT: ProcedureDraft = {
  title: "Commission",
  parts: [],
  steps: [
    {
      ...base,
      surface: "physical",
      order: 1,
      title: "Fit the impeller",
      instruction: "Slide it on.",
      verification: "photo",
      expectedState: "Seated.",
    },
    {
      ...base,
      surface: "desktop",
      order: 2,
      title: "Set the ramp time",
      instruction: "In the drive software, set Ramp time to 10 s.",
      verification: "screen",
      expectedState: "Ramp time reads 10 s.",
    },
  ],
};

const geometry = {
  displayId: "1",
  imageWidth: 1280,
  imageHeight: 800,
  originX: 0,
  originY: 0,
  displayWidth: 1512,
  displayHeight: 945,
};

async function setup(outcome: ScreenGuideOutcome) {
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
  const steps: JobStep[] = JSTEP.map((id, i) => ({
    id,
    jobId: JOB,
    procedureStepId: PSTEP[i]!,
    status: i === 0 ? "verified" : "in_progress",
    statusEvidenceId: null,
    startedAt: null,
    updatedAt: "2026-10-26T10:00:00.000Z",
    updatedBySurface: "phone",
  }));
  const job = {
    id: JOB,
    ownerId: A,
    assetId: null,
    procedureId: PROC,
    currentStepId: JSTEP[1],
  } as Job;
  const jobs = {
    async getForOwner(o: string, id: string) {
      return o === A && id === JOB ? { job, steps } : null;
    },
  } as unknown as JobsRepo;
  const evidence = memoryEvidence(new Map([[JOB, A]]));
  const storage = memoryStorage();
  const asked: ScreenQuestionInput[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    stepState: memoryStepState(() => JOB),
    screenGuide: {
      async ask(input) {
        asked.push(input);
        return outcome;
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const upload = async (opts: { kind?: "photo" | "screenshot"; uploaded?: boolean } = {}) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId: JOB,
      jobStepId: null,
      kind: opts.kind ?? "screenshot",
      surface: "desktop",
      storageKey: `${A}/${JOB}/${crypto.randomUUID()}.png`,
      mimeType: "image/png",
      byteSize: PNG.length,
      width: 1280,
      height: 800,
      capturedAt: "2026-10-26T10:05:00.000Z",
    });
    await storage.put(ev.storageKey, PNG, "image/png");
    return opts.uploaded === false ? ev : evidence.markUploaded(ev.id, PNG.length);
  };
  const ask = async (body: object, token = "a") => {
    const res = await app.request(`/jobs/${JOB}/screen/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return { res, body: res.ok ? ScreenAskResponse.parse(await res.json()) : null };
  };
  const question = (evidenceId: string) => ({
    evidenceId,
    transcript: "How do I set the ramp time?",
    geometry,
    mode: "show",
  });
  return { upload, ask, question, asked };
}

const click = { type: "click" as const, button: "left" as const, x: 412, y: 315 };

describe("POST /jobs/:id/screen/ask", () => {
  it("asks about the screenshot with the current step and points where the model would act", async () => {
    const s = await setup({ status: "answered", reply: "Click Ramp time.", actions: [click] });
    const ev = await s.upload();
    const { res, body } = await s.ask(s.question(ev.id));
    expect(res.status).toBe(200);
    expect(body).toEqual({
      status: "answered",
      reply: "Click Ramp time.",
      target: {
        surface: "screen",
        evidenceId: ev.id,
        label: "Click here",
        geometry: { kind: "point", point: { x: 412, y: 315 } },
      },
      proposed: [click],
    });
    expect(s.asked).toHaveLength(1);
    expect(s.asked[0]!.question).toBe("How do I set the ramp time?");
    expect(s.asked[0]!.context).toEqual([
      "Step: Set the ramp time",
      "Instruction: In the drive software, set Ramp time to 10 s.",
    ]);
    expect(s.asked[0]!.screenshot).toMatchObject({
      mimeType: "image/png",
      width: 1280,
      height: 800,
    });
    expect(Buffer.from(s.asked[0]!.screenshot.bytes).equals(Buffer.from(PNG))).toBe(true);
  });

  it("only accepts this job's uploaded screenshots", async () => {
    const s = await setup({ status: "answered", reply: "x", actions: [] });
    expect((await s.ask(s.question((await s.upload({ kind: "photo" })).id))).res.status).toBe(404);
    expect((await s.ask(s.question((await s.upload({ uploaded: false })).id))).res.status).toBe(
      404,
    );
    expect((await s.ask(s.question((await s.upload()).id), "b")).res.status).toBe(404);
    expect(s.asked).toHaveLength(0);
  });

  it("refuses a malformed question", async () => {
    const s = await setup({ status: "answered", reply: "x", actions: [] });
    const ev = await s.upload();
    expect((await s.ask({ ...s.question(ev.id), transcript: "" })).res.status).toBe(400);
    expect((await s.ask({ ...s.question(ev.id), geometry: {} })).res.status).toBe(400);
  });

  it("doesn't point outside the screenshot", async () => {
    const s = await setup({
      status: "answered",
      reply: "It's at the far edge.",
      actions: [{ ...click, x: 1280 }],
    });
    const { body } = await s.ask(s.question((await s.upload()).id));
    expect(body).toMatchObject({
      status: "answered",
      reply: "It's at the far edge.",
      target: null,
    });
  });

  it("says something even when the model only acted, or did nothing", async () => {
    const acted = await setup({ status: "answered", reply: "", actions: [click] });
    expect((await acted.ask(acted.question((await acted.upload()).id))).body).toMatchObject({
      reply: "Click here.",
    });
    const silent = await setup({ status: "answered", reply: "", actions: [] });
    expect((await silent.ask(silent.question((await silent.upload()).id))).body).toMatchObject({
      reply: CANT_POINT,
      target: null,
    });
  });

  it("passes on unavailable as a normal answer", async () => {
    const s = await setup({ status: "unavailable", message: "Not now." });
    const { res, body } = await s.ask(s.question((await s.upload()).id));
    expect(res.status).toBe(200);
    expect(body).toEqual({ status: "unavailable", message: "Not now." });
  });
});

describe("pointerFor", () => {
  const size = { width: 100, height: 100 };
  it("starts a drag where it begins and skips actions without a place", () => {
    expect(
      pointerFor(
        [
          { type: "keypress", keys: ["CMD", "S"] },
          {
            type: "drag",
            path: [
              { x: 5, y: 6 },
              { x: 50, y: 60 },
            ],
          },
        ],
        "ev",
        size,
      ),
    ).toMatchObject({ label: "Drag from here", geometry: { point: { x: 5, y: 6 } } });
  });

  it("has nothing to point at for typing or key presses alone", () => {
    expect(pointerFor([{ type: "type", text: "10" }], "ev", size)).toBeNull();
  });
});

describe("POST /screen/ask (outside a job)", () => {
  async function inline(outcome: ScreenGuideOutcome) {
    const asked: ScreenQuestionInput[] = [];
    const evidence = memoryEvidence(new Map());
    const app = createApp({
      verifyToken: async (t) => (t === "a" ? { id: A } : null),
      jobs: {} as JobsRepo,
      evidence,
      storage: memoryStorage(),
      assets: memoryAssets(),
      nameplateReader: scriptedReader(),
      ...noManuals(),
      screenGuide: {
        async ask(input) {
          asked.push(input);
          return outcome;
        },
      },
      corsOrigins: [],
      log: () => {},
    });
    const ask = (body: object, token: string | null = "a") =>
      app.request("/screen/ask", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
    return { ask, asked, evidence };
  }
  const body = {
    screenshot: { mimeType: "image/png", data: Buffer.from(PNG).toString("base64") },
    transcript: "How do I add a layer mask?",
    geometry,
    mode: "show",
    history: [
      { question: "How do I open the Layers panel?", reply: "Choose Window, then Layers." },
    ],
  };

  it("answers about an inline screenshot, with earlier turns as context, and keeps nothing", async () => {
    const s = await inline({
      status: "answered",
      reply: "Click Add layer mask.",
      actions: [click],
    });
    const res = await s.ask(body);
    expect(res.status).toBe(200);
    expect(ScreenAskResponse.parse(await res.json())).toEqual({
      status: "answered",
      reply: "Click Add layer mask.",
      target: {
        surface: "screen",
        evidenceId: null,
        label: "Click here",
        geometry: { kind: "point", point: { x: 412, y: 315 } },
      },
      proposed: [click],
    });
    expect(Buffer.from(s.asked[0]!.screenshot.bytes).equals(Buffer.from(PNG))).toBe(true);
    expect(s.asked[0]!.context).toEqual([
      'Earlier the user asked: "How do I open the Layers panel?" You answered: "Choose Window, then Layers."',
    ]);
  });

  it("needs a signed-in user and a real image", async () => {
    const s = await inline({ status: "answered", reply: "x", actions: [] });
    expect((await s.ask(body, null)).status).toBe(401);
    expect(
      (await s.ask({ ...body, screenshot: { mimeType: "image/png", data: "not base64!" } })).status,
    ).toBe(400);
    expect(
      (await s.ask({ ...body, screenshot: { mimeType: "image/gif", data: "AAAA" } })).status,
    ).toBe(400);
    expect(s.asked).toEqual([]);
  });

  it("refuses screenshots over the limit before reading them", async () => {
    const s = await inline({ status: "answered", reply: "x", actions: [] });
    const big = "A".repeat(6 * 1024 * 1024);
    const res = await s.ask({ ...body, screenshot: { mimeType: "image/png", data: big } });
    expect(res.status).toBe(413);
  });
});
