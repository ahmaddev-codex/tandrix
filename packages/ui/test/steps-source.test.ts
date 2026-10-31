import { describe, expect, it } from "vitest";
import { stepSource } from "../src/steps";

const ID = "00000000-0000-4000-8000-000000000001";

describe("stepSource", () => {
  it("is the manual page", () => {
    expect(
      stepSource({ surface: "physical", citation: { kind: "manual", manualId: ID, page: 4 } }),
    ).toEqual({ source: "Manual p.4", sourceKind: "manual" });
  });
  it("is the moment in a recording", () => {
    expect(
      stepSource({
        surface: "physical",
        citation: { kind: "expert_recording", recordingEvidenceId: ID, timestampSec: 48 },
      }),
    ).toEqual({ source: "Recorded at 0:48", sourceKind: "expert" });
  });
  it("says a software step without a source is checked on screen", () => {
    expect(stepSource({ surface: "desktop", citation: { kind: "generic" } })).toEqual({
      source: "General steps, checked on screen",
      sourceKind: "screen",
    });
  });
  it("leaves a physical step without a source to the Generic label", () => {
    expect(stepSource({ surface: "physical", citation: { kind: "generic" } })).toBeNull();
  });
});
