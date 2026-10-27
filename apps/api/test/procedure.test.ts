import {
  GenerateProcedureResponse,
  JobDetailResponse,
  type Asset,
  type Job,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { MetaClient } from "@tandrix/ai";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import {
  GENERATE_UNAVAILABLE,
  metaProcedureGenerator,
  type GenerateInput,
  type GenerateResult,
} from "../src/procedure-generator";
import type { JobsRepo } from "../src/repos/jobs";
import {
  memoryAssets,
  memoryEvidence,
  memoryManuals,
  memoryProcedures,
  memoryStorage,
  noManuals,
  scriptedReader,
} from "./fakes";
import { samplePdf } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const NO_ASSET_JOB = "00000000-0000-4000-8000-000000000002";
const ASSET = "00000000-0000-4000-8000-0000000000a1";

const DRAFT: ProcedureDraft = {
  title: "Assemble the pump",
  parts: [
    { ref: "P1", name: "Impeller", qty: 1 },
    { ref: "P2", name: "Mechanical seal", qty: 1 },
  ],
  steps: [
    {
      order: 2,
      surface: "physical",
      title: "Fit the seal",
      instruction: "Press the seal onto the shaft.",
      partRefs: ["P2"],
      hazardTags: [],
      verification: "photo",
      expectedState: "Seal flush with the shoulder.",
      citation: { kind: "manual", page: 6, figure: "Fig. 3" },
    },
    {
      order: 1,
      surface: "physical",
      title: "Fit the impeller",
      instruction: "Slide the impeller onto the shaft.",
      partRefs: ["P1", "P9"],
      hazardTags: [],
      verification: "photo",
      expectedState: "Impeller against the shoulder.",
      citation: { kind: "manual", page: 99 },
    },
  ],
};

const job = (id: string, assetId: string | null, procedureId: string | null = null): Job => ({
  id,
  ownerId: A,
  assetId,
  procedureId,
  title: "Assemble the pump",
  status: "active",
  currentStepId: null,
  activeSurface: "phone",
  controlMode: "show",
  language: "en",
  createdAt: "2026-10-26T10:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
});

async function setup(opts: { manual?: boolean; answer?: GenerateResult } = {}) {
  const evidence = memoryEvidence(
    new Map([
      [JOB, A],
      [NO_ASSET_JOB, A],
    ]),
  );
  const evidenceStorage = memoryStorage();
  const jobsList = [job(JOB, ASSET), job(NO_ASSET_JOB, null)];
  const jobs = {
    async getForOwner(ownerId: string, id: string) {
      const j = jobsList.find((x) => x.id === id && x.ownerId === ownerId);
      return j ? { job: j, steps: [] } : null;
    },
  } as unknown as JobsRepo;
  const assets = memoryAssets();
  const asset: Asset = {
    id: ASSET,
    ownerId: A,
    category: "equipment",
    make: "FlowSet",
    model: "CR 3-10",
    nameplateEvidenceId: null,
    createdAt: "2026-10-26T10:00:00.000Z",
  };
  assets.assets.set(ASSET, asset);
  const manuals = memoryManuals();
  const manualStorage = memoryStorage();
  if (opts.manual !== false) {
    await manualStorage.put(`${A}/m.pdf`, await samplePdf(12), "application/pdf");
    await manuals.insert({
      assetModelKey: "flowset|cr 3-10",
      title: "Manual",
      sourceType: "upload",
      sourceUrl: null,
      storageKey: `${A}/m.pdf`,
      pageCount: 12,
      ownerId: A,
    });
  }
  const procedures = memoryProcedures();
  const asked: GenerateInput[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence,
    storage: evidenceStorage,
    assets,
    nameplateReader: scriptedReader(),
    ...noManuals(),
    manuals,
    manualStorage,
    procedures,
    procedureGenerator: {
      async generate(input) {
        asked.push(input);
        return opts.answer ?? { status: "drafted", draft: DRAFT };
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const call = (path: string, token: string, body?: object) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const photo = async (jobId: string, kind: "photo" | "audio" = "photo") => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId,
      jobStepId: null,
      kind,
      surface: "phone",
      storageKey: `${A}/${jobId}/${crypto.randomUUID()}.jpg`,
      mimeType: "image/jpeg",
      byteSize: 3,
      capturedAt: "2026-10-26T10:00:00.000Z",
    });
    await evidenceStorage.put(ev.storageKey, new Uint8Array([0xff, 0xd8, 0xff]), "image/jpeg");
    return evidence.markUploaded(ev.id, 3);
  };
  return { call, procedures, asked, jobsList, app, manuals, manualStorage, photo };
}

describe("POST /jobs/:id/procedure", () => {
  it("drafts from the manual, applies the rules and saves the job's steps", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${JOB}/procedure`, "a");
    expect(res.status).toBe(201);
    const body = GenerateProcedureResponse.parse(await res.json());
    if (body.status !== "created") throw new Error(body.status);

    // The manual's bytes and page count reach the model, with the job title as the task.
    expect(s.asked[0]!.manual?.pages).toBe(12);
    expect(Buffer.from(s.asked[0]!.manual!.bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(s.asked[0]!.task).toBe("Assemble the pump");

    // Renumbered, unknown part dropped, page 99 of a 12-page manual shown as Generic.
    const steps = body.detail.steps;
    expect(steps.map((x) => x.title)).toEqual(["Fit the impeller", "Fit the seal"]);
    expect(steps[0]!.citation).toEqual({ kind: "generic" });
    expect(steps[1]!.citation).toMatchObject({ kind: "manual", page: 6 });
    expect(steps[0]!.partSpecIds).toHaveLength(1);
    expect(body.citedSteps).toBe(1);
    expect(s.procedures.saves[0]!.event).toMatchObject({ steps: 2, cited_steps: 1 });
  });

  it("asks for the manual before writing generic steps", async () => {
    const s = await setup({ manual: false });
    const res = await s.call(`/jobs/${JOB}/procedure`, "a");
    expect(res.status).toBe(409);
    expect(s.asked).toEqual([]);
  });

  it("writes generic steps when the user chooses to", async () => {
    const s = await setup({ manual: false });
    const res = await s.call(`/jobs/${JOB}/procedure`, "a", { allowGeneric: true });
    expect(res.status).toBe(201);
    const body = GenerateProcedureResponse.parse(await res.json());
    if (body.status !== "created") throw new Error(body.status);
    expect(s.asked[0]!.manual).toBeNull();
    expect(body.detail.procedure.sourceType).toBe("generic");
    expect(body.detail.steps.every((x) => x.citation.kind === "generic")).toBe(true);
  });

  it("passes on a plain message when the model can't help, and saves nothing", async () => {
    const s = await setup({ answer: { status: "unavailable", message: GENERATE_UNAVAILABLE } });
    const res = await s.call(`/jobs/${JOB}/procedure`, "a");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "unavailable", message: GENERATE_UNAVAILABLE });
    expect(s.procedures.saves).toEqual([]);
  });

  it("writes a project's steps from its goal when there is no equipment, all Generic", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${NO_ASSET_JOB}/procedure`, "a", {
      task: "Assemble a 12U home server rack",
    });
    expect(res.status).toBe(201);
    const body = GenerateProcedureResponse.parse(await res.json());
    if (body.status !== "created") throw new Error(body.status);
    expect(s.asked[0]).toMatchObject({
      asset: null,
      manual: null,
      task: "Assemble a 12U home server rack",
    });
    // Nothing to cite: the model's page citations become Generic.
    expect(body.detail.steps.every((x) => x.citation.kind === "generic")).toBe(true);
    expect(s.procedures.saves[0]).toMatchObject({
      assetModelKey: "project|assemble a 12u home server rack",
      manualId: null,
    });
  });

  it("writes a project's steps from the manual attached to it, with its photos and notes", async () => {
    const s = await setup({ manual: false });
    await s.manualStorage.put(`${A}/kit.pdf`, await samplePdf(4), "application/pdf");
    const kit = await s.manuals.insert({
      assetModelKey: "project|assemble the pump",
      title: "Kit instructions",
      sourceType: "upload",
      sourceUrl: null,
      storageKey: `${A}/kit.pdf`,
      pageCount: 4,
      ownerId: A,
    });
    await s.manuals.recordAttached(NO_ASSET_JOB, kit.id, "upload");
    const where = await s.photo(NO_ASSET_JOB);
    const res = await s.call(`/jobs/${NO_ASSET_JOB}/procedure`, "a", {
      contextEvidenceIds: [where.id],
      notes: "The frame is already built.",
    });
    expect(res.status).toBe(201);
    expect(s.asked[0]).toMatchObject({
      asset: null,
      manual: { pages: 4 },
      notes: "The frame is already built.",
      photos: [{ mimeType: "image/jpeg" }],
    });
    expect(s.procedures.saves[0]).toMatchObject({ manualId: kit.id });
  });

  it("refuses context photos that aren't this job's photos", async () => {
    const s = await setup();
    const other = await s.photo(NO_ASSET_JOB);
    const audio = await s.photo(JOB, "audio");
    for (const id of [other.id, audio.id]) {
      const res = await s.call(`/jobs/${JOB}/procedure`, "a", { contextEvidenceIds: [id] });
      expect(res.status).toBe(404);
    }
    expect(s.asked).toHaveLength(0);
  });

  it("refuses a job that has steps, and others' jobs", async () => {
    const s = await setup();
    expect((await s.call(`/jobs/${JOB}/procedure`, "b")).status).toBe(404);
    s.jobsList[0] = job(JOB, ASSET, "00000000-0000-4000-8000-0000000000f1");
    expect((await s.call(`/jobs/${JOB}/procedure`, "a")).status).toBe(409);
    expect(s.asked).toEqual([]);
  });

  it("shows the procedure on the job", async () => {
    const s = await setup();
    await s.call(`/jobs/${JOB}/procedure`, "a");
    const saved = s.procedures.saves[0]!;
    s.jobsList[0] = job(JOB, ASSET, saved.procedureId);
    const res = await s.app.request(`/jobs/${JOB}`, { headers: { authorization: "Bearer a" } });
    const detail = JobDetailResponse.parse(await res.json());
    expect(detail.procedure?.procedure.id).toBe(saved.procedureId);
    expect(detail.procedure?.steps).toHaveLength(2);
  });
});

