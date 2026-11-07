import { describe, expect, it } from "vitest";
import { isNight, NIGHT_VOLUME, QUIET_VOLUME, voiceVolume } from "../src/renderer/lib/loudness";

const at = (h: number) => new Date(2026, 10, 6, h, 30);

describe("quiet and night modes", () => {
  it("is night from 10 pm to 7 am", () => {
    expect([21, 22, 23, 0, 6, 7].map((h) => isNight(at(h)))).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it("speaks at full volume by day, softer at night, softest in quiet mode", () => {
    expect(voiceVolume(at(14), { quiet: false, night: true })).toBe(1);
    expect(voiceVolume(at(23), { quiet: false, night: true })).toBe(NIGHT_VOLUME);
    expect(voiceVolume(at(23), { quiet: false, night: false })).toBe(1);
    expect(voiceVolume(at(14), { quiet: true, night: true })).toBe(QUIET_VOLUME);
    expect(voiceVolume(at(23), { quiet: true, night: true })).toBe(QUIET_VOLUME);
  });
});
