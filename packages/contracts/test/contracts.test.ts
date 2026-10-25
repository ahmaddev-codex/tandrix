import { describe, expect, it } from "vitest";
import {
  CreateEvidenceRequest,
  DesktopAction,
  Event,
  HighlightPick,
  JobStep,
  PointerTarget,
  ProcedureDraft,
  ProcedureStep,
  StepActionRequest,
} from "../src";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = "2026-10-26T10:00:00Z";

const draftStep = {
  order: 4,
  surface: "physical",
  title: "Fit the impeller onto the shaft",
  instruction: "Slide the impeller onto the shaft with the vanes facing the inlet.",
  partRefs: ["P3"],
  hazardTags: [],
  verification: "photo",
  expectedState: "Impeller seated against the shaft shoulder, vanes toward the inlet.",
  citation: { kind: "manual", page: 14, figure: "3" },
};

describe("ProcedureDraft (model output)", () => {
  it("accepts a cited draft and fills defaults", () => {
    const r = ProcedureDraft.parse({
      title: "Pump P-100 assembly",
      parts: [{ ref: "P3", name: "Impeller", qty: 1 }],
      steps: [{ ...draftStep, partRefs: undefined, hazardTags: undefined }],
    });
    expect(r.steps[0]!.partRefs).toEqual([]);
    expect(r.steps[0]!.hazardTags).toEqual([]);
  });

  it("rejects database IDs, unknown keys and unknown hazard tags", () => {
    const base = { title: "x", parts: [], steps: [draftStep] };
    expect(
      ProcedureDraft.safeParse({ ...base, steps: [{ ...draftStep, id: id(1) }] }).success,
    ).toBe(false);
    expect(
      ProcedureDraft.safeParse({ ...base, steps: [{ ...draftStep, partRefs: [id(1)] }] }).success,
    ).toBe(false);
    expect(
      ProcedureDraft.safeParse({ ...base, steps: [{ ...draftStep, hazardTags: ["mild"] }] })
        .success,
    ).toBe(false);
  });

  it("caps oversized text", () => {
    const long = { ...draftStep, instruction: "a".repeat(601) };
    expect(ProcedureDraft.safeParse({ title: "x", parts: [], steps: [long] }).success).toBe(false);
  });
});

describe("ProcedureStep", () => {
  it("requires a citation", () => {
    const step = {
      id: id(1),
      procedureId: id(2),
      order: 1,
      surface: "physical",
      title: "Isolate the pump",
      instruction: "Switch off and lock the isolator.",
      partSpecIds: [],
      hazardTags: ["electrical_isolation"],
      verification: "user_confirm",
      expectedState: "Isolator locked off.",
    };
    expect(ProcedureStep.safeParse(step).success).toBe(false);
    expect(ProcedureStep.safeParse({ ...step, citation: { kind: "generic" } }).success).toBe(true);
  });
});

describe("JobStep", () => {
  it("only allows known statuses", () => {
    const s = {
      id: id(1),
      jobId: id(2),
      procedureStepId: id(3),
      status: "verified",
      statusEvidenceId: id(4),
      startedAt: now,
      updatedAt: now,
      updatedBySurface: "phone",
    };
    expect(JobStep.safeParse(s).success).toBe(true);
    expect(JobStep.safeParse({ ...s, status: "done" }).success).toBe(false);
  });
});

describe("PointerTarget", () => {
  it("discriminates geometry kinds", () => {
    const base = { surface: "screen", evidenceId: id(1), label: "Save", confidence: 0.9 };
    expect(
      PointerTarget.safeParse({ ...base, geometry: { kind: "point", point: { x: 10, y: 20 } } })
        .success,
    ).toBe(true);
    expect(
      PointerTarget.safeParse({
        ...base,
        geometry: { kind: "point", box: { x: 1, y: 1, w: 1, h: 1 } },
      }).success,
    ).toBe(false);
  });
});

describe("MaskOutline geometry", () => {
  it("carries the path and its raster size", () => {
    const base = { surface: "camera", evidenceId: id(1), label: "Impeller", confidence: 0.9 };
    const box = { x: 10, y: 10, w: 60, h: 27 };
    expect(
      PointerTarget.safeParse({
        ...base,
        geometry: {
          kind: "mask",
          box,
          mask: { path: "M0 0L60 0L60 27Z", raster: { width: 60, height: 27 } },
        },
      }).success,
    ).toBe(true);
    expect(
      PointerTarget.safeParse({ ...base, geometry: { kind: "mask", box, maskKey: "x" } }).success,
    ).toBe(false);
  });
});

describe("HighlightPick", () => {
  it("allows a part with no matching box", () => {
    expect(
      HighlightPick.safeParse({ picks: [{ partRef: "P3", boxIndex: null, confidence: 0.2 }] })
        .success,
    ).toBe(true);
  });
});

describe("DesktopAction", () => {
  it("parses computer-use actions and defaults click to left", () => {
    const a = DesktopAction.parse({ type: "click", x: 100, y: 200 });
    expect(a).toEqual({ type: "click", x: 100, y: 200, button: "left" });
  });
  it("rejects unknown action types and negative coordinates", () => {
    expect(DesktopAction.safeParse({ type: "shell", cmd: "rm -rf /" }).success).toBe(false);
    expect(DesktopAction.safeParse({ type: "move", x: -1, y: 0 }).success).toBe(false);
  });
});

describe("CreateEvidenceRequest", () => {
  it("enforces type and size limits per kind", () => {
    const ok = { kind: "photo", mimeType: "image/jpeg", byteSize: 2_000_000, surface: "phone" };
    expect(CreateEvidenceRequest.safeParse(ok).success).toBe(true);
    expect(CreateEvidenceRequest.safeParse({ ...ok, mimeType: "application/x-sh" }).success).toBe(
      false,
    );
    expect(CreateEvidenceRequest.safeParse({ ...ok, byteSize: 50 * 1024 * 1024 }).success).toBe(
      false,
    );
  });
});

describe("StepActionRequest", () => {
  it("requires a reason to skip", () => {
    expect(StepActionRequest.safeParse({ action: "skip" }).success).toBe(false);
    expect(
      StepActionRequest.safeParse({ action: "skip", reason: "Already fitted at the factory" })
        .success,
    ).toBe(true);
  });
  it("has no way for a client to set verified", () => {
    expect(StepActionRequest.safeParse({ action: "verify" }).success).toBe(false);
  });
});

describe("Event", () => {
  it("accepts JSON payloads only", () => {
    const e = { id: id(1), jobId: id(2), type: "handoff", surface: "phone", createdAt: now };
    expect(Event.safeParse({ ...e, payload: { to: "desktop", step: 9 } }).success).toBe(true);
    expect(Event.safeParse({ ...e, payload: { fn: () => 1 } }).success).toBe(false);
  });
});