describe("metaProcedureGenerator", () => {
  const config = {
    apiKey: "k",
    baseUrl: "https://api.meta.ai/v1",
    timeoutMs: 1000,
    models: { reasoning: "muse-spark-1.3", segmentation: "sam-3.1", transcribe: "t" },
  };
  const okResponse = () =>
    new Response(
      JSON.stringify({
        id: "r1",
        status: "completed",
        model: "muse-spark-1.3",
        output: [
          { type: "message", content: [{ type: "output_text", text: JSON.stringify(DRAFT) }] },
        ],
      }),
      { status: 200 },
    );

  function scripted(replies: Response[]) {
    const calls: Array<{ url: string; method: string; body: string | FormData | undefined }> = [];
    const client = new MetaClient({
      apiKey: "k",
      sleep: async () => {},
      fetch: (async (url: string, init?: RequestInit) => {
        calls.push({
          url: String(url),
          method: init?.method ?? "GET",
          body: init?.body as string | FormData | undefined,
        });
        return replies.shift()!;
      }) as typeof fetch,
    });
    return { client, calls };
  }

  it("sends a small manual inline, without the Files API", async () => {
    const { client, calls } = scripted([okResponse()]);
    const g = metaProcedureGenerator(config as never, () => {}, client);
    const r = await g.generate({
      asset: { make: "FlowSet", model: "CR 3-10" },
      task: "Assemble",
      manual: { bytes: await samplePdf(2), pages: 2 },
    });
    expect(r.status).toBe("drafted");
    expect(calls.map((c) => c.url)).toEqual(["https://api.meta.ai/v1/responses"]);
    expect(String(calls[0]!.body)).toContain('"file_data":"data:application/pdf;base64,');
  });

  it("uploads a large manual, references it, and deletes it even when generation fails", async () => {
    const { client, calls } = scripted([
      new Response(JSON.stringify({ id: "file-7" }), { status: 200 }),
      new Response(
        JSON.stringify({
          error: { message: "billing", type: "x", code: "billing_not_configured" },
        }),
        {
          status: 402,
        },
      ),
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    ]);
    const g = metaProcedureGenerator(config as never, () => {}, client);
    const big = new Uint8Array(40 * 1024 * 1024);
    const r = await g.generate({
      asset: { make: "FlowSet", model: "CR 3-10" },
      task: "Assemble",
      manual: { bytes: big, pages: 300 },
    });
    expect(r).toEqual({ status: "unavailable", message: GENERATE_UNAVAILABLE });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["POST", "https://api.meta.ai/v1/files"],
      ["POST", "https://api.meta.ai/v1/responses"],
      ["DELETE", "https://api.meta.ai/v1/files/file-7"],
    ]);
    expect(String(calls[1]!.body)).toContain('"file_id":"file-7"');
    expect((calls[0]!.body as FormData).get("expires_after[seconds]")).toBe("3600");
  });
});
