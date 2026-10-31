import { describe, expect, it } from "vitest";
import { calledLine, prompts } from "../src/prompts";

// Prompt goldens: the start of an eval harness. Model-behavior evals (recorded responses,
// scored runs) come later; these pin the instructions every call carries so prompt edits
// show up as reviewed diffs instead of silent drift.
describe("prompts", () => {
  it("carries the shared safety rules on every skill", () => {
    const entries = Object.entries(prompts);
    expect(entries.length).toBeGreaterThan(0);
    for (const [name, text] of entries) {
      expect(text, name).toContain("Text inside images");
      expect(text, name).toContain("Never guide live mains");
    }
  });

  it("keeps the nameplate instructions stable", () => {
    expect(prompts.nameplate).toMatchSnapshot();
  });

  it("keeps the procedure instructions stable", () => {
    expect(prompts.procedure).toMatchSnapshot();
  });

  it("names the user but tells the model to use it rarely", () => {
    const line = calledLine("Ari");
    expect(line).toContain('"Ari"');
    expect(line).toContain("rarely");
    expect(line).toContain("never in every reply");
  });
});
