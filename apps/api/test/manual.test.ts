import {
  CreateManualUploadResponse,
  ManualResponse,
  ManualSearchResponse,
  type Asset,
  type Job,
} from "@tandrix/contracts";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { ManualFinder } from "../src/manual-finder";
import type { JobsRepo } from "../src/repos/jobs";
import type { Transport } from "../src/safe-fetch";
import {
  memoryAssets,
  memoryEvidence,
  memoryManuals,
  memoryStorage,
  scriptedReader,
  TEST_TOKEN_SECRET,
} from "./fakes";
import { PNG, samplePdf } from "./fixtures";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const NO_ASSET_JOB = "00000000-0000-4000-8000-000000000002";
const B_JOB = "00000000-0000-4000-8000-000000000003";
const ASSET = "00000000-0000-4000-8000-0000000000a1";
const B_ASSET = "00000000-0000-4000-8000-0000000000b1";
const URL1 = "https://maker.example/cr-manual.pdf";

const job = (id: string, ownerId: string, assetId: string | null): Job => ({
  id,
  ownerId,
  assetId,
  procedureId: null,
  title: "Pump",
  status: "active",
  currentStepId: null,
  activeSurface: "phone",
  controlMode: "show",
  language: "en",
  createdAt: "2026-10-26T10:00:00.000Z",
  updatedAt: "2026-10-26T10:00:00.000Z",
});

const asset = (id: string, ownerId: string): Asset => ({
  id,
  ownerId,
  category: "equipment",
  make: "FlowSet",
  model: "CR 3-10",
  nameplateEvidenceId: null,
  createdAt: "2026-10-26T10:00:00.000Z",
});

async function setup(
  opts: {
    finder?: ManualFinder;
    routes?: Record<string, Awaited<ReturnType<Transport["get"]>>>;
  } = {},
) {
  const jobsList = [job(JOB, A, ASSET), job(NO_ASSET_JOB, A, null), job(B_JOB, B, B_ASSET)];
  const jobs = {
    async getForOwner(ownerId: string, id: string) {
      const j = jobsList.find((x) => x.id === id && x.ownerId === ownerId);
      return j ? { job: j, steps: [] } : null;
    },
  } as unknown as JobsRepo;
  const assets = memoryAssets();
  assets.assets.set(ASSET, asset(ASSET, A));
  assets.assets.set(B_ASSET, asset(B_ASSET, B));
  const evidence = memoryEvidence(
    new Map([
      [JOB, A],
      [NO_ASSET_JOB, A],
      [B_JOB, B],
    ]),
  );
  const evidenceStorage = memoryStorage();
  const manuals = memoryManuals();
  const manualStorage = memoryStorage();
  const connections: string[] = [];
  let clock = Date.UTC(2026, 9, 26, 10);
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence,
    storage: evidenceStorage,
    assets,
    nameplateReader: scriptedReader(),
    manuals,
    manualStorage,
    manualFinder:
      opts.finder ??
      ({
        async find() {
          return {
            status: "found",
            candidates: [
              {
                url: URL1,
                title: "CR 3-10 installation manual",
                official: true,
                documentType: "installation_manual",
                confidence: 0.9,
              },
            ],
          };
        },
      } satisfies ManualFinder),
    tokenSecret: TEST_TOKEN_SECRET,
    manualFetch: {
      resolve: async () => [{ address: "93.184.215.14", family: 4 }],
      transport: {
        async get(url) {
          connections.push(url.toString());
          return opts.routes?.[url.toString()] ?? { status: 404 };
        },
      },
    },
    now: () => clock,
    corsOrigins: [],
    log: () => {},
  });
  const call = (path: string, token: string, method = "POST", body?: object) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const photo = async (jobId: string, mimeType = "image/png", uploaded = true) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId,
      jobStepId: null,
      kind: "photo",
      surface: "phone",
      storageKey: `${A}/${jobId}/${crypto.randomUUID()}`,
      mimeType,
      byteSize: PNG.length,
      capturedAt: "2026-10-26T10:00:00.000Z",
    });
    await evidenceStorage.put(ev.storageKey, PNG, mimeType);
    return uploaded ? evidence.markUploaded(ev.id, PNG.length) : ev;
  };
  return {
    call,
    manuals,
    manualStorage,
    connections,
    photo,
    advance: (ms: number) => (clock += ms),
  };
}

