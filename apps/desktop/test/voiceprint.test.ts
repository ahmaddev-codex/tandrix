import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import prints from "./fixtures/voiceprints.json";
import { distance, fromSetup, shouldAnswer, voiceprintStore, type Voiceprint } from "../src/main/voiceprint";

// Real prints from the wake helper (`tandrix-wake --print`) of macOS voices saying wake phrases.
const P = prints as Record<string, number[]>;
const setup = [P["Samantha-e0"]!, P["Samantha-e1"]!, P["Samantha-e2"]!];

describe("voiceprint", () => {
  const made = fromSetup(setup);
  if (!("print" in made)) throw new Error("setup should agree");
  const vp: Voiceprint = { version: 1, print: made.print, onlyMine: true, createdAt: "2026-10-30" };

  it("answers the voice that set it up, saying new phrases", () => {
    expect(shouldAnswer(vp, P["Samantha-t0"])).toBe(true);
    expect(shouldAnswer(vp, P["Samantha-t1"])).toBe(true);
  });

  it("ignores other voices", () => {
    for (const other of ["Daniel-t0", "Karen-t1"]) expect(shouldAnswer(vp, P[other])).toBe(false);
  });

  it("answers anyone when only-my-voice is off, or when there's too little voice to tell", () => {
    expect(shouldAnswer({ ...vp, onlyMine: false }, P["Daniel-t0"])).toBe(true);
    expect(shouldAnswer(vp, undefined)).toBe(true);
    expect(shouldAnswer(null, P["Daniel-t0"])).toBe(true);
  });

  it("asks for a setup phrase again when it sounds like someone else", () => {
    expect(fromSetup([setup[0]!, setup[1]!, P["Fred-e0"]!])).toEqual({ redo: 2 });
  });

  it("measures a microphone's colouring away: the same offset on both sides doesn't move the distance", () => {
    const shift = (p: number[]) => p.map((x, i) => x + (i < 12 ? 3 : 0));
    expect(distance(shift(vp.print), shift(P["Samantha-t0"]!))).toBeCloseTo(distance(vp.print, P["Samantha-t0"]!), 6);
  });

  it("saves, loads and deletes on disk", () => {
    const store = voiceprintStore(mkdtempSync(join(tmpdir(), "vp-")));
    expect(store.load()).toBeNull();
    store.save(vp);
    expect(store.load()).toEqual(vp);
    store.remove();
    expect(store.load()).toBeNull();
  });
});
