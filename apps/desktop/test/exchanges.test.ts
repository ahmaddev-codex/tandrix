import { describe, expect, it } from "vitest";
import { recentExchanges } from "../src/renderer/lib/exchanges";

const you = (text: string) => ({ speaker: "you" as const, text });
const tandrix = (text: string) => ({ speaker: "tandrix" as const, text });

describe("recentExchanges", () => {
  it("pairs each question with its answer, oldest first", () => {
    expect(recentExchanges([you("a?"), tandrix("A."), you("b?"), tandrix("B.")])).toEqual([
      { question: "a?", reply: "A." },
      { question: "b?", reply: "B." },
    ]);
  });

  it("skips replies with no question (didn't catch that) and keeps the last few", () => {
    const turns = [
      tandrix("Didn't catch that."),
      ...[1, 2, 3, 4, 5].flatMap((n) => [you(`q${n}`), tandrix(`a${n}`)]),
    ];
    expect(recentExchanges(turns).map((e) => e.question)).toEqual(["q2", "q3", "q4", "q5"]);
  });
});
