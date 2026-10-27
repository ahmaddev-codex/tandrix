import { describe, expect, it } from "vitest";
import { cleanSpokenReply } from "../src/reply";

describe("cleanSpokenReply", () => {
  it("keeps a plain reply as it is", () => {
    expect(cleanSpokenReply("  Click Export, then choose PDF. ")).toBe(
      "Click Export, then choose PDF.",
    );
  });

  it("turns leaked tool-call markup into the words it meant to say", () => {
    const leaked = `<atem:function_calls> <atem:invoke name="computer.stop"> <atem:parameter name="answer">I am not sure what you want to do. Say which step or button you need help with.</atem:parameter> </atem:invoke> </atem:function_calls>`;
    expect(cleanSpokenReply(leaked)).toBe(
      "I am not sure what you want to do. Say which step or button you need help with.",
    );
  });

  it("keeps words around the markup and drops arguments that aren't for the user", () => {
    const mixed = `Open Settings first. <function_calls><invoke name="computer.click"><parameter name="x">120</parameter></invoke></function_calls>`;
    expect(cleanSpokenReply(mixed)).toBe("Open Settings first.");
  });

  it("says nothing rather than reading out code", () => {
    expect(cleanSpokenReply("```js\nconst x = click(1, 2);\n```")).toBe("");
    expect(
      cleanSpokenReply('<invoke name="computer.move"><parameter name="x">3</parameter></invoke>'),
    ).toBe("");
  });

  it("unwraps a fenced sentence and inline code", () => {
    expect(cleanSpokenReply("```\nClick Save.\n```")).toBe("Click Save.");
    expect(cleanSpokenReply("Press `Command-S` to save.")).toBe("Press Command-S to save.");
  });

  it("takes the user's words out of JSON", () => {
    expect(cleanSpokenReply('{"answer": "Click Layer, then New Layer Mask."}')).toBe(
      "Click Layer, then New Layer Mask.",
    );
    expect(cleanSpokenReply('{"x": 1}')).toBe("");
  });
});
