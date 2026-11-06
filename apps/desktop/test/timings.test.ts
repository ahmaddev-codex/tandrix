import { describe, expect, it } from "vitest";
import {
  endReply,
  markReply,
  startReply,
  stopwatch,
  takeReply,
  type ReplyTiming,
} from "../src/renderer/lib/timings";

describe("reply stopwatch", () => {
  it("records when each stage finished, from the start", () => {
    let t = 1000;
    const out: ReplyTiming[] = [];
    const w = stopwatch(
      "voice",
      (r) => out.push(r),
      () => t,
    );
    t = 1120;
    w.mark("recorded");
    t = 1900;
    w.mark("transcribed");
    t = 1950;
    w.mark("recorded");
    t = 4200;
    w.end();
    w.end();
    expect(out).toEqual([
      { kind: "voice", total: 3200, stages: { recorded: 120, transcribed: 900 } },
    ]);
  });

  it("lets the voice take a reply over, so the reply ending doesn't end it", () => {
    const out: ReplyTiming[] = [];
    startReply("typed", (r) => out.push(r));
    markReply("answered");
    const voice = takeReply();
    endReply();
    expect(out).toHaveLength(0);
    voice!.mark("sounding");
    voice!.end();
    expect(out).toHaveLength(1);
    expect(Object.keys(out[0]!.stages)).toEqual(["answered", "sounding"]);
  });

  it("reports a reply that never spoke when its work ends", () => {
    const out: ReplyTiming[] = [];
    startReply("voice", (r) => out.push(r));
    markReply("transcribed");
    endReply();
    endReply();
    expect(out).toHaveLength(1);
  });

  it("ends the last reply when a new one starts", () => {
    const out: ReplyTiming[] = [];
    startReply("voice", (r) => out.push(r));
    startReply("typed", (r) => out.push(r));
    expect(out.map((r) => r.kind)).toEqual(["voice"]);
    endReply();
  });
});
