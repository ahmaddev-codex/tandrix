import { describe, expect, it } from "vitest";
import { ALL_PHRASES, GENERAL_PHRASES, nextPhrase, phrasesFor } from "../src/thinking";

describe("thinking phrases", () => {
  it("has about two hundred phrases, each short and different", () => {
    expect(ALL_PHRASES.length).toBeGreaterThanOrEqual(180);
    expect(ALL_PHRASES.length).toBeLessThanOrEqual(220);
    for (const p of ALL_PHRASES) expect(p.length).toBeLessThanOrEqual(30);
  });

  it("picks phrases about the job", () => {
    const { topical } = phrasesFor(
      "Go to my WhatsApp and grab the interview lineup, then add it to my calendar",
    );
    expect(topical).toContain("Reading the chat");
    expect(topical).toContain("Checking your calendar");
    expect(phrasesFor("Check the parts against the manual").topical).toEqual(
      expect.arrayContaining(["Checking each part", "Reading the manual"]),
    );
  });

  it("uses general phrases when the job has no topic", () => {
    expect(phrasesFor("hmm").topical).toEqual([]);
    expect(GENERAL_PHRASES).toContain(nextPhrase("hmm", [], { random: () => 0 }));
  });

  it("never repeats a recent phrase", () => {
    const recent: string[] = [];
    for (let i = 0; i < 60; i++) {
      const p = nextPhrase("Add the interviews to my calendar", recent);
      expect(recent.slice(-4)).not.toContain(p);
      recent.push(p);
    }
  });
});
