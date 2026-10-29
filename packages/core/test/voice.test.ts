import { describe, expect, it } from "vitest";
import { parseVoiceCommand, parseWakePhrase, wantsLesson } from "../src";

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
