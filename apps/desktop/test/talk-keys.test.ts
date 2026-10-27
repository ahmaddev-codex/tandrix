import { describe, expect, it } from "vitest";
import { HOLD_MS, talkKeys, type Timers } from "../src/main/talk-keys";

function setup() {
  const events: string[] = [];
  let now = 0;
  let timers: Array<{ at: number; fn: () => void; id: number }> = [];
  let n = 0;
  const fake: Timers = {
    set(fn, ms) {
      const id = ++n;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clear(id) {
      timers = timers.filter((t) => t.id !== id);
    },
  };
  const advance = (ms: number) => {
    now += ms;
    for (const t of timers.filter((x) => x.at <= now)) {
      timers = timers.filter((x) => x !== t);
      t.fn();
    }
  };
  const keys = talkKeys(
    {
      start: () => events.push("start"),
      end: () => events.push("end"),
      cancel: () => events.push("cancel"),
    },
    fake,
  );
  return { keys, events, advance };
}

describe("hold Option+Command to talk", () => {
  it("starts once both are held, and sends on letting go", () => {
    const s = setup();
    s.keys.down("option");
    s.keys.down("command");
    s.advance(HOLD_MS - 1);
    expect(s.events).toEqual([]);
    s.advance(1);
    expect(s.events).toEqual(["start"]);
    s.keys.up("command");
    expect(s.events).toEqual(["start", "end"]);
  });

  it("works in either order, and ignores key repeat", () => {
    const s = setup();
    s.keys.down("command");
    s.keys.down("option");
    s.keys.down("option");
    s.advance(HOLD_MS);
    s.keys.up("option");
    expect(s.events).toEqual(["start", "end"]);
  });

  it("never starts for a ⌥⌘ shortcut", () => {
    const s = setup();
    s.keys.down("option");
    s.keys.down("command");
    s.keys.down("other");
    s.advance(HOLD_MS * 4);
    s.keys.up("option");
    s.keys.up("command");
    expect(s.events).toEqual([]);
  });

  it("stays spoiled until both are let go", () => {
    const s = setup();
    s.keys.down("option");
    s.keys.down("command");
    s.keys.down("other");
    s.keys.up("command");
    s.keys.down("command");
    s.advance(HOLD_MS);
    expect(s.events).toEqual([]);
    s.keys.up("option");
    s.keys.up("command");
    s.keys.down("option");
    s.keys.down("command");
    s.advance(HOLD_MS);
    expect(s.events).toEqual(["start"]);
  });

  it("cancels when another key is pressed while talking", () => {
    const s = setup();
    s.keys.down("option");
    s.keys.down("command");
    s.advance(HOLD_MS);
    s.keys.down("other");
    s.keys.up("option");
    expect(s.events).toEqual(["start", "cancel"]);
  });

  it("doesn't start on one key, or on a quick tap of both", () => {
    const s = setup();
    s.keys.down("option");
    s.advance(HOLD_MS * 2);
    s.keys.down("command");
    s.advance(HOLD_MS / 2);
    s.keys.up("command");
    s.advance(HOLD_MS * 2);
    expect(s.events).toEqual([]);
  });
});
