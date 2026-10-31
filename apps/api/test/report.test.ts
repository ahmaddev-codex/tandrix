import {
  CreateShareResponse,
  JobReportResponse,
  type Job,
  type JobStep,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import { LINK_GONE, MAX_ACTIVE_SHARES } from "../src/routes/report";
import {
  memoryAssets,
  memoryEvidence,
  memoryProcedures,
  memoryReports,
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
const PSTEP = ["c001", "c002", "c003"].map((x) => `00000000-0000-4000-8000-00000000${x}`);
const JSTEP = ["e001", "e002", "e003"].map((x) => `00000000-0000-4000-8000-00000000${x}`);
const T0 = Date.UTC(2026, 9, 26, 10);

const step = (order: number, title: string): ProcedureDraft["steps"][number] => ({
  order,
  surface: "physical",
  title,
  instruction: title,
  partRefs: [],
  hazardTags: [],
  verification: "photo",
  expectedState: "Done.",
  citation: { kind: "generic" },
});

async function setup() {
  let clock = T0;
  const procedures = memoryProcedures();
  await procedures.save({
    ownerId: A,
    jobId: JOB,
    procedureId: PROC,
    assetModelKey: "project|rack",
    manualId: null,
    // Saved out of order on purpose: the report follows the procedure's order.
    draft: {
      title: "Rack",
      parts: [],
      steps: [step(1, "Check the parts"), step(2, "Fit the rails"), step(3, "Mount the server")],
    },
    partIds: new Map(),
    stepIds: PSTEP,
    surface: "phone",
    event: {},
  });
  const evidence = memoryEvidence(new Map([[JOB, A]]));
  const storage = memoryStorage();
  const photo = await evidence.createPending({
    id: crypto.randomUUID(),
    jobId: JOB,
    jobStepId: JSTEP[0]!,
    kind: "photo",
    surface: "phone",
    storageKey: `${A}/${JOB}/p.png`,
    mimeType: "image/png",
    byteSize: PNG.length,
    width: 10,
    height: 10,
    capturedAt: "2026-10-26T10:05:00.000Z",
  });
  await storage.put(photo.storageKey, PNG, "image/png");
  await evidence.markUploaded(photo.id, PNG.length);
  const statuses: JobStep["status"][] = ["verified", "skipped", "needs_attention"];
  const steps: JobStep[] = JSTEP.map((id, i) => ({
    id,
    jobId: JOB,
    procedureStepId: PSTEP[i]!,
    status: statuses[i]!,
    statusEvidenceId: i === 0 ? photo.id : null,
    startedAt: null,
    updatedAt: "2026-10-26T10:10:00.000Z",
    updatedBySurface: "phone",
    ...(i === 1 ? { note: "Rails came pre-fitted." } : {}),
  }));
  const job = {
    id: JOB,
    ownerId: A,
    assetId: null,
    procedureId: PROC,
    title: "Home server rack",
    status: "active",
    createdAt: "2026-10-26T09:00:00.000Z",
    updatedAt: "2026-10-26T10:10:00.000Z",
  } as Job;
  const jobs = {
    async getForOwner(o: string, id: string) {
      return o === A && id === JOB ? { job, steps: [...steps].reverse() } : null;
    },
  } as unknown as JobsRepo;
  const reports = memoryReports(new Map([[JOB, A]]));
  reports.checks.push(
    {
      jobStepId: JSTEP[2]!,
      evidenceId: photo.id,
      result: "pass",
      reason: "Earlier.",
      createdAt: "2026-10-26T10:06:00.000Z",
    },
    {
      jobStepId: JSTEP[2]!,
      evidenceId: photo.id,
      result: "fail",
      reason: "The server sits a rail low.",
      createdAt: "2026-10-26T10:08:00.000Z",
    },
  );
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
    reports,
    now: () => clock,
    corsOrigins: [],
    log: () => {},
  });
  const call = (path: string, init: { method?: string; token?: string; body?: object } = {}) =>
    app.request(path, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  return { call, reports, advance: (ms: number) => (clock += ms) };
}

describe("job report", () => {
  it("lists steps in order with status, reason, latest check and a short-lived photo link", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${JOB}/report`, { token: "a" });
    expect(res.status).toBe(200);
    const r = JobReportResponse.parse(await res.json());
    expect(r.steps.map((x) => [x.index, x.status])).toEqual([
      [1, "verified"],
      [2, "skipped"],
      [3, "needs_attention"],
    ]);
    expect(r.steps[0]!.evidence).toMatchObject({ kind: "photo" });
    expect(r.steps[1]!.note).toBe("Rails came pre-fitted.");
    expect(r.steps[2]!.check).toEqual({ result: "fail", reason: "The server sits a rail low." });
    // Skipped steps aren't unresolved; they carry their reason.
    expect(r.counts).toEqual({ verified: 1, confirmed: 0, attention: 1, unresolved: 0 });
    expect(r.equipment).toBeNull();
  });

  it("is the owner's only", async () => {
    const s = await setup();
    expect((await s.call(`/jobs/${JOB}/report`, { token: "b" })).status).toBe(404);
    expect((await s.call(`/jobs/${JOB}/report`)).status).toBe(401);
  });
});

describe("share links", () => {
  it("opens the same report signed out, uncached, until it expires", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${JOB}/share`, {
      method: "POST",
      token: "a",
      body: { days: 2 },
    });
    expect(res.status).toBe(201);
    const { token, link } = CreateShareResponse.parse(await res.json());
    expect(link.expiresAt).toBe("2026-10-28T10:00:00.000Z");
    // Only the hash is kept.
    expect(JSON.stringify(s.reports.links)).not.toContain(token);

    const pub = await s.call(`/report/${token}`);
    expect(pub.status).toBe(200);
    expect(pub.headers.get("cache-control")).toBe("private, no-store");
    expect(pub.headers.get("x-robots-tag")).toBe("noindex");
    const owner = await (await s.call(`/jobs/${JOB}/report`, { token: "a" })).json();
    expect(JobReportResponse.parse(await pub.json()).steps).toEqual(
      JobReportResponse.parse(owner).steps,
    );

    s.advance(2 * 86_400_000);
    const gone = await s.call(`/report/${token}`);
    expect(gone.status).toBe(404);
    expect(((await gone.json()) as { error: { message: string } }).error.message).toBe(LINK_GONE);
  });

  it("can be turned off, and only by the owner", async () => {
    const s = await setup();
    const { token, link } = CreateShareResponse.parse(
      await (await s.call(`/jobs/${JOB}/share`, { method: "POST", token: "a", body: {} })).json(),
    );
    expect(link.expiresAt).toBe("2026-11-02T10:00:00.000Z");
    expect(
      (await s.call(`/jobs/${JOB}/share/${link.id}`, { method: "DELETE", token: "b" })).status,
    ).toBe(404);
    expect((await s.call(`/report/${token}`)).status).toBe(200);
    expect(
      (await s.call(`/jobs/${JOB}/share/${link.id}`, { method: "DELETE", token: "a" })).status,
    ).toBe(204);
    expect((await s.call(`/report/${token}`)).status).toBe(404);
    const { links } = (await (await s.call(`/jobs/${JOB}/share`, { token: "a" })).json()) as {
      links: Array<{ revokedAt: string | null }>;
    };
    expect(links[0]!.revokedAt).not.toBeNull();
  });

  it("caps live links per job; turning one off frees a slot", async () => {
    const s = await setup();
    const mint = () =>
      s.call(`/jobs/${JOB}/share`, { method: "POST", token: "a", body: { days: 2 } });
    for (let i = 0; i < MAX_ACTIVE_SHARES; i++) expect((await mint()).status).toBe(201);
    expect((await mint()).status).toBe(409);
    const { links } = (await (await s.call(`/jobs/${JOB}/share`, { token: "a" })).json()) as {
      links: Array<{ id: string }>;
    };
    expect(
      (await s.call(`/jobs/${JOB}/share/${links[0]!.id}`, { method: "DELETE", token: "a" })).status,
    ).toBe(204);
    expect((await mint()).status).toBe(201);
  });

  it("refuses others' jobs, bad lengths and made-up tokens", async () => {
    const s = await setup();
    expect(
      (await s.call(`/jobs/${JOB}/share`, { method: "POST", token: "b", body: {} })).status,
    ).toBe(404);
    expect(
      (await s.call(`/jobs/${JOB}/share`, { method: "POST", token: "a", body: { days: 90 } }))
        .status,
    ).toBe(400);
    expect((await s.call(`/report/short`)).status).toBe(404);
    expect((await s.call(`/report/${"x".repeat(43)}`)).status).toBe(404);
  });
});
