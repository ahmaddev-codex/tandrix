import {
  AskStepResponse,
  TranscribeResponse,
  type Job,
  type JobStep,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import type { StepAnswerer, Transcriber } from "../src/voice";
import {
  memoryAssets,
  memoryEvidence,
  memoryProcedures,
  memoryStepState,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";
import { wav } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const JOB = "00000000-0000-4000-8000-000000000001";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const PSTEP = "00000000-0000-4000-8000-00000000c001";
const JSTEP = "00000000-0000-4000-8000-00000000e001";
const ASSET = "00000000-0000-4000-8000-0000000000a1";

const DRAFT: ProcedureDraft = {
  title: "Assemble",
  parts: [{ ref: "P1", name: "Impeller", qty: 1 }],
  steps: [
    {
      order: 1,
      surface: "physical",
      title: "Fit the impeller",
      instruction: "Slide the impeller onto the shaft.",
      reason: "Vanes face the inlet.",
      partRefs: ["P1"],
      hazardTags: [],
      verification: "photo",
      expectedState: "Seated.",
      citation: { kind: "generic" },
    },
  ],
};

async function setup() {
  const heard: Array<{ bytes: number; keywords: string[] }> = [];
  const asked: Array<Parameters<StepAnswerer["answer"]>[0]> = [];
  const transcriber: Transcriber = {
    async transcribe(w, keywords) {
      heard.push({ bytes: w.length, keywords });
      return { status: "heard", transcript: "Which way round?", durationMs: 1000 };
    },
  };
  const answerer: StepAnswerer = {
    async answer(q) {
      asked.push(q);
      return { status: "answer", answer: "Vanes face the inlet.", fromStep: true };
    },
  };
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "x|y",
    manualId: null,
    draft: DRAFT,
    partIds: new Map([["P1", "00000000-0000-4000-8000-00000000a001"]]),
    stepIds: [PSTEP],
    surface: "phone",
    event: {},
  });
  const step: JobStep = {
    id: JSTEP,
    jobId: JOB,
    procedureStepId: PSTEP,
    status: "todo",
    statusEvidenceId: null,
    startedAt: null,
    updatedAt: "2026-10-26T10:00:00.000Z",
    updatedBySurface: "phone",
  };
  const job = { id: JOB, ownerId: A, assetId: ASSET, procedureId: PROC } as Job;
  const jobs = {
    async getForOwner(o: string, id: string) {
      return o === A && id === JOB ? { job, steps: [step] } : null;
    },
  } as unknown as JobsRepo;
  const assets = memoryAssets();
  assets.assets.set(ASSET, {
    id: ASSET,
    ownerId: A,
    category: "equipment",
    make: "FlowSet",
    model: "CR 3-10",
    nameplateEvidenceId: null,
    createdAt: "2026-10-26T10:00:00.000Z",
  });
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : null),
    jobs,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets,
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    stepState: memoryStepState(() => JOB),
    transcriber,
    answerer,
    corsOrigins: [],
    log: () => {},
  });
  const upload = (audio: Uint8Array | string, extra: Record<string, string> = {}, token = "a") => {
    const form = new FormData();
    form.append("audio", new Blob([audio as BlobPart], { type: "audio/wav" }), "turn.wav");
    for (const [k, v] of Object.entries(extra)) form.append(k, v);
    return app.request("/voice/transcribe", {
      method: "POST",
      body: form,
      headers: { authorization: `Bearer ${token}` },
    });
  };
  const ask = async (body: object) => {
    const res = await app.request(`/jobs/${JOB}/steps/${JSTEP}/ask`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer a" },
      body: JSON.stringify(body),
    });
    return AskStepResponse.parse(await res.json());
  };
  return { upload, ask, heard, asked };
}

describe("POST /voice/transcribe", () => {
  it("transcribes a WAV turn with the keywords it was given", async () => {
    const s = await setup();
    const res = await s.upload(wav(1200), { keywords: JSON.stringify(["impeller", "FlowSet"]) });
    expect(TranscribeResponse.parse(await res.json())).toEqual({
      status: "heard",
      transcript: "Which way round?",
      durationMs: 1000,
    });
    expect(s.heard[0]!.keywords).toEqual(["impeller", "FlowSet"]);
  });

  it("refuses audio Muse Voice Transcribe can't take, without calling it", async () => {
    const s = await setup();
    expect((await s.upload("not audio")).status).toBe(400);
    expect((await s.upload(wav(1000, 16000, 2))).status).toBe(400);
    expect((await s.upload(wav(1000, 44100))).status).toBe(400);
    expect((await s.upload(wav(61_000))).status).toBe(413);
    expect((await s.upload(wav(1000), { keywords: "not json" })).status).toBe(400);
    expect(s.heard).toEqual([]);
  });

  it("treats a tap without speech as unclear, without a model call", async () => {
    const s = await setup();
    const res = await s.upload(wav(100));
    expect(TranscribeResponse.parse(await res.json()).status).toBe("unclear");
    expect(s.heard).toEqual([]);
  });

  it("needs a signed-in user", async () => {
    const s = await setup();
    expect((await s.upload(wav(1000), {}, "nope")).status).toBe(401);
  });
});

describe("POST /jobs/:id/steps/:stepId/ask", () => {
  it("refuses wiring and live work before any model call", async () => {
    const s = await setup();
    const r = await s.ask({ text: "How do I connect the motor leads to the supply?" });
    expect(r).toMatchObject({ status: "refused" });
    expect(r.status === "refused" && r.message).toMatch(/qualified electrician/);
    expect(s.asked).toEqual([]);
  });

  it("returns commands for the app to carry out", async () => {
    const s = await setup();
    expect(await s.ask({ text: "Next step please" })).toEqual({
      status: "command",
      command: { kind: "next" },
    });
    expect(await s.ask({ text: "skip it because it's already fitted" })).toEqual({
      status: "command",
      command: { kind: "skip", reason: "it's already fitted" },
    });
    expect(s.asked).toEqual([]);
  });

  it("answers questions in the step's context", async () => {
    const s = await setup();
    expect(await s.ask({ text: "Which way round does it go?" })).toEqual({
      status: "answer",
      answer: "Vanes face the inlet.",
      fromStep: true,
    });
    expect(s.asked[0]).toMatchObject({
      equipment: "FlowSet CR 3-10",
      question: "Which way round does it go?",
      stuck: false,
      step: { title: "Fit the impeller", parts: ["Impeller"], reason: "Vanes face the inlet." },
    });
  });

  it("asks for the next physical thing when the user is stuck", async () => {
    const s = await setup();
    await s.ask({ text: "I'm stuck on the shaft key" });
    expect(s.asked[0]).toMatchObject({ stuck: true, question: "I'm stuck on the shaft key" });
  });
});
