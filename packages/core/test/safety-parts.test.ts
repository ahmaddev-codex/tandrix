import { describe, expect, it } from "vitest";
import {
  applyPartsCheck,
  detectHazards,
  gateCopy,
  hazardTagsForStep,
  mergeHazardTags,
  missingGates,
  refusalFor,
  refusalForRequest,
  requiredGates,
  summarizeSteps,
} from "../src";

describe("hazard detection", () => {
  it("adds tags the model missed", () => {
    const tags = hazardTagsForStep({
      hazardTags: [],
      title: "Open the casing",
      instruction: "Close the discharge valve, then remove the casing bolts.",
    });
    expect(tags).toContain("pressure");
  });

  it("never drops tags the model proposed", () => {
    expect(mergeHazardTags(["heavy_lift"], [])).toEqual(["heavy_lift"]);
  });

  it("flags live electrical work", () => {
    expect(detectHazards("Connect the motor leads to the supply")).toContain("live_electrical");
    expect(detectHazards("Check the voltage while it is energised")).toContain("live_electrical");
  });

  it("leaves ordinary mechanical steps untagged", () => {
    expect(detectHazards("Fit the O-ring into the housing groove.")).toEqual([]);
  });
});

describe("gates", () => {
  it("maps hazards to gates without duplicates", () => {
    expect(requiredGates(["electrical_isolation", "pressure", "electrical_isolation"])).toEqual([
      "isolate_power",
      "release_pressure",
    ]);
  });

  it("reports only the gates not yet confirmed", () => {
    expect(missingGates(["electrical_isolation", "pressure"], ["release_pressure"])).toEqual([
      "isolate_power",
    ]);
  });

  it("has no gate for live electrical work; it is refused instead", () => {
    expect(requiredGates(["live_electrical"])).toEqual([]);
    expect(refusalFor(["live_electrical"])?.reason).toMatch(/qualified electrician/);
    expect(refusalFor(["pressure"])).toBeNull();
  });

  it("has copy for every gate", () => {
    for (const g of Object.values(gateCopy)) {
      expect(g.action).toMatch(/^Confirm /);
    }
  });
});

describe("parts check", () => {
  const steps = [
    { stepId: "s3", status: "todo" as const, partSpecIds: ["oring"] },
    { stepId: "s4", status: "todo" as const, partSpecIds: ["impeller"] },
    { stepId: "s5", status: "verified" as const, partSpecIds: ["oring"] },
    {
      stepId: "s6",
      status: "blocked" as const,
      partSpecIds: ["bolt"],
      blockedBy: "parts" as const,
    },
    { stepId: "s7", status: "blocked" as const, partSpecIds: [], blockedBy: "other" as const },
  ];

  it("blocks open steps that need a missing part and unblocks parts blocks that are resolved", () => {
    const d = applyPartsCheck(steps, [
      { partSpecId: "oring", status: "missing" },
      { partSpecId: "impeller", status: "found" },
      { partSpecId: "bolt", status: "possible" },
    ]);
    expect(d.block).toEqual([{ stepId: "s3", missingPartSpecIds: ["oring"] }]);
    expect(d.unblock).toEqual(["s6"]);
  });
});

describe("summarizeSteps", () => {
  it("counts everything unfinished as unresolved", () => {
    expect(
      summarizeSteps([
        "verified",
        "verified",
        "user_confirmed",
        "needs_attention",
        "blocked",
        "todo",
        "skipped",
      ]),
    ).toEqual({ verified: 2, confirmed: 1, attention: 1, unresolved: 2, skipped: 1 });
  });
});

describe("refusalForRequest", () => {
  it("refuses requests for wiring or live work, whatever the wording", () => {
    for (const q of [
      "How do I connect the motor leads to the supply?",
      "Walk me through rewire the starter",
      "Can I check the terminals while it is energised?",
    ]) {
      expect(refusalForRequest(q)?.reason).toMatch(/qualified electrician/);
    }
  });

  it("answers ordinary questions", () => {
    expect(refusalForRequest("Which way do the impeller vanes face?")).toBeNull();
    expect(refusalForRequest("Isolate the power first, then what?")).toBeNull();
  });
});
