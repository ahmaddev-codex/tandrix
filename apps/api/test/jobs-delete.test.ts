import { DeleteJobResponse, Job } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { JobsRepo } from "../src/repos/jobs";
import { memoryAssets, memoryEvidence, memoryStorage, noManuals, scriptedReader } from "./fakes";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB = "00000000-0000-4000-8000-0000000000c0";

const job = Job.parse({
  id: JOB,
  ownerId: A,
  assetId: null,
  procedureId: null,
  title: "Fix the lamp",
  status: "active",
  currentStepId: null,
  activeSurface: "phone",
  controlMode: "show",
  language: "en",
  createdAt: "2026-10-29T10:00:00.000Z",
  updatedAt: "2026-10-29T10:00:00.000Z",
});

function setup() {
  const evidence = memoryEvidence(new Map([[JOB, A]]));
  const storage = memoryStorage();
  let removed = false;
  const jobs = {
    async getForOwner(ownerId: string, id: string) {
      return !removed && ownerId === A && id === JOB ? { job, steps: [] } : null;
    },
    async remove(ownerId: string, id: string) {
      if (removed || ownerId !== A || id !== JOB) return false;
      removed = true;
      return true;
    },
  } as unknown as JobsRepo;
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    now: () => Date.UTC(2026, 9, 29, 10),
    corsOrigins: [],
    log: () => {},
  });
  const call = (token = "a") =>
    app.request(`/jobs/${JOB}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
  return { call, evidence, storage, wasRemoved: () => removed };
}

describe("DELETE /jobs/:id", () => {
  it("removes the job's evidence objects, then the job", async () => {
    const { call, evidence, storage, wasRemoved } = setup();
    const keys = ["a/1.png", "a/2.png"];
    for (const [i, key] of keys.entries()) {
      const ev = await evidence.createPending({
        id: `00000000-0000-4000-8000-0000000000d${i}`,
        jobId: JOB,
        jobStepId: null,
        kind: "photo",
        surface: "phone",
        storageKey: key,
        mimeType: "image/png",
        byteSize: 3,
        capturedAt: "2026-10-29T10:00:00.000Z",
      });
      await evidence.markUploaded(ev.id, 3);
      await storage.put(key, new Uint8Array([1, 2, 3]), "image/png");
    }
    const res = await call();
    expect(res.status).toBe(200);
    expect(DeleteJobResponse.parse(await res.json())).toEqual({ deleted: true });
    expect(storage.removed.sort()).toEqual(keys);
    expect(wasRemoved()).toBe(true);
  });

  it("404s for another user's job and removes nothing", async () => {
    const { call, storage, wasRemoved } = setup();
    expect((await call("b")).status).toBe(404);
    expect(storage.removed).toHaveLength(0);
    expect(wasRemoved()).toBe(false);
  });
});
