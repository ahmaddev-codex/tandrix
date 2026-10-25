import { describe, expect, it } from "vitest";
import { parseVoiceCommand } from "../src";

describe("parseVoiceCommand", () => {
  it.each([
    ["Next.", "next"],
    ["OK Tandrix, next step please", "next"],
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
