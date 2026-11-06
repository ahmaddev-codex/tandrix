import { describe, expect, it } from "vitest";
import { timingLine } from "../src/main/diagnostics";

describe("timing log line", () => {
  it("keeps the kind and the known stages' milliseconds", () => {
    expect(
      timingLine({ kind: "voice", total: 3200, stages: { recorded: 120, sounding: 3100 } }),
    ).toEqual({ event: "reply_timing", kind: "voice", total: 3200, recorded: 120, sounding: 3100 });
  });

  it("drops anything that isn't a known stage with whole milliseconds", () => {
    expect(
      timingLine({
        kind: "typed",
        total: 900,
        stages: {
          said: "book my dentist",
          answered: 1.5,
          pointed: -1,
          voiced: "400",
          captured: 80,
        },
      }),
    ).toEqual({ event: "reply_timing", kind: "typed", total: 900, captured: 80 });
  });

  it("refuses what isn't a timing", () => {
    expect(timingLine(null)).toBeNull();
    expect(timingLine({ kind: "secret", total: 10 })).toBeNull();
    expect(timingLine({ kind: "voice", total: "10" })).toBeNull();
  });
});
