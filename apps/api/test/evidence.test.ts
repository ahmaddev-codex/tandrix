import { CreateEvidenceResponse, EvidenceWithUrl } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import { memoryAssets, memoryEvidence, memoryStorage, scriptedReader, noManuals } from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "not-a-uuid";
const JOB_OK = "00000000-0000-4000-8000-000000000001";
const STEP = "00000000-0000-4000-8000-000000000051";
const OTHER_STEP = "00000000-0000-4000-8000-000000000052";

function setup() {
  const evidence = memoryEvidence(new Map([[JOB_OK, A]]), new Map([[STEP, JOB_OK]]));
  const storage = memoryStorage();
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs: {} as JobsRepo,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    corsOrigins: [],
    log: () => {},
  });
  const call = (path: string, token: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    });
  const photo = {
    kind: "photo",
    mimeType: "image/jpeg",
    byteSize: 420_000,
    surface: "phone",
    width: 2048,
    height: 1536,
  };
  const create = (token = "a", body: object = photo, job = JOB_OK) =>
    call(`/jobs/${job}/evidence`, token, { method: "POST", body: JSON.stringify(body) });
  return { evidence, storage, call, create };
}

describe("POST /jobs/:id/evidence", () => {
  it("creates pending evidence under the owner's folder and returns an upload URL", async () => {
    const { create } = setup();
    const res = await create();
    expect(res.status).toBe(201);
    const body = CreateEvidenceResponse.parse(await res.json());
    expect(body.evidence).toMatchObject({
      jobId: JOB_OK,
      uploadedAt: null,
      mimeType: "image/jpeg",
    });
    expect(body.evidence.storageKey).toBe(`${A}/${JOB_OK}/${body.evidence.id}.jpg`);
    expect(body.upload).toMatchObject({ bucket: "evidence", path: body.evidence.storageKey });
  });

  it("refuses someone else's job, unknown jobs and bad ids alike", async () => {
    const { create } = setup();
    expect((await create("b")).status).toBe(404);
    expect((await create("a", undefined, "00000000-0000-4000-8000-000000000099")).status).toBe(404);
    expect((await create("a", undefined, JOB)).status).toBe(404);
  });

  it("refuses a step from another job", async () => {
    const { create } = setup();
    const photo = { kind: "photo", mimeType: "image/jpeg", byteSize: 1000, surface: "phone" };
    expect((await create("a", { ...photo, jobStepId: STEP })).status).toBe(201);
    expect((await create("a", { ...photo, jobStepId: OTHER_STEP })).status).toBe(404);
  });

  it("enforces type and size limits before issuing an upload URL", async () => {
    const { create, evidence } = setup();
    const bad = [
      { kind: "photo", mimeType: "application/x-sh", byteSize: 10, surface: "phone" },
      { kind: "photo", mimeType: "image/jpeg", byteSize: 99 * 1024 * 1024, surface: "phone" },
    ];
    for (const b of bad) expect((await create("a", b)).status).toBe(400);
    expect(evidence.rows.size).toBe(0);
  });
});

describe("POST /jobs/:id/evidence/:eid/complete", () => {
  it("confirms only once the file is in storage, recording its real size", async () => {
    const { create, call, storage } = setup();
    const { evidence } = CreateEvidenceResponse.parse(await (await create()).json());
    const complete = () =>
      call(`/jobs/${JOB_OK}/evidence/${evidence.id}/complete`, "a", { method: "POST" });

    expect((await complete()).status).toBe(409);
    storage.objects.set(evidence.storageKey, { size: 401_234, contentType: "image/jpeg" });
    const ok = await complete();
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      evidence: { byteSize: 401_234, uploadedAt: expect.any(String) },
    });
    expect((await complete()).status).toBe(200); // idempotent
  });

  it("rejects and deletes a file whose real type isn't allowed", async () => {
    const { create, call, storage } = setup();
    const { evidence } = CreateEvidenceResponse.parse(await (await create()).json());
    storage.objects.set(evidence.storageKey, { size: 1000, contentType: "text/html" });
    const res = await call(`/jobs/${JOB_OK}/evidence/${evidence.id}/complete`, "a", {
      method: "POST",
    });
    expect(res.status).toBe(400);
    expect(storage.removed).toEqual([evidence.storageKey]);
  });

  it("rejects an empty or oversized file", async () => {
    const { create, call, storage } = setup();
    for (const size of [0, 50 * 1024 * 1024]) {
      const { evidence } = CreateEvidenceResponse.parse(await (await create()).json());
      storage.objects.set(evidence.storageKey, { size, contentType: "image/jpeg" });
      expect(
        (await call(`/jobs/${JOB_OK}/evidence/${evidence.id}/complete`, "a", { method: "POST" }))
          .status,
      ).toBe(400);
    }
  });

  it("won't let another user confirm", async () => {
    const { create, call } = setup();
    const { evidence } = CreateEvidenceResponse.parse(await (await create()).json());
    expect(
      (await call(`/jobs/${JOB_OK}/evidence/${evidence.id}/complete`, "b", { method: "POST" }))
        .status,
    ).toBe(404);
  });
});

describe("GET /jobs/:id/evidence", () => {
  it("lists only confirmed uploads, each with a short-lived URL", async () => {
    const { create, call, storage } = setup();
    const first = CreateEvidenceResponse.parse(await (await create()).json()).evidence;
    CreateEvidenceResponse.parse(await (await create()).json()); // never uploaded
    storage.objects.set(first.storageKey, { size: 1000, contentType: "image/jpeg" });
    await call(`/jobs/${JOB_OK}/evidence/${first.id}/complete`, "a", { method: "POST" });

    const res = await call(`/jobs/${JOB_OK}/evidence`, "a");
    const { items } = (await res.json()) as { items: unknown[] };
    expect(items).toHaveLength(1);
    const item = EvidenceWithUrl.parse(items[0]);
    expect(item.evidence.id).toBe(first.id);
    expect(item.url).toContain(first.storageKey);
    expect((await call(`/jobs/${JOB_OK}/evidence`, "b")).status).toBe(404);
  });
});
