import { describe, expect, it } from "vitest";
import { scrollPixels } from "../src/main/do-it";

describe("scrollPixels", () => {
  it("treats tiny values as wheel notches", () => {
    expect(scrollPixels(3, 0.5)).toBe(180);
    expect(scrollPixels(-5, 2)).toBe(-300);
  });
  it("scales real pixel distances from the screenshot to the display", () => {
    expect(scrollPixels(400, 0.5)).toBe(200);
    expect(scrollPixels(-600, 1)).toBe(-600);
  });
});
