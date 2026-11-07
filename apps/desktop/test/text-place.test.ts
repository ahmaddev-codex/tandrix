import { describe, expect, it } from "vitest";
import { placeQuote, type ReadLine } from "../src/renderer/lib/text-place";

/** A line read off the screen, each character 10 px wide from x. */
const line = (text: string, x: number, y: number): ReadLine => ({
  text,
  box: [x, y, text.length * 10, 20],
  chars: [...text].map((_, i) => [x + i * 10, 10] as [number, number]),
});

const screen = [
  line("def fib(n, memo=None):", 100, 40),
  line("if n < 2:", 140, 70),
  line("return n", 180, 100),
  line("3(x − 2) + 4 = 2x + 9", 300, 300),
];

describe("placeQuote", () => {
  it("finds a line exactly, whatever the spacing", () => {
    expect(placeQuote(screen, "def fib(n,memo=None):")).toEqual({ x: 100, y: 40, w: 220, h: 20 });
  });

  it("finds part of a line, down to its characters", () => {
    // "memo=None" starts at the 12th character.
    expect(placeQuote(screen, "memo=None")).toEqual({ x: 210, y: 40, w: 90, h: 20 });
  });

  it("boxes every line of a block", () => {
    expect(placeQuote(screen, "if n < 2:\nreturn n")).toEqual({ x: 140, y: 70, w: 120, h: 50 });
  });

  it("reads a minus typed as a hyphen, and tolerates a misread", () => {
    expect(placeQuote(screen, "3(x - 2) + 4 = 2x + 9")?.y).toBe(300);
    expect(placeQuote([line("retum memo[n]", 0, 0)], "return memo[n]")).not.toBeNull();
  });

  it("finds nothing that isn't there", () => {
    expect(placeQuote(screen, "print(fib(40))")).toBeNull();
  });
});
