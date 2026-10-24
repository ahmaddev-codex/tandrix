import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import { memoryAssets, memoryEvidence, memoryStorage, scriptedReader, noManuals } from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-000000000001";
const OTHER_JOB = "00000000-0000-4000-8000-000000000002";

async function setup(answers: Parameters<typeof scriptedReader>[0] = []) {
  const evidence = memoryEvidence(
    new Map([
      [JOB, A],
      [OTHER_JOB, A],
    ]),
  );
  const storage = memoryStorage();
  const assets = memoryAssets();
  const reader = scriptedReader(answers);
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs: {} as JobsRepo,
    evidence,
    storage,
    assets,
    nameplateReader: reader,
    ...noManuals(),
    corsOrigins: [],
    log: () => {},
  });
  const call = (path: string, token: string, method: string, body?: object) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  // An uploaded photo on JOB, a pending one, and an uploaded one on OTHER_JOB.
  const photo = async (job: string, uploaded: boolean) => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId: job,
      jobStepId: null,
      kind: "photo",
      surface: "phone",
      storageKey: `${A}/${job}/${crypto.randomUUID()}.jpg`,
      mimeType: "image/jpeg",
      byteSize: 10,
      capturedAt: "2026-10-26T10:00:00.000Z",
    });
    storage.objects.set(ev.storageKey, { size: 10, contentType: "image/jpeg" });
    return uploaded ? evidence.markUploaded(ev.id, 10) : ev;
  };
  return {
    call,
    assets,
    reader,
    uploaded: await photo(JOB, true),
    pending: await photo(JOB, false),
    otherJobPhoto: await photo(OTHER_JOB, true),
  };
}

const reading = {
  unreadable: false,
  make: "FlowSet",
  model: "CR 3-10",
  ratings: [],
  confidence: 0.6,
};

describe("POST /jobs/:id/asset/identify", () => {
  it("reads an uploaded photo on the job and returns the reading", async () => {
    const s = await setup([{ status: "read", reading }]);
    const res = await s.call(`/jobs/${JOB}/asset/identify`, "a", "POST", {
      evidenceId: s.uploaded.id,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "read", reading });
    expect(s.reader.calls[0]?.mimeType).toBe("image/jpeg");
  });

  it("passes 'unavailable' through as a normal answer", async () => {
    const s = await setup([
      { status: "unavailable", reason: "model_unavailable", message: "Type it." },
    ]);
    const res = await s.call(`/jobs/${JOB}/asset/identify`, "a", "POST", {
      evidenceId: s.uploaded.id,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "unavailable" });
  });

  it("refuses pending photos, photos from another job, and other users", async () => {
    const s = await setup();
    expect(
      (await s.call(`/jobs/${JOB}/asset/identify`, "a", "POST", { evidenceId: s.pending.id }))
        .status,
    ).toBe(404);
    expect(
      (await s.call(`/jobs/${JOB}/asset/identify`, "a", "POST", { evidenceId: s.otherJobPhoto.id }))
        .status,
    ).toBe(404);
    expect(
      (await s.call(`/jobs/${JOB}/asset/identify`, "b", "POST", { evidenceId: s.uploaded.id }))
        .status,
    ).toBe(404);
    expect(s.reader.calls).toHaveLength(0);
  });
});

describe("PUT /jobs/:id/asset", () => {
  it("saves the confirmed values with their source", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${JOB}/asset`, "a", "PUT", {
      make: "FlowSet",
      model: "CR 3-10 A-A-A-E",
      serial: "4521-0098",
      nameplateEvidenceId: s.uploaded.id,
      source: "model_edited",
      confidence: 0.6,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      asset: { make: "FlowSet", model: "CR 3-10 A-A-A-E", category: "equipment" },
    });
    expect(s.assets.saves[0]).toMatchObject({
      jobId: JOB,
      ownerId: A,
      source: "model_edited",
      confidence: 0.6,
    });
  });

  it("saves typed details without a photo", async () => {
    const s = await setup();
    const res = await s.call(`/jobs/${JOB}/asset`, "a", "PUT", {
      make: "FlowSet",
      model: "CR 3-10",
      source: "manual",
    });
    expect(res.status).toBe(201);
  });

  it("validates input and ownership", async () => {
    const s = await setup();
    expect(
      (await s.call(`/jobs/${JOB}/asset`, "a", "PUT", { make: "", model: "x", source: "manual" }))
        .status,
    ).toBe(400);
    expect(
      (await s.call(`/jobs/${JOB}/asset`, "a", "PUT", { make: "x", model: "y", source: "guess" }))
        .status,
    ).toBe(400);
    expect(
      (
        await s.call(`/jobs/${JOB}/asset`, "a", "PUT", {
          make: "x",
          model: "y",
          source: "manual",
          nameplateEvidenceId: s.otherJobPhoto.id,
        })
      ).status,
    ).toBe(404);
    expect(
      (await s.call(`/jobs/${JOB}/asset`, "b", "PUT", { make: "x", model: "y", source: "manual" }))
        .status,
    ).toBe(404);
    expect(s.assets.saves).toHaveLength(0);
  });
});
