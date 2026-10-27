import { describe, expect, it } from "vitest";
import {
  addLevel,
  END_PAUSE_MS,
  endedTurn,
  MAX_TURN_MS,
  NO_SPEECH_MS,
  startLevels,
  tappedTurn,
  type TurnLevels,
} from "../src/voice-turn";

/** Feeds 100 ms readings: `loud` ms of speech after `quietBefore` ms of room noise, then quiet. */
function levels(ms: number, speech: Array<[from: number, to: number]> = []): TurnLevels {
  let t = startLevels();
  for (let at = 0; at < ms; at += 100) {
    const loud = speech.some(([a, b]) => at >= a && at < b);
    t = addLevel(t, loud ? -20 : -60, 100);
  }
  return t;
}

describe("a tapped turn", () => {
  it("keeps listening while the user talks and through short pauses", () => {
    expect(tappedTurn(levels(2000, [[300, 2000]]))).toBe("listen");
    expect(tappedTurn(levels(2600, [[300, 2000]]))).toBe("listen");
  });

  it("sends after a pause once the user has spoken", () => {
    expect(tappedTurn(levels(2000 + END_PAUSE_MS, [[300, 2000]]))).toBe("send");
  });

  it("gives up without sending when nobody speaks", () => {
    expect(tappedTurn(levels(NO_SPEECH_MS - 100))).toBe("listen");
    expect(tappedTurn(levels(NO_SPEECH_MS))).toBe("nothing_heard");
  });

  it("doesn't count a click as speech", () => {
    expect(tappedTurn(levels(NO_SPEECH_MS, [[500, 600]]))).toBe("nothing_heard");
  });

  it("stops at the limit, sending what was said", () => {
    expect(tappedTurn(levels(MAX_TURN_MS, [[0, MAX_TURN_MS]]))).toBe("send");
  });

  it("treats a meter with no reading as quiet", () => {
    expect(addLevel(startLevels(), undefined, 100)).toEqual({
      elapsedMs: 100,
      speechMs: 0,
      quietMs: 100,
    });
  });
});

describe("a turn the user ends", () => {
  it("sends when they spoke, and not when they didn't", () => {
    expect(endedTurn(levels(1500, [[200, 1200]]))).toBe("send");
    expect(endedTurn(levels(200))).toBe("nothing_heard");
  });
});
