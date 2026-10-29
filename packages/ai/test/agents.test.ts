import { describe, expect, it } from "vitest";
import { needsOnlineLookup } from "../src/agents";

describe("needsOnlineLookup", () => {
  it("spots requests to look things up online", () => {
    expect(needsOnlineLookup("Find setup instructions online for my espresso machine")).toBe(true);
    expect(needsOnlineLookup("Search online for how to fix this error and apply it")).toBe(true);
    expect(needsOnlineLookup("Click the Save button")).toBe(false);
  });
});
