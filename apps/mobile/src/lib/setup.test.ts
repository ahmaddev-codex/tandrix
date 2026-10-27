import type { GenerateProcedureResponse, Manual } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import {
  newSetupState,
  runSetup,
  SetupStopped,
  type Intake,
  type IntakePhoto,
  type SetupDeps,
  type SetupState,
} from "./setup";

const photo = (name: string): IntakePhoto => ({
  uri: `file:///${name}.jpg`,
  width: 1000,
  height: 750,
  byteSize: 1000,
  capturedAt: "2026-10-27T09:00:00.000Z",
});

const manual = (title: string, pageCount: number) => ({ title, pageCount }) as Manual;

const created = (steps: number, citedSteps: number) =>
  ({
    status: "created",
    detail: { steps: Array.from({ length: steps }) },
    citedSteps,
  }) as unknown as GenerateProcedureResponse;

function fakeDeps(over: Partial<SetupDeps> = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  let n = 0;
  const deps: SetupDeps = {
    async createJob(goal) {
      calls.push(["createJob", goal]);
      return { id: "job-1" };
    },
    async uploadPhoto(_job, p) {
      calls.push(["uploadPhoto", p.uri]);
      return { id: `ev-${++n}` };
    },
    async identify() {
      calls.push(["identify"]);
      return {
        status: "read",
        reading: { make: "Raspberry Pi", model: "5", confidence: 0.95 },
      } as never;
    },
    async saveAsset(_job, a) {
      calls.push(["saveAsset", a]);
    },
    async uploadManual(_job, pdf) {
      calls.push(["uploadManual", pdf.name]);
      return manual("Build kit", 22);
    },
    async manualFromPhotos(_job, body) {
      calls.push(["manualFromPhotos", body]);
      return manual("Pages", body.evidenceIds.length);
    },
    async searchManual() {
      calls.push(["searchManual"]);
      return { status: "unavailable", message: "Search is down." };
    },
    async fetchManual(_job, b) {
      calls.push(["fetchManual", b.url]);
      return manual(b.title, 8);
    },
    async generate(_job, body) {
      calls.push(["generate", body]);
      return created(12, 10);
    },
    async partsCheck() {
      calls.push(["partsCheck"]);
      return {
        status: "checked",
        partsCheck: {
          results: [{ status: "found" }, { status: "missing" }],
        },
      } as never;
    },
    ...over,
  };
  return { deps, calls };
}

const base: Intake = { goal: "Build a Raspberry Pi 5 home server", now: [], manualPages: [] };

async function run(intake: Intake, deps: SetupDeps, state = newSetupState(intake)) {
  const seen: SetupState[] = [];
  const jobId = await runSetup(intake, state, deps, (s) => seen.push(s));
  return { jobId, state, seen };
}

