import { describe, expect, it } from "vitest";
import { parseVoiceCommand, parseWakePhrase, speechPieces, wantsLesson } from "../src";

describe("parseVoiceCommand", () => {
  it.each([
    ["Next.", "next"],
    ["OK Tandrix, next step please", "next"],
    ["Hey, Tandrix, next step", "next"],
    ["Wake up Tandrix, next step", "next"],
    ["go back", "previous"],
    ["Say that again?", "repeat"],
    ["Show me again", "show"],
    ["Stop", "stop"],
    ["Start the step", "start"],
    ["I'm done", "done"],
    ["I’ve done it", "done"],
    ["Mark it as done", "done"],
  ])("%j is %s", (said, kind) => {
    expect(parseVoiceCommand(said)?.kind).toBe(kind);
  });

  it("keeps what you're stuck on", () => {
    expect(parseVoiceCommand("I'm stuck on the mechanical seal")).toEqual({
      kind: "stuck",
      detail: "the mechanical seal",
    });
    expect(parseVoiceCommand("help")).toEqual({ kind: "stuck" });
  });

  it("keeps the reason for skipping", () => {
    expect(parseVoiceCommand("Skip this step because the bolts are already torqued")).toEqual({
      kind: "skip",
      reason: "the bolts are already torqued",
    });
    expect(parseVoiceCommand("skip")).toEqual({ kind: "skip" });
  });

  it.each([
    "What's the next step after the seal?",
    "Should I skip the gasket if it looks fine?",
    "Which way do the vanes face?",
    "How tight is done for these bolts",
    "",
  ])("leaves questions to the assistant: %j", (said) => {
    expect(parseVoiceCommand(said)).toBeNull();
  });
});

describe("parseWakePhrase", () => {
  it("detects 'Hey Tandrix' and 'Wake up Tandrix' with punctuation and phonetic variants", () => {
    expect(parseWakePhrase("Hey Tandrix")).toEqual({ woke: true, remainder: "" });
    expect(parseWakePhrase("Hey, Tandrix.")).toEqual({ woke: true, remainder: "" });
    expect(parseWakePhrase("Hey, Tantrix!")).toEqual({ woke: true, remainder: "" });
    expect(parseWakePhrase("Wake up Tandrix")).toEqual({ woke: true, remainder: "" });
    expect(parseWakePhrase("Wake up, Tandrix!")).toEqual({ woke: true, remainder: "" });
    expect(parseWakePhrase("Wake-Up Tandrix!")).toEqual({ woke: true, remainder: "" });
    expect(
      parseWakePhrase("Wake up, Tandrix, open Safari and search for espresso instructions"),
    ).toEqual({
      woke: true,
      remainder: "open Safari and search for espresso instructions",
    });
    expect(parseWakePhrase("Hey, Tandrix: how do I crop a layer in Figma?")).toEqual({
      woke: true,
      remainder: "how do I crop a layer in Figma?",
    });
    expect(parseWakePhrase("How do I export a PDF?")).toEqual({
      woke: false,
      remainder: "How do I export a PDF?",
    });
  });
});

describe("wantsLesson", () => {
  it.each([
    "teach me Photoshop",
    "Teach me how to use Spotify",
    "show me how to use Google Docs",
    "walk me through pivot tables",
    "guide me through my first setup",
    "help me learn VS Code debugging",
    "give me a tour of the settings",
    "how do I use mail merge",
    "How to use formulas here",
    "please teach me Excel",
  ])("treats %j as a lesson", (text) => {
    expect(wantsLesson(text)).toBe(true);
  });

  it.each([
    "",
    "how do I export this?",
    "where is the export button?",
    "what does this error mean?",
    "do it for me",
    "click Save for me",
    "show me again",
  ])("treats %j as not a lesson", (text) => {
    expect(wantsLesson(text)).toBe(false);
  });
});

describe("speechPieces", () => {
  it("voices the first sentence alone, then the rest a sentence or two at a time", () => {
    expect(
      speechPieces("Got it. Click the Archive button to move this out of your inbox."),
    ).toEqual(["Got it.", "Click the Archive button to move this out of your inbox."]);
    expect(speechPieces("Click File. Then Export. Then choose PDF.")).toEqual([
      "Click File.",
      "Then Export. Then choose PDF.",
    ]);
  });

  it("keeps abbreviations and numbers in their sentence", () => {
    expect(speechPieces("Set it to 3.5 mm, e.g. with the dial. Then save.")).toEqual([
      "Set it to 3.5 mm, e.g. with the dial.",
      "Then save.",
    ]);
  });

  it("splits a long rest into pieces no longer than needed", () => {
    const s = "This sentence is about forty characters.";
    const pieces = speechPieces(`Okay. ${Array(8).fill(s).join(" ")}`);
    expect(pieces[0]).toBe("Okay.");
    expect(pieces.length).toBeGreaterThan(2);
    for (const p of pieces.slice(1)) expect(p.length).toBeLessThanOrEqual(160);
    expect(pieces.join(" ")).toBe(`Okay. ${Array(8).fill(s).join(" ")}`);
  });

  it("has nothing to say for nothing", () => {
    expect(speechPieces("  ")).toEqual([]);
    expect(speechPieces("Done")).toEqual(["Done"]);
  });
});
