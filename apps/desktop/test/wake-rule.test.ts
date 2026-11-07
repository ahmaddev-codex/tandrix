import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { getAppPath: () => "", getName: () => "Tandrix" } }));

import { cleanWakeName } from "../src/main/wake";
import { soundAlikeRule } from "../scripts/wake/match";

const bin = join(import.meta.dirname, "../dist/native/tandrix-wake");
const match = (text: string, name?: string) =>
  JSON.parse(execFileSync(bin, ["--match", text, ...(name ? [name] : [])]).toString()) as {
    woke: boolean;
    rest: string;
  };

const WAKES = [
  ["Hey Tandrix", ""],
  ["Wake up, Tandriggs.", ""],
  ["Hey, Chandrix, what's on my calendar today?", "what's on my calendar today"],
  ["Tandrix, open Calendar", "open Calendar"],
  ["Hey, Tan Drix, open Mail.", "open Mail"],
] as const;
const NOT = ["My brother Hendricks is coming", "Hey Trent", "Wake up Tom", "Hendrix played guitar"];

describe("the wake rule (VO2)", () => {
  it("knows a chosen name only as one word of letters", () => {
    expect(cleanWakeName(" Jarvis ")).toBe("Jarvis");
    for (const bad of ["Hey Jarvis", "J4rvis", "Jo", "", 5, "x".repeat(21)])
      expect(cleanWakeName(bad)).toBe("Tandrix");
  });

  it("is the same rule in the scorer as in the helper", () => {
    for (const [t] of WAKES) expect(soundAlikeRule(t)).toBe(true);
    for (const t of NOT) expect(soundAlikeRule(t)).toBe(false);
  });

  it.skipIf(!existsSync(bin))("wakes by sound in the helper, with what followed the name", () => {
    for (const [t, rest] of WAKES) expect(match(t)).toEqual({ woke: true, rest });
    for (const t of NOT) expect(match(t).woke).toBe(false);
  });

  it.skipIf(!existsSync(bin))("listens for a chosen name instead, short ones strictly", () => {
    expect(match("Hey Jarvis, open Mail", "Jarvis")).toEqual({ woke: true, rest: "open Mail" });
    expect(match("Hey Tandrix", "Jarvis").woke).toBe(false);
    expect(match("Hey Max", "Max").woke).toBe(true);
    expect(match("Hey man", "Max").woke).toBe(false);
  });
});

describe("the wake phrase run together (VO2, after the user's trial)", () => {
  const together = ["Hate and Rex", "Haitian tricks", "Hey ten dricks", "Wake up tan rex"];
  const apart = ["Hendrix", "My brother Hendrix is coming over", "Hot drinks", "Hand tricks"];
  it("wakes when the recogniser runs hey into the name, never on the name alone", () => {
    for (const t of together) expect(soundAlikeRule(t)).toBe(true);
    for (const t of apart) expect(soundAlikeRule(t)).toBe(false);
  });
  it.skipIf(!existsSync(bin))("does the same in the helper", () => {
    for (const t of together) expect(match(t).woke).toBe(true);
    for (const t of apart) expect(match(t).woke).toBe(false);
  });
});