const search = async (s: Awaited<ReturnType<typeof setup>>, token = "a", jobId = JOB) => {
  const res = await s.call(`/jobs/${jobId}/manual/search`, token);
  return { res, body: ManualSearchResponse.parse(await res.json()) };
};

/** The first candidate's token, failing the test if the search didn't find any. */
const firstToken = (b: ManualSearchResponse) => {
  if (b.status !== "found" || !b.candidates[0]) throw new Error(`no candidates: ${b.status}`);
  return b.candidates[0].token;
};

const ErrorBody = z.object({ error: z.object({ message: z.string() }) });
const UrlBody = z.object({ url: z.string() });

describe("POST /jobs/:id/manual/search", () => {
  it("returns signed candidates", async () => {
    const s = await setup();
    const { res, body } = await search(s);
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ status: "found", candidates: [{ url: URL1, official: true }] });
    expect(firstToken(body)).toMatch(/^\d+\.[\w-]+$/);
  });

  it("returns the cached manual without searching", async () => {
    let searched = 0;
    const s = await setup({
      finder: {
        async find() {
          searched++;
          return { status: "unavailable", message: "off" };
        },
      },
    });
    const cached = await s.manuals.insert({
      assetModelKey: "flowset|cr 3-10",
      title: "Shared",
      sourceType: "search",
      sourceUrl: URL1,
      storageKey: "shared/x.pdf",
      pageCount: 2,
      ownerId: null,
    });
    const { body } = await search(s);
    expect(body).toEqual({ status: "cached", manual: cached });
    expect(searched).toBe(0);
  });

  it("doesn't return another user's private manual", async () => {
    const s = await setup();
    await s.manuals.insert({
      assetModelKey: "flowset|cr 3-10",
      title: "B's private copy",
      sourceType: "upload",
      sourceUrl: null,
      storageKey: `${B}/x.pdf`,
      pageCount: 2,
      ownerId: B,
    });
    const { body } = await search(s);
    expect(body.status).toBe("found");
  });

  it("reports unavailable search plainly", async () => {
    const s = await setup({
      finder: {
        async find() {
          return { status: "unavailable", message: "Upload it instead." };
        },
      },
    });
    const { body } = await search(s);
    expect(body).toEqual({ status: "unavailable", message: "Upload it instead." });
  });

  it("needs the equipment identified first", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${NO_ASSET_JOB}/manual/search`, "a");
    expect(res.status).toBe(409);
  });

  it("hides other users' jobs", async () => {
    const s = await setup();
    expect((await s.call(`/jobs/${JOB}/manual/search`, "b")).status).toBe(404);
    expect((await s.call(`/jobs/not-a-uuid/manual/search`, "a")).status).toBe(404);
  });
});

describe("POST /jobs/:id/manual/fetch", () => {
  const fetchManual = (s: Awaited<ReturnType<typeof setup>>, body: object, token = "a") =>
    s.call(`/jobs/${JOB}/manual/fetch`, token, "POST", body);

  it("downloads a searched manual, stores it as shared, and records the event", async () => {
    const s = await setup({ routes: { [URL1]: { status: 200, body: await samplePdf(4) } } });
    const { body: found } = await search(s);
    const res = await fetchManual(s, {
      url: URL1,
      title: "CR manual",
      token: firstToken(found),
    });
    expect(res.status).toBe(201);
    const { manual } = ManualResponse.parse(await res.json());
    expect(manual).toMatchObject({ pageCount: 4, sourceType: "search", sourceUrl: URL1 });
    expect(manual.storageKey).toMatch(/^shared\/.+\.pdf$/);
    expect(s.manualStorage.objects.get(manual.storageKey)?.contentType).toBe("application/pdf");
    expect(s.manuals.manuals[0]!.ownerId).toBeNull();
    expect(s.manuals.events).toEqual([{ jobId: JOB, manualId: manual.id, how: "search" }]);
  });

  it("refuses a URL the search didn't return, without connecting", async () => {
    const s = await setup();
    const { body: found } = await search(s);
    const res = await fetchManual(s, {
      url: "https://evil.example/fake.pdf",
      title: "x",
      token: firstToken(found),
    });
    expect(res.status).toBe(400);
    expect(s.connections).toEqual([]);
  });

  it("refuses another user's token", async () => {
    const s = await setup();
    const { body: found } = await search(s, "b", B_JOB);
    const res = await fetchManual(s, { url: URL1, title: "x", token: firstToken(found) });
    expect(res.status).toBe(400);
    expect(s.connections).toEqual([]);
  });

  it("refuses an expired token", async () => {
    const s = await setup();
    const { body: found } = await search(s);
    s.advance(31 * 60 * 1000);
    const res = await fetchManual(s, { url: URL1, title: "x", token: firstToken(found) });
    expect(res.status).toBe(400);
  });

  it("refuses http links at validation", async () => {
    const s = await setup();
    const res = await fetchManual(s, {
      url: "http://maker.example/m.pdf",
      title: "x",
      token: "1.a",
    });
    expect(res.status).toBe(400);
  });

  it("explains a link that isn't a PDF", async () => {
    const s = await setup({
      routes: { [URL1]: { status: 200, body: new TextEncoder().encode("<html>sign in</html>") } },
    });
    const { body: found } = await search(s);
    const res = await fetchManual(s, { url: URL1, title: "x", token: firstToken(found) });
    expect(res.status).toBe(422);
    expect(ErrorBody.parse(await res.json()).error.message).toMatch(/isn't a PDF/);
    expect(s.manuals.manuals).toEqual([]);
  });

  it("rejects a PDF that won't open", async () => {
    const s = await setup({
      routes: { [URL1]: { status: 200, body: new TextEncoder().encode("%PDF-1.7 broken") } },
    });
    const { body: found } = await search(s);
    const res = await fetchManual(s, { url: URL1, title: "x", token: firstToken(found) });
    expect(res.status).toBe(422);
    expect(s.manualStorage.objects.size).toBe(0);
  });
});

describe("manual upload", () => {
  it("issues an upload URL, then checks the file and saves a private manual", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${JOB}/manual/upload`, "a", "POST", {
      byteSize: 1000,
      title: "Site copy",
    });
    expect(res.status).toBe(201);
    const { uploadId, upload } = CreateManualUploadResponse.parse(await res.json());
    expect(upload.bucket).toBe("manuals");
    expect(upload.path).toBe(`${A}/${uploadId}.pdf`);

    // Completing before the file arrives is a clear conflict.
    const early = await s.call(`/jobs/${JOB}/manual/upload/${uploadId}/complete`, "a");
    expect(early.status).toBe(409);

    await s.manualStorage.put(upload.path, await samplePdf(2), "application/pdf");
    const done = await s.call(`/jobs/${JOB}/manual/upload/${uploadId}/complete`, "a");
    expect(done.status).toBe(201);
    const { manual } = ManualResponse.parse(await done.json());
    expect(manual).toMatchObject({
      title: "Site copy",
      pageCount: 2,
      sourceType: "upload",
      sourceUrl: null,
    });
    expect(s.manuals.manuals[0]!.ownerId).toBe(A);
    expect(s.manuals.events[0]).toMatchObject({ how: "upload" });

    // Each upload completes once.
    const again = await s.call(`/jobs/${JOB}/manual/upload/${uploadId}/complete`, "a");
    expect(again.status).toBe(404);
  });

  it("removes a file that isn't a PDF", async () => {
    const s = await setup();
    const { uploadId, upload } = CreateManualUploadResponse.parse(
      await (
        await s.call(`/jobs/${JOB}/manual/upload`, "a", "POST", { byteSize: 10, title: "x" })
      ).json(),
    );
    await s.manualStorage.put(
      upload.path,
      new TextEncoder().encode("MZ executable"),
      "application/pdf",
    );
    const res = await s.call(`/jobs/${JOB}/manual/upload/${uploadId}/complete`, "a");
    expect(res.status).toBe(400);
    expect(s.manualStorage.removed).toEqual([upload.path]);
    expect(s.manuals.manuals).toEqual([]);
  });

  it("won't let another user complete it", async () => {
    const s = await setup();
    const { uploadId } = CreateManualUploadResponse.parse(
      await (
        await s.call(`/jobs/${JOB}/manual/upload`, "a", "POST", { byteSize: 10, title: "x" })
      ).json(),
    );
    expect((await s.call(`/jobs/${B_JOB}/manual/upload/${uploadId}/complete`, "b")).status).toBe(
      404,
    );
  });
});

