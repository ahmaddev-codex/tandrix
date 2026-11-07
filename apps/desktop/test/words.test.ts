import { describe, expect, it } from "vitest";
import { MAX_WORDS, parseWords } from "../src/renderer/lib/words";
import { ownWords } from "../src/main/hear";
import { vi } from "vitest";

vi.mock("electron", () => ({ app: { getAppPath: () => "", getName: () => "Tandrix" } }));

describe("your own words", () => {
  it("reads a comma list, trimmed, without repeats or empties", () => {
    expect(parseWords(" Niamh,  Pixelmator ,,niamh,\nKubernetes ")).toEqual([
      "Niamh",
      "Pixelmator",
      "Kubernetes",
    ]);
  });

  it("keeps at most forty short words", () => {
    const many = Array.from({ length: 60 }, (_, i) => `word${i}`).join(",");
    expect(parseWords(many)).toHaveLength(MAX_WORDS);
    expect(parseWords("x".repeat(90))[0]).toHaveLength(40);
  });

  it("checks what the panel sends before the recogniser sees it", () => {
    expect(ownWords(["Niamh", 5, "  ", "a   b", "y".repeat(80)])).toEqual([
      "Niamh",
      "a b",
      "y".repeat(40),
    ]);
    expect(ownWords("Niamh")).toEqual([]);
  });
});
