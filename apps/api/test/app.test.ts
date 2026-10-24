import { Job } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { dbError } from "../src/errors";
import type { JobsRepo, NewJob } from "../src/repos/jobs";
import { memoryAssets, memoryEvidence, memoryStorage, scriptedReader } from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ASSET = "00000000-0000-4000-8000-0000000000a1";

function memoryRepo(): JobsRepo & { jobs: Job[] } {
  const jobs: Job[] = [];
  let n = 0;
  return {
    jobs,
    async create(input: NewJob) {
      const now = new Date(Date.UTC(2026, 9, 26, 10, 0, n)).toISOString();
      const job: Job = {
        id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
        ownerId: input.ownerId,
        assetId: input.assetId ?? null,
        procedureId: null,
        title: input.title,
        status: "active",
        currentStepId: null,
        activeSurface: input.surface,
        controlMode: "show",
        language: input.language,
        createdAt: now,
        updatedAt: now,
      };
      jobs.push(job);
      return job;
    },
    async listForOwner(ownerId, limit) {
      return jobs
        .filter((j) => j.ownerId === ownerId)
        .reverse()
        .slice(0, limit);
    },
    async getForOwner(ownerId, id) {
      const job = jobs.find((j) => j.id === id && j.ownerId === ownerId);
      return job ? { job, steps: [] } : null;
    },
    async ownsAsset(ownerId, assetId) {
      return ownerId === A && assetId === ASSET;
    },
  };
}

function setup() {
  const repo = memoryRepo();
  const logs: Array<Record<string, unknown>> = [];
  const app = createApp({
    verifyToken: async (t) => (t === "token-a" ? { id: A } : t === "token-b" ? { id: B } : null),
    jobs: repo,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    corsOrigins: ["http://localhost:5173"],
    log: (l) => logs.push(l),
  });
  const call = (path: string, init: RequestInit & { token?: string } = {}) =>
    app.request(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
  return { app, repo, logs, call };
}

const create = { title: "Pump P-100 assembly", surface: "phone" };

describe("health", () => {
  it("needs no auth and reveals nothing", async () => {
    const res = await setup().call("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("auth", () => {
  it("rejects missing, malformed and invalid tokens", async () => {
    const { call } = setup();
    const cases: Array<Record<string, string>> = [
      {},
      { authorization: "token-a" },
      { authorization: "Bearer nope" },
    ];
    for (const headers of cases) {
      const res = await call("/jobs", { headers });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
    }
  });
});

describe("POST /jobs", () => {
  it("creates a job owned by the caller with defaults", async () => {
    const { call } = setup();
    const res = await call("/jobs", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify(create),
    });
    expect(res.status).toBe(201);
    const { job } = (await res.json()) as { job: Job };
    expect(Job.parse(job)).toMatchObject({
      ownerId: A,
      language: "en",
      controlMode: "show",
      activeSurface: "phone",
    });
  });

  it("ignores an owner supplied in the body", async () => {
    const { call } = setup();
    const res = await call("/jobs", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify({ ...create, ownerId: B }),
    });
    // Unknown keys are rejected outright rather than silently dropped.
    expect(res.status).toBe(400);
  });

  it("validates the body", async () => {
    const { call } = setup();
    for (const body of [
      "not json",
      JSON.stringify({}),
      JSON.stringify({ ...create, title: "" }),
      JSON.stringify({ ...create, surface: "watch" }),
    ]) {
      const res = await call("/jobs", { method: "POST", token: "token-a", body });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: { code: "invalid_request" } });
    }
  });

  it("refuses an asset that isn't the caller's", async () => {
    const { call } = setup();
    const ok = await call("/jobs", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify({ ...create, assetId: ASSET }),
    });
    expect(ok.status).toBe(201);
    const other = await call("/jobs", {
      method: "POST",
      token: "token-b",
      body: JSON.stringify({ ...create, assetId: ASSET }),
    });
    expect(other.status).toBe(404);
  });
});

describe("GET /jobs and /jobs/:id", () => {
  it("lists only the caller's jobs, newest first", async () => {
    const { call } = setup();
    await call("/jobs", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify({ ...create, title: "First" }),
    });
    await call("/jobs", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify({ ...create, title: "Second" }),
    });
    await call("/jobs", {
      method: "POST",
      token: "token-b",
      body: JSON.stringify({ ...create, title: "B's" }),
    });
    const a = (await (await call("/jobs", { token: "token-a" })).json()) as { jobs: Job[] };
    expect(a.jobs.map((j) => j.title)).toEqual(["Second", "First"]);
    const b = (await (await call("/jobs", { token: "token-b" })).json()) as { jobs: Job[] };
    expect(b.jobs.map((j) => j.title)).toEqual(["B's"]);
  });

  it("caps the list limit", async () => {
    const { call } = setup();
    expect((await call("/jobs?limit=500", { token: "token-a" })).status).toBe(400);
  });

  it("returns 404 for someone else's job and for bad ids, identically", async () => {
    const { call } = setup();
    const created = (await (
      await call("/jobs", { method: "POST", token: "token-a", body: JSON.stringify(create) })
    ).json()) as { job: Job };
    const mine = await call(`/jobs/${created.job.id}`, { token: "token-a" });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toMatchObject({ job: { id: created.job.id }, steps: [] });

    const theirs = await call(`/jobs/${created.job.id}`, { token: "token-b" });
    const bogus = await call("/jobs/not-a-uuid", { token: "token-b" });
    expect(theirs.status).toBe(404);
    expect(await theirs.json()).toEqual(await bogus.json());
  });
});

describe("errors and logging", () => {
  it("turns a plain-object error (as Supabase throws) into a logged JSON 500", async () => {
    const s = setup();
    s.repo.listForOwner = async () => {
      throw { message: "boom", code: "XX000", details: null };
    };
    const res = await s.app.request("/jobs", { headers: { authorization: "Bearer token-a" } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal", message: "Something went wrong. Try again." },
    });
    expect(s.logs.some((l) => l.level === "error")).toBe(true);
    expect(s.logs.at(-1)).toMatchObject({ method: "GET", path: "/jobs", status: 500 });
  });

  it("maps a missing owner (deleted account, live token) to 401", async () => {
    const s = setup();
    s.repo.create = async () => {
      throw dbError({
        code: "23503",
        message:
          'insert or update on table "jobs" violates foreign key constraint "jobs_owner_id_fkey"',
      });
    };
    const res = await s.call("/jobs", {
      method: "POST",
      token: "token-a",
      body: JSON.stringify(create),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("hides internal errors and logs without bodies or tokens", async () => {
    const { app, logs } = (() => {
      const s = setup();
      s.repo.listForOwner = async () => {
        throw new Error("db exploded: password=hunter2");
      };
      return s;
    })();
    const res = await app.request("/jobs", { headers: { authorization: "Bearer token-a" } });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "internal", message: "Something went wrong. Try again." },
    });
    expect(JSON.stringify(logs)).not.toContain("token-a");
    expect(logs.at(-1)).toMatchObject({ method: "GET", path: "/jobs", status: 500 });
  });

  it("allows only configured CORS origins", async () => {
    const { call } = setup();
    const ok = await call("/health", { headers: { origin: "http://localhost:5173" } });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const bad = await call("/health", { headers: { origin: "https://evil.example" } });
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });
});