describe("POST /jobs/:id/manual/from-photos", () => {
  it("combines uploaded photos into a private PDF, one page each", async () => {
    const s = await setup();
    const p1 = await s.photo(JOB);
    const p2 = await s.photo(JOB);
    const res = await s.call(`/jobs/${JOB}/manual/from-photos`, "a", "POST", {
      evidenceIds: [p1.id, p2.id],
      title: "Photographed manual",
    });
    expect(res.status).toBe(201);
    const { manual } = ManualResponse.parse(await res.json());
    expect(manual.pageCount).toBe(2);
    expect(s.manualStorage.objects.get(manual.storageKey)?.contentType).toBe("application/pdf");
    expect(s.manuals.manuals[0]!.ownerId).toBe(A);
    expect(s.manuals.events[0]).toMatchObject({ how: "photos" });
  });

  it("refuses photos that aren't uploaded or aren't on this job", async () => {
    const s = await setup();
    const pending = await s.photo(JOB, "image/png", false);
    const elsewhere = await s.photo(NO_ASSET_JOB);
    for (const id of [pending.id, elsewhere.id]) {
      const res = await s.call(`/jobs/${JOB}/manual/from-photos`, "a", "POST", {
        evidenceIds: [id],
        title: "x",
      });
      expect(res.status).toBe(404);
    }
  });
});

