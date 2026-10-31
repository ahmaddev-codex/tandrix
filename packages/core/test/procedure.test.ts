import type { ProcedureDraft } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import { normalizeDraft } from "../src";

type Step = ProcedureDraft["steps"][number];

const step = (over: Partial<Step> = {}): Step => ({
  order: 1,
  surface: "physical",
  title: "Fit the seal",
  instruction: "Press the seal into the housing.",
  partRefs: [],
  hazardTags: [],
  verification: "photo",
  expectedState: "Seal seated flush.",
  citation: { kind: "manual", page: 4 },
  ...over,
});

const draft = (steps: Step[], parts: ProcedureDraft["parts"] = []): ProcedureDraft => ({
  title: "Assemble the pump",
  parts,
  steps,
});

describe("normalizeDraft", () => {
  it("keeps valid manual citations and counts them", () => {
    const r = normalizeDraft(draft([step()]), { manualPages: 10 });
    expect(r.draft.steps[0]!.citation).toEqual({ kind: "manual", page: 4 });
    expect(r.citedSteps).toBe(1);
    expect(r.fixes).toEqual([]);
  });

  it("labels a citation to a page the manual doesn't have as generic", () => {
    const r = normalizeDraft(draft([step({ citation: { kind: "manual", page: 40 } })]), {
      manualPages: 12,
    });
    expect(r.draft.steps[0]!.citation).toEqual({ kind: "generic" });
    expect(r.citedSteps).toBe(0);
    expect(r.fixes).toContainEqual({ kind: "citation_out_of_range", order: 1, page: 40 });
  });

  it("makes every step generic when there is no manual", () => {
    const r = normalizeDraft(draft([step(), step({ order: 2 })]), { manualPages: null });
    expect(r.draft.steps.every((s) => s.citation.kind === "generic")).toBe(true);
    expect(r.citedSteps).toBe(0);
  });

  it("renumbers steps in the model's order", () => {
    const r = normalizeDraft(
      draft([
        step({ order: 5, title: "B" }),
        step({ order: 2, title: "A" }),
        step({ order: 9, title: "C" }),
      ]),
      { manualPages: 10 },
    );
    expect(r.draft.steps.map((s) => [s.order, s.title])).toEqual([
      [1, "A"],
      [2, "B"],
      [3, "C"],
    ]);
  });

  it("drops part refs that aren't in the parts list, and duplicate parts", () => {
    const parts = [
      { ref: "P1", name: "Impeller", qty: 1 },
      { ref: "P1", name: "Duplicate", qty: 1 },
    ];
    const r = normalizeDraft(draft([step({ partRefs: ["P1", "P7", "P1"] })], parts), {
      manualPages: 10,
    });
    expect(r.draft.parts).toEqual([parts[0]]);
    expect(r.draft.steps[0]!.partRefs).toEqual(["P1"]);
    expect(r.fixes).toContainEqual({ kind: "unknown_part_ref", order: 1, ref: "P7" });
  });

  it("asks the user to confirm a measurement step that has no value", () => {
    const r = normalizeDraft(draft([step({ verification: "measurement" })]), { manualPages: 10 });
    expect(r.draft.steps[0]!.verification).toBe("user_confirm");
    expect(r.draft.steps[0]).not.toHaveProperty("measurement");
  });

  it("keeps a measurement only on measurement steps", () => {
    const m = { quantity: "torque", unit: "Nm", target: 25 };
    const r = normalizeDraft(
      draft([
        step({ verification: "measurement", measurement: m }),
        step({ order: 2, verification: "photo", measurement: m }),
      ]),
      { manualPages: 10 },
    );
    expect(r.draft.steps[0]!.measurement).toEqual(m);
    expect(r.draft.steps[1]).not.toHaveProperty("measurement");
  });

  it("adds hazard tags the rules find, including live electrical work", () => {
    const r = normalizeDraft(
      draft([
        step({ title: "Wire the motor", instruction: "Connect the motor leads to the supply." }),
      ]),
      { manualPages: 10 },
    );
    expect(r.draft.steps[0]!.hazardTags).toContain("live_electrical");
    expect(r.fixes.some((f) => f.kind === "hazards_added")).toBe(true);
  });
});

describe("normalizeDraft from a recording", () => {
  const rec = (t: number) => step({ citation: { kind: "expert_recording", timestampSec: t } });
  it("keeps moments inside the recording and counts them as cited", () => {
    const r = normalizeDraft(draft([rec(12)]), { manualPages: null, recordingSec: 90 });
    expect(r.draft.steps[0]!.citation).toEqual({ kind: "expert_recording", timestampSec: 12 });
    expect(r.citedSteps).toBe(1);
  });
  it("makes a moment past the end generic", () => {
    const r = normalizeDraft(draft([rec(200)]), { manualPages: null, recordingSec: 90 });
    expect(r.draft.steps[0]!.citation).toEqual({ kind: "generic" });
    expect(r.fixes).toContainEqual({
      kind: "citation_outside_recording",
      order: 1,
      timestampSec: 200,
    });
  });
  it("never lets a draft without a recording cite one", () => {
    const r = normalizeDraft(draft([rec(5)]), { manualPages: 10 });
    expect(r.draft.steps[0]!.citation).toEqual({ kind: "generic" });
  });
});
