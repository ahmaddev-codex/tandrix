import type { Job, JobStep, ProcedureDraft } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { RecordingInput } from "../src/procedure-generator";
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
const JOB = "00000000-0000-4000-8000-000000000001";

const step = (order: number, title: string, timestampSec: number) => ({
  order,
  surface: "physical" as const,
  title,
  instruction: `${title}.`,
  partRefs: [],
  hazardTags: [],
  verification: "photo" as const,
  expectedState: "Done.",
  citation: { kind: "expert_recording" as const, timestampSec },
});
const DRAFT: ProcedureDraft = {
  title: "Fit the cooler",
  parts: [],
  steps: [step(1, "Peel the pad backing", 4), step(2, "Press the pins home", 31)],
};

async function setup() {
  const evidence = memoryEvidence(new Map([[JOB, A]]));
  const storage = memoryStorage();
  const procedures = memoryProcedures();
  const stepState = memoryStepState(() => JOB);
  const job = {
    id: JOB,
    ownerId: A,
    assetId: null,
    procedureId: null,
    title: "Fit the cooler",
  } as Job;
  // The job's steps are the saved procedure's, as save_procedure makes them.
  const jobs = {
    async getForOwner(o: string, id: string) {
      if (o !== A || id !== JOB) return null;
      const saved = procedures.saves.at(-1);
      const steps = (saved?.stepIds ?? []).map(
        (psId, i) =>
          ({ id: `00000000-0000-4000-8000-0000000e000${i}`, procedureStepId: psId }) as JobStep,
      );
      return { job, steps };
    },
  } as unknown as JobsRepo;
  const heard: RecordingInput[] = [];
  const app = createApp({
    verifyToken: async (t) => (t === "a" ? { id: A } : null),
    jobs,
    evidence,
    storage,
    assets: memoryAssets(),
    nameplateReader: scriptedReader(),
    ...noManuals(),
    procedures,
    stepState,
    procedureGenerator: {
      async generate() {
        return { status: "unavailable", message: "no" };
      },
      async fromRecording(input) {
        heard.push(input);
        return { status: "drafted", draft: DRAFT };
      },
    },
    corsOrigins: [],
    log: () => {},
  });
  const photo = async (kind: "photo" | "screenshot" = "photo") => {
    const ev = await evidence.createPending({
      id: crypto.randomUUID(),
      jobId: JOB,
      jobStepId: null,
      kind,
      surface: "phone",
      storageKey: `${A}/${JOB}/${crypto.randomUUID()}.png`,
      mimeType: "image/png",
      byteSize: PNG.length,
      width: 10,
      height: 10,
      capturedAt: "2026-10-31T10:00:00.000Z",
    });
    await storage.put(ev.storageKey, PNG, "image/png");
    return evidence.markUploaded(ev.id, PNG.length);
  };
  const record = (moments: object[]) =>
    app.request(`/jobs/${JOB}/procedure/recorded`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer a" },
      body: JSON.stringify({ moments }),
    });
  return { photo, record, heard, procedures, stepState };
}

describe("POST /jobs/:id/procedure/recorded", () => {
  it("writes the steps from the moments, cited to their times, with each moment's photo as reference", async () => {
    const s = await setup();
    const one = await s.photo();
    const two = await s.photo();
    const res = await s.record([
      { evidenceId: two.id, said: "Then press the pins until they click.", atSec: 31 },
      { evidenceId: one.id, said: "Peel the backing off the pads first.", atSec: 4 },
    ]);
    expect(res.status).toBe(201);
    // In time order, whatever order they were sent.
    expect(s.heard[0]!.moments.map((m) => m.atSec)).toEqual([4, 31]);
    const saved = s.procedures.saves[0]!;
    expect(saved.fromRecording).toBe(true);
    expect(saved.draft.steps.map((x) => x.citation)).toEqual([
      { kind: "expert_recording", timestampSec: 4 },
      { kind: "expert_recording", timestampSec: 31 },
    ]);
    expect(saved.stepMoments).toEqual([one.id, two.id]);
    expect([...s.stepState.references.values()]).toEqual([one.id, two.id]);
  });

  it("only takes photos from this job", async () => {
    const s = await setup();
    const shot = await s.photo("screenshot");
    const one = await s.photo();
    const res = await s.record([
      { evidenceId: one.id, said: "First.", atSec: 1 },
      { evidenceId: shot.id, said: "Second.", atSec: 2 },
    ]);
    expect(res.status).toBe(404);
  });

  it("needs at least two moments", async () => {
    const s = await setup();
    const one = await s.photo();
    const res = await s.record([{ evidenceId: one.id, said: "Just this.", atSec: 1 }]);
    expect(res.status).toBe(400);
  });
});