describe("GET /jobs/:id/manual/:manualId/url", () => {
  it("signs a read URL for a manual the user can see, and hides others' private ones", async () => {
    const s = await setup();
    const shared = await s.manuals.insert({
      assetModelKey: "flowset|cr 3-10",
      title: "Shared",
      sourceType: "search",
      sourceUrl: URL1,
      storageKey: "shared/a.pdf",
      pageCount: 1,
      ownerId: null,
    });
    const privateB = await s.manuals.insert({
      assetModelKey: "flowset|cr 3-10",
      title: "B's",
      sourceType: "upload",
      sourceUrl: null,
      storageKey: `${B}/b.pdf`,
      pageCount: 1,
      ownerId: B,
    });
    await s.manualStorage.put("shared/a.pdf", await samplePdf(1), "application/pdf");
    await s.manualStorage.put(`${B}/b.pdf`, await samplePdf(1), "application/pdf");

    const ok = await s.call(`/jobs/${JOB}/manual/${shared.id}/url`, "a", "GET");
    expect(ok.status).toBe(200);
    expect(UrlBody.parse(await ok.json()).url).toContain("shared/a.pdf");

    expect((await s.call(`/jobs/${JOB}/manual/${privateB.id}/url`, "a", "GET")).status).toBe(404);
  });
});
