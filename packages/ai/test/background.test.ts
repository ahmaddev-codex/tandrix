import { describe, expect, it } from "vitest";
import { parseBackground } from "../src/background";

describe("parseBackground", () => {
  it("splits what's said from what's read", () => {
    const r = parseBackground(
      "SPOKEN: The store closes at 9 tonight.\nDETAIL: Open 10 to 9 today.\nSundays 11 to 7.",
      ["https://example.com"],
    );
    expect(r.spoken).toBe("The store closes at 9 tonight.");
    expect(r.detail).toBe("Open 10 to 9 today.\nSundays 11 to 7.");
    expect(r.sources).toEqual(["https://example.com"]);
  });
  it("falls back to the first line when the shape is missing", () => {
    const r = parseBackground("It closes at 9.\nMore here.");
    expect(r.spoken).toBe("It closes at 9.");
    expect(r.detail).toBe("It closes at 9.\nMore here.");
  });
});