describe("runSetup", () => {
  it("with only a goal, starts the project and writes general steps", async () => {
    const { deps, calls } = fakeDeps();
    const { jobId, state } = await run(base, deps);
    expect(jobId).toBe("job-1");
    expect(state.stages.map((s) => s.id)).toEqual(["start", "steps"]);
    expect(calls.map((c) => c[0])).toEqual(["createJob", "generate"]);
    expect(calls[1]![1]).toEqual({ allowGeneric: true, contextEvidenceIds: [] });
  });

  it("uses everything given: label, manual PDF, photos of now, notes and the parts", async () => {
    const { deps, calls } = fakeDeps();
    const intake: Intake = {
      ...base,
      label: photo("box"),
      parts: photo("parts"),
      now: [photo("bench"), photo("board")],
      manualPdf: { uri: "file:///kit.pdf", name: "pi5_build_kit.pdf", byteSize: 5000 },
      notes: "  The case is already open.  ",
    };
    const { state } = await run(intake, deps);
    expect(calls.filter((c) => c[0] === "uploadPhoto")).toHaveLength(4);
    expect(calls.find((c) => c[0] === "saveAsset")![1]).toMatchObject({
      make: "Raspberry Pi",
      model: "5",
      source: "model",
    });
    expect(calls.some((c) => c[0] === "searchManual")).toBe(false);
    const gen = calls.find((c) => c[0] === "generate")![1] as { contextEvidenceIds: string[] };
    expect(gen).toEqual({
      allowGeneric: true,
      contextEvidenceIds: [
        state.uploaded["file:///bench.jpg"],
        state.uploaded["file:///board.jpg"],
      ],
      notes: "The case is already open.",
    });
    expect(state.stages).toEqual([
      { id: "start", title: "Start the project", status: "done" },
      { id: "photos", title: "Upload your photos", status: "done", note: "4 photos" },
      { id: "label", title: "Read the label", status: "done", note: "Raspberry Pi 5" },
      { id: "manual", title: "Get the manual", status: "done", note: "Build kit, 22 pages" },
      {
        id: "steps",
        title: "Write the steps",
        status: "done",
        note: "12 steps, 10 from the manual",
      },
      {
        id: "parts",
        title: "Check the parts",
        status: "attention",
        note: "1 part not found. Check the list on the project.",
      },
    ]);
  });

  it("leaves an unsure label to the user and searches for the manual, past a link that fails", async () => {
    const { deps, calls } = fakeDeps({
      async identify() {
        return {
          status: "read",
          reading: { make: "Raspberry Pi", model: "5", confidence: 0.5 },
        } as never;
      },
      async searchManual() {
        return {
          status: "found",
          candidates: [
            { url: "https://a.example/page", title: "Product page", token: "t1" },
            { url: "https://a.example/brief.pdf", title: "Product brief", token: "t2" },
          ],
        } as never;
      },
      async fetchManual(_job, b) {
        if (b.url.endsWith("page")) throw new Error("That file isn't a readable PDF.");
        return manual(b.title, 8);
      },
    });
    const { state } = await run({ ...base, label: photo("box") }, deps);
    expect(calls.some((c) => c[0] === "saveAsset")).toBe(false);
    expect(state.stages.find((s) => s.id === "label")).toMatchObject({ status: "attention" });
    expect(state.stages.find((s) => s.id === "manual")).toMatchObject({
      status: "done",
      note: "Product brief, 8 pages",
    });
  });

  it("builds the manual from photographed pages, in order", async () => {
    const { deps, calls } = fakeDeps();
    await run({ ...base, manualPages: [photo("p1"), photo("p2")] }, deps);
    const body = calls.find((c) => c[0] === "manualFromPhotos")![1] as { evidenceIds: string[] };
    expect(body.evidenceIds).toEqual(["ev-1", "ev-2"]);
  });

  it("stops when the steps can't be written, and carries on from there when tried again", async () => {
    let fail = true;
    const { deps, calls } = fakeDeps({
      async generate() {
        if (fail) return { status: "unavailable", message: "Try again in a minute." };
        return created(5, 0);
      },
    });
    const intake: Intake = { ...base, now: [photo("bench")] };
    const state = newSetupState(intake);
    await expect(run(intake, deps, state)).rejects.toBeInstanceOf(SetupStopped);
    expect(state.stages.find((s) => s.id === "steps")).toMatchObject({
      status: "failed",
      note: "Try again in a minute.",
    });

    fail = false;
    await run(intake, deps, state);
    // The project and the photo aren't made twice.
    expect(calls.filter((c) => c[0] === "createJob")).toHaveLength(1);
    expect(calls.filter((c) => c[0] === "uploadPhoto")).toHaveLength(1);
    expect(state.stages.find((s) => s.id === "steps")).toMatchObject({
      status: "done",
      note: "5 steps",
    });
  });

  it("stops at the start when the project can't be created", async () => {
    const { deps } = fakeDeps({
      async createJob() {
        throw new Error("Can't reach Tandrix.");
      },
    });
    await expect(run(base, deps)).rejects.toMatchObject({ stage: "start" });
  });
});
