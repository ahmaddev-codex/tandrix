import { LookResponse, type Job, type JobStep, type ProcedureDraft } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { LookInput } from "../src/looker";
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
import { PNG } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const PROC = "00000000-0000-4000-8000-0000000000f1";
const PSTEP = "00000000-0000-4000-8000-00000000c001";
const JSTEP = "00000000-0000-4000-8000-00000000e001";

const DRAFT: ProcedureDraft = {
  title: "Build the Pi",
  parts: [],
  steps: [
    {
      partRefs: [],
      hazardTags: [],
      citation: { kind: "generic" },
      surface: "physical",
      order: 1,
      title: "Fit the Active Cooler",
      instruction: "Press the cooler's pins into the board's holes, then plug the fan into FAN.",
      verification: "photo",
      expectedState: "Cooler seated, fan plugged in.",
    },
  ],
};

async function setup(
  answer: Awaited<ReturnType<NonNullable<Parameters<typeof createApp>[0]["looker"]>["look"]>>,
) {
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "x|y",
    manualId: null,
    draft: DRAFT,
    partIds: new Map(),
    stepIds: [PSTEP],
    surface: "phone",
    event: {},
  });
  const steps = [
    { id: JSTEP, jobId: JOB, procedureStepId: PSTEP, status: "in_progress" } as JobStep,
  ];
  const job = {
    id: JOB,
    ownerId: A,
    assetId: null,
    procedureId: PROC,
    currentStepId: JSTEP,
  } as Job;
  const jobs = {
    async getForOwner(o: string, id: string) {
      return o === A && id === JOB ? { job, steps } : null;
    },
  } as unknown as JobsRepo;
  const asked: LookInput[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence: memoryEvidence(new Map([[JOB, A]])),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    stepState: memoryStepState(() => JOB),
    screenGuide: { ask: async () => ({ status: "unavailable", message: "no" }) },
    looker: {
      async look(input) {
        asked.push(input);
        return answer;
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const look = async (body: object, token = "a") => {
    const res = await app.request("/look", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        photo: { mimeType: "image/png", data: Buffer.from(PNG).toString("base64") },
        width: 1000,
        height: 750,
        question: "Where does this go?",
        ...body,
      }),
    });
    return { res, body: res.ok ? LookResponse.parse(await res.json()) : null };
  };
  return { look, asked };
}

const ANSWERED = {
  status: "answered" as const,
  reply: "That's the fan cable. Plug it into the socket marked FAN.",
  highlight: { label: "fan cable", box: { x: 400, y: 300, w: 120, h: 60 }, mask: null },
};

describe("POST /look", () => {
  it("answers about the frame and outlines what the answer is about", async () => {
    const s = await setup(ANSWERED);
    const { res, body } = await s.look({});
    expect(res.status).toBe(200);
    expect(body).toEqual(ANSWERED);
    expect(s.asked[0]).toMatchObject({ size: { width: 1000, height: 750 }, context: [] });
  });

  it("gives the step in hand as context when asked inside a project", async () => {
    const s = await setup(ANSWERED);
    await s.look({ jobId: JOB });
    expect(s.asked[0]!.context).toEqual([
      "Step 1: Fit the Active Cooler",
      "Instruction: Press the cooler's pins into the board's holes, then plug the fan into FAN.",
    ]);
  });

  it("refuses live electrical work without asking the model", async () => {
    const s = await setup(ANSWERED);
    const { body } = await s.look({ question: "How do I rewire this live socket?" });
    expect(body?.status).toBe("refused");
    expect(s.asked).toHaveLength(0);
  });

  it("won't use someone else's project", async () => {
    const s = await setup(ANSWERED);
    const { res } = await s.look({ jobId: JOB }, "b");
    expect(res.status).toBe(404);
  });

  it("needs a signed-in user", async () => {
    const s = await setup(ANSWERED);
    const { res } = await s.look({}, "nobody");
    expect(res.status).toBe(401);
  });
});
