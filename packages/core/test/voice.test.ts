import { describe, expect, it } from "vitest";
import {
  parseVoiceCommand,
  parseWakePhrase,
  speechPieces,
  continuesLesson,
  wantsExplanation,
  wantsLesson,
  wantsReplay,
} from "../src";

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

describe("lessons and explanations", () => {
  it.each([
    "Teach mw how to use Google Docs",
    "Teach me Google Sheets",
    "I want to learn Figma",
    "Show me around Notion",
    "How do I use pivot tables?",
    "Get me started with Excel",
  ])("treats %s as a lesson", (s) => expect(wantsLesson(s)).toBe(true));

  it.each([
    "I have this equation on my screen and I don't understand it",
    "What does this error mean?",
    "Explain this chart",
    "Help me understand this paragraph",
    "Solve this for me",
    "What's this formula?",
  ])("treats %s as wanting an explanation", (s) => expect(wantsExplanation(s)).toBe(true));

  it("leaves plain questions alone", () => {
    expect(wantsExplanation("How do I export this as a PDF?")).toBe(false);
    expect(wantsLesson("Where is the export button?")).toBe(false);
  });
});

describe("going through what's on screen", () => {
  it.each([
    "Walk me through these functional groups",
    "Can you go through the functional groups on my screen?",
    "Show me the functional groups",
    "Point out the bonds in this molecule",
    "Take me through this proof",
    "Highlight the sine and cosine waves",
    "What are the parts here?",
    "Teach me the bones of the hand",
  ])("explains %s on the screen", (s) => expect(wantsExplanation(s)).toBe(true));

  it.each([
    "Walk me through setting up Gmail",
    "Show me the export settings",
    "Show me the share button",
    "Walk me through the menus",
  ])("leaves %s to the app", (s) => expect(wantsExplanation(s)).toBe(false));
});

describe("explaining any subject, programming included", () => {
  it.each([
    "What does this function do?",
    "Why does this code fail?",
    "Review my code",
    "Find the bug",
    "How does this query work?",
    "Translate this",
  ])("explains %s", (s) => expect(wantsExplanation(s)).toBe(true));

  it.each([
    "Teach me about photosynthesis",
    "Help me learn about recursion",
    "I want to understand compound interest",
  ])("teaches %s as a lesson", (s) => expect(wantsLesson(s)).toBe(true));
});

describe("carrying on a lesson, or seeing it again", () => {
  it.each([
    "next",
    "Next.",
    "okay what's next",
    "Got it, next",
    "go on",
    "done",
    "continue",
    "Okay",
  ])("carries on after %j", (s) => expect(continuesLesson(s)).toBe(true));
  it.each(["Next to the sacrum, what's that?", "What is the atlas?", "Open Mail"])(
    "leaves %j to be answered",
    (s) => expect(continuesLesson(s)).toBe(false),
  );
  it.each(["Show me again", "Can you go over that again?", "One more time", "show it again"])(
    "replays on %j",
    (s) => expect(wantsReplay(s)).toBe(true),
  );
  it("doesn't replay a new question", () => {
    expect(wantsReplay("Show me the axis")).toBe(false);
  });
});
