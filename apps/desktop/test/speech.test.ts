import { pickVoice } from "@tandrix/core";
import { describe, expect, it } from "vitest";
import { parseSayVoices } from "../src/main/speech";

const out = `Albert              en_US    # Hello! My name is Albert.
Ava (Premium)       en_US    # Hello! My name is Ava.
Eddy (English (US)) en_US    # Hello! My name is Eddy.
Samantha            en_US    # Hello! My name is Samantha.
Amélie              fr_CA    # Bonjour! Je m’appelle Amélie.
`;

describe("parseSayVoices", () => {
  it("reads each voice's name and language", () => {
    const voices = parseSayVoices(out);
    expect(voices.map((v) => v.name)).toEqual([
      "Albert",
      "Ava (Premium)",
      "Eddy (English (US))",
      "Samantha",
      "Amélie",
    ]);
    expect(voices[1]).toMatchObject({ lang: "en-US" });
  });

  it("leads to the Premium voice", () => {
    expect(pickVoice(parseSayVoices(out), "en-US")?.name).toBe("Ava (Premium)");
  });
});
