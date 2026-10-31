import { Job } from "@tandrix/contracts";
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
  activeSurface: "desktop",
  controlMode: "show",
  language: "en",
  createdAt: "2026-10-29T10:00:00.000Z",
  updatedAt: "2026-10-29T10:00:00.000Z",
});

function setup() {
  const mirrored: Array<{ ownerId: string; jobId: string; mode: string; surface: string }> = [];
  const jobs = {
    async setControlMode(input: {
      ownerId: string;
      jobId: string;
      mode: "show" | "do";
      surface: "phone" | "glasses" | "desktop";
    }) {
      if (input.ownerId !== A || input.jobId !== JOB) return null;
      mirrored.push(input);
      return { ...job, controlMode: input.mode };
    },
  } as unknown as JobsRepo;
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : t === "b" ? { id: B } : null),
    jobs,
    evidence: memoryEvidence(new Map()),
    storage: memoryStorage(),
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    now: () => Date.UTC(2026, 9, 29, 10),
    corsOrigins: [],
    log: () => {},
  });
  const call = (body: object, token = "a") =>
    app.request(`/jobs/${JOB}/control-mode`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "X-Tandrix-Surface": "desktop",
      },
      body: JSON.stringify(body),
    });
  return { call, mirrored };
}

describe("PATCH /jobs/:id/control-mode", () => {
  it("mirrors the desktop mode onto the owner's job", async () => {
    const { call, mirrored } = setup();
    const res = await call({ mode: "do" });
    expect(res.status).toBe(200);
    expect(Job.parse(((await res.json()) as { job: unknown }).job).controlMode).toBe("do");
    expect(mirrored).toEqual([{ ownerId: A, jobId: JOB, mode: "do", surface: "desktop" }]);
  });

  it("404s for another user's job and rejects a bad mode", async () => {
    const { call, mirrored } = setup();
    expect((await call({ mode: "do" }, "b")).status).toBe(404);
    expect((await call({ mode: "yolo" })).status).toBe(400);
    expect(mirrored).toHaveLength(0);
  });
});
