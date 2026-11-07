import { describe, expect, it } from "vitest";
import {
  addLevel,
  END_PAUSE_MS,
  endedTurn,
  FOLLOW_UP_MS,
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
    expect(addLevel(startLevels(), undefined, 100)).toMatchObject({
      elapsedMs: 100,
      speechMs: 0,
      quietMs: 100,
    });
  });

  it("hears the pause over a fan or hum louder than the speech threshold", () => {
    // A noisy room at -36 dBFS (over SPEECH_DB), speech at -18 from 1 s to 3 s, then the room.
    let t = startLevels();
    let sent = -1;
    for (let at = 0; at < 8000; at += 50) {
      t = addLevel(t, at >= 1000 && at < 3000 ? -18 : -36, 50);
      if (sent < 0 && tappedTurn(t) === "send") sent = at;
    }
    // About a second after the user stopped, not never.
    expect(sent).toBeGreaterThanOrEqual(3000 + END_PAUSE_MS - 100);
    expect(sent).toBeLessThan(3000 + END_PAUSE_MS + 300);
  });

  it("never takes a long, unbroken stretch of talking for the room", () => {
    let t = startLevels();
    for (let at = 0; at < 8000; at += 50) {
      t = addLevel(t, -18, 50);
      expect(tappedTurn(t)).toBe("listen");
    }
  });

  it("still counts speech with natural gaps between words in a noisy room", () => {
    let t = startLevels();
    for (let at = 0; at < 1000; at += 50) t = addLevel(t, -36, 50);
    // Two seconds of talking: words with short dips back to the room between them.
    for (let at = 0; at < 2000; at += 50) {
      t = addLevel(t, at % 400 < 300 ? -18 : -36, 50);
      expect(tappedTurn(t)).toBe("listen");
    }
    expect(t.speechMs).toBeGreaterThan(1200);
  });
});

describe("a turn the user ends", () => {
  it("sends when they spoke, and not when they didn't", () => {
    expect(endedTurn(levels(1500, [[200, 1200]]))).toBe("send");
    expect(endedTurn(levels(200))).toBe("nothing_heard");
  });
});

describe("follow-up listening", () => {
  it("gives up sooner when waiting for a follow-up", () => {
    let t = startLevels();
    for (let i = 0; i < 11; i++) t = addLevel(t, -70, 100);
    expect(tappedTurn(t)).toBe("listen");
    // Quiet for a second after the answer: no follow-up, so it stops listening.
    expect(tappedTurn(t, FOLLOW_UP_MS)).toBe("nothing_heard");
  });

  it("still takes a follow-up that starts in time", () => {
    // Speaking within the second, then going quiet.
    let t = startLevels();
    for (let i = 0; i < 5; i++) {
      t = addLevel(t, -70, 100);
      expect(tappedTurn(t, FOLLOW_UP_MS)).toBe("listen");
    }
    for (let i = 0; i < 10; i++) t = addLevel(t, -20, 100);
    for (let i = 0; i < 15; i++) t = addLevel(t, -70, 100);
    expect(tappedTurn(t, FOLLOW_UP_MS)).toBe("send");
  });
});
