import { describe, expect, it } from "vitest";
import { pickVoice, voiceScore, type DeviceVoice } from "../src/voices";

const v = (id: string, name: string, lang = "en-US", quality?: string): DeviceVoice => ({
  id,
  name,
  lang,
  ...(quality ? { quality } : {}),
});

const ios = [
  v("com.apple.voice.compact.en-US.Samantha", "Samantha", "en-US", "Default"),
  v("com.apple.speech.synthesis.voice.Zarvox", "Zarvox", "en-US", "Default"),
  v("com.apple.eloquence.en-US.Eddy", "Eddy", "en-US", "Default"),
  v("com.apple.voice.enhanced.en-US.Evan", "Evan", "en-US", "Enhanced"),
  v("com.apple.voice.premium.en-US.Ava", "Ava", "en-US", "Enhanced"),
  v("com.apple.voice.premium.fr-FR.Amelie", "Amélie", "fr-FR", "Enhanced"),
];

describe("pickVoice", () => {
  it("prefers a Premium voice, then Enhanced, over the compact default", () => {
    expect(pickVoice(ios, "en-US")?.name).toBe("Ava");
    expect(
      pickVoice(
        ios.filter((x) => x.name !== "Ava"),
        "en-US",
      )?.name,
    ).toBe("Evan");
  });

  it("never picks a novelty or Eloquence voice", () => {
    expect(voiceScore(ios[1]!, "en-US")).toBeLessThan(0);
    expect(voiceScore(ios[2]!, "en-US")).toBeLessThan(0);
    expect(pickVoice([ios[1]!, ios[2]!], "en-US")).toBeNull();
  });

  it("speaks the user's language", () => {
    expect(pickVoice(ios, "fr")?.name).toBe("Amélie");
    expect(pickVoice(ios, "de")).toBeNull();
  });

  it("never falls back to a compact voice: no natural voice means none", () => {
    expect(pickVoice([ios[0]!], "en-US")).toBeNull();
  });

  it("reads macOS voice names when quality isn't reported", () => {
    const mac = [
      v("Samantha", "Samantha", "en-US"),
      v("Zoe (Premium)", "Zoe (Premium)", "en-US"),
      v("Daniel", "Daniel", "en-GB"),
      v("Eddy (English (United States))", "Eddy (English (United States))", "en-US"),
    ];
    expect(pickVoice(mac, "en-US")?.name).toBe("Zoe (Premium)");
    expect(voiceScore(mac[3]!, "en-US")).toBeLessThan(0);
    // A compact voice is never a fallback; an Enhanced one is.
    expect(pickVoice([mac[2]!], "en-GB")).toBeNull();
    expect(
      pickVoice([mac[2]!, v("Daniel (Enhanced)", "Daniel (Enhanced)", "en-GB")], "en-GB")?.name,
    ).toBe("Daniel (Enhanced)");
  });
});
