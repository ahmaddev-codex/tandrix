import type { DoTurnResponse } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import type { ScreenCapture } from "../src/shared/bridge";
import {
  notesIn,
  spokenPart,
  circling,
  fingerprint,
  likeness,
  memoryLine,
  repeats,
  runScreenTask,
  screenChanged,
  type ScreenTaskDeps,
} from "../src/renderer/lib/screen-task";

const geometry = {
  displayId: "1",
  imageWidth: 10,
  imageHeight: 10,
  originX: 0,
  originY: 0,
  displayWidth: 10,
  displayHeight: 10,
};
const shot = (n: number): ScreenCapture => ({
  image: new Uint8Array([n, n, n, n]),
  mimeType: "image/jpeg",
  geometry,
  capturedAt: "2026-10-30T10:00:00Z",
});
const act = (reply: string, x = 1): DoTurnResponse => ({
  status: "act",
  session: "s",
  turn: 1,
  actions: [{ type: "click", x, y: 1, button: "left" }],
  safetyChecks: [],
  reply,
});
const done = (reply: string): DoTurnResponse => ({ status: "done", reply });

function setup(script: DoTurnResponse[], screens?: number[]) {
  const sent: Array<{ memory: string[]; turn: number; planned: boolean }> = [];
  const said: string[] = [];
  let screen = 0;
  const steering: string[] = [];
  let stop = false;
  const d: ScreenTaskDeps = {
    capture: async () => shot(screens ? (screens[screen++] ?? 99) : screen++),
    apps: async () => ({ apps: ["Notes"], front: "Finder" }),
    openApp: async () => true,
    turn: async (req) => {
      sent.push({ memory: [...req.memory], turn: req.turn, planned: req.planned });
      return script.shift() ?? done("Done.");
    },
    next: async () => {
      sent.push({ memory: ["(continued)"], turn: -1, planned: true });
      return script.shift() ?? done("Done.");
    },
    run: async () => ({ status: "ran", ran: 1, acknowledged: [] }),
    say: (l) => said.push(l),
    steer: () => steering.splice(0),
    stopped: () => stop,
    settle: async () => undefined,
    base64: () => "",
  };
  return {
    d,
    sent,
    said,
    steer: (s: string) => steering.push(s),
    stop: () => (stop = true),
  };
}

describe("runScreenTask", () => {
  it("carries what's been done into every turn instead of resending history", async () => {
    const s = setup([
      act("Opening the note."),
      act("Adding bread."),
      done("Added bread."),
      done("Added bread."),
    ]);
    const r = await runScreenTask("Add bread to my shopping note", s.d);
    expect(r).toEqual({ status: "done", reply: "Added bread." });
    // Every turn is fresh (fast) and carries what's been done so far.
    expect(s.sent[0]!.memory).toEqual([]);
    expect(s.sent[1]!.memory).toEqual(["Opening the note. (clicked at 1,1)"]);
    expect(s.sent[2]!.memory).toEqual([
      "Opening the note. (clicked at 1,1)",
      "Adding bread. (clicked at 1,1)",
    ]);
    // Checking before finishing carries everything done so far.
    expect(s.sent[3]!.memory.at(-1)).toMatch(/^You said: "Added bread."\. Check this screen/);
    // Spoken at most every few seconds: the second line, a moment later, is left to the caption.
    expect(s.said).toEqual(["Opening the note."]);
  });

  it("checks the screen once before believing it's finished, and keeps going if not", async () => {
    const s = setup([
      act("Step one."),
      done("All done."),
      act("Oh, one more."),
      done("Now done."),
      done("Now done."),
    ]);
    const r = await runScreenTask("Two things", s.d);
    expect(r.reply).toBe("Now done.");
    expect(s.sent[2]!.memory.at(-1)).toMatch(/^You said: "All done."\. Check this screen/);
  });

  it("notices steps that change nothing, tries again, then asks instead of looping", async () => {
    const same = Array.from({ length: 6 }, () => act("Clicking.", 5));
    const s = setup(same, [1, 1, 1, 1, 1, 1, 1]);
    const r = await runScreenTask("Stubborn", s.d);
    expect(r.status).toBe("stuck");
    expect(s.sent[2]!.memory.at(-1)).toMatch(/no effect/);
  });

  it("takes a correction said mid-task into the next turn", async () => {
    const s = setup([act("Opening Calendar."), done("Booked."), done("Booked.")]);
    const run = runScreenTask("Book the dentist for Thursday", s.d);
    s.steer("No, the other Thursday");
    await run;
    expect(
      s.sent.some((t) =>
        t.memory.some((m) => m.includes('The user just said: "No, the other Thursday"')),
      ),
    ).toBe(true);
  });

  it("keeps every memory line within the API's limit", async () => {
    const long = "word ".repeat(200);
    const s = setup([act(long), act(long), act(long), done(long), done("ok")]);
    await runScreenTask("Long one", s.d);
    for (const t of s.sent) for (const m of t.memory) expect(m.length).toBeLessThanOrEqual(300);
  });

  it("stops the moment the user takes over", async () => {
    const s = setup([act("One."), act("Two.")]);
    s.d.run = async () => {
      s.stop();
      return { status: "stopped", ran: 0, message: "Stopped. You have control back." };
    };
    expect(await runScreenTask("Anything", s.d)).toEqual({
      status: "stopped",
      reply: "Stopped. You have control back.",
    });
  });

  it("opens the app first and finishes there when that was the whole ask", async () => {
    const s = setup([{ status: "open_app", app: "Notes" }]);
    expect(await runScreenTask("Open Notes", s.d)).toEqual({
      status: "done",
      reply: "Opened Notes.",
    });
  });
});

describe("going in circles", () => {
  const click = [{ type: "click" as const, x: 1, y: 1, button: "left" as const }];
  it("spots turns of clicking that say the same thing", () => {
    const turns = Array.from({ length: 5 }, (_, i) => ({
      reply: `That Garden note is tangled, so I'll clear it now ${i}`,
      actions: click,
    }));
    expect(circling(turns)).toBe(true);
    expect(likeness("Garden note is tangled", "the tangled Garden note")).toBeGreaterThan(0.5);
  });
  it("doesn't call real progress circling", () => {
    const turns = [
      "Opening Calendar.",
      "Clicking Thursday.",
      "Typing the title.",
      "Saving it.",
      "Inviting Sam.",
    ].map((reply) => ({ reply, actions: click }));
    expect(circling(turns)).toBe(false);
  });
  it("nudges once, then stops and asks", async () => {
    const loop = Array.from({ length: 20 }, () => act("That note is tangled, so I'll clear it."));
    const s = setup(loop);
    const r = await runScreenTask("Fix it", s.d);
    expect(r.status).toBe("stuck");
    expect(
      s.sent.some((t) =>
        t.memory.some(
          (m) =>
            m.startsWith("You've spent several turns") || m.startsWith("You've now done exactly"),
        ),
      ),
    ).toBe(true);
  });
});

describe("helpers", () => {
  it("writes a plain memory line", () => {
    expect(
      memoryLine("Adding it.", [
        { type: "type", text: "bread" },
        { type: "keypress", keys: ["return"] },
      ]),
    ).toBe('Adding it. (typed "bread", pressed return)');
  });
  it("tells screens apart", () => {
    expect(fingerprint(new Uint8Array([1, 2, 3]))).not.toBe(fingerprint(new Uint8Array([1, 2, 4])));
  });
});

describe("leaving an app", () => {
  it("writes down what the last app held when the model left it without a note", async () => {
    const s = setup([
      act("Got the lineup, opening Calendar."),
      act("Adding them."),
      done("Added."),
    ]);
    const apps = ["WhatsApp", "WhatsApp", "Calendar", "Calendar", "Calendar", "Calendar"];
    const noted: string[] = [];
    s.d.front = async () => apps.shift();
    s.d.note = async (req) => {
      noted.push(req.task);
      return "Acme Tue 3 Nov 10:00-10:45";
    };
    await runScreenTask("Add the interviews to my calendar", s.d);
    expect(noted).toEqual(["Add the interviews to my calendar"]);
    expect(s.sent[1]!.memory[0]).toBe("You noted in WhatsApp: Acme Tue 3 Nov 10:00-10:45");
  });

  it("doesn't, when the model wrote its own note there", async () => {
    const s = setup([
      act("NOTE: Acme Tue 10:00. Opening Calendar."),
      act("Adding."),
      done("Added."),
    ]);
    const apps = ["WhatsApp", "WhatsApp", "Calendar", "Calendar", "Calendar", "Calendar"];
    let asked = 0;
    s.d.front = async () => apps.shift();
    s.d.note = async () => {
      asked++;
      return "x";
    };
    await runScreenTask("Add it to my calendar", s.d);
    expect(asked).toBe(0);
  });
});

describe("plans and notes", () => {
  it("keeps the model's plan and what it read, whole, for every later turn", () => {
    const reply =
      "PLAN: open WhatsApp; open the interviews chat; note the times; open Calendar. NOTE: Acme Tue 4 Nov 10:00; Globex Wed 5 Nov 14:30.";
    expect(notesIn(reply)).toEqual([
      "Your plan: open WhatsApp; open the interviews chat; note the times; open Calendar.",
      "You noted: Acme Tue 4 Nov 10:00; Globex Wed 5 Nov 14:30.",
    ]);
  });

  it("never says the plan, the notes or filler aloud", () => {
    expect(spokenPart("Got it. Opening Calendar.")).toBe("Opening Calendar.");
    expect(spokenPart("Okay, got it — adding the first one.")).toBe("adding the first one.");
    expect(spokenPart("NOTE: Acme Tue 10:00")).toBe("");
    expect(spokenPart("PLAN: open WhatsApp; open Calendar.")).toBe("");
  });
});

describe("telling a real change from noise", () => {
  const flat = Array.from({ length: 1440 }, () => 200);
  it("ignores a caret blinking in one cell", () => {
    const blink = [...flat];
    blink[700] = 120;
    expect(screenChanged(flat, blink)).toBe(false);
  });
  it("sees a field filling or a window opening", () => {
    const opened = flat.map((v, i) => (i % 48 > 10 && i % 48 < 30 && i > 300 ? 90 : v));
    expect(screenChanged(flat, opened)).toBe(true);
  });
  it("can't tell without sketches", () => {
    expect(screenChanged(undefined, flat)).toBeNull();
  });
});

describe("repeats", () => {
  const send = (y: number) => ({
    actions: [
      { type: "click" as const, x: 804, y, button: "left" as const },
      { type: "type" as const, text: "Free for lunch tomorrow" },
      { type: "keypress" as const, keys: ["Return"] },
    ],
  });
  it("counts the same batch aimed a pixel or two away", () => {
    expect(repeats([send(689), send(688), send(690)])).toBe(3);
  });
  it("doesn't count different steps", () => {
    expect(
      repeats([
        send(689),
        { actions: [{ type: "click" as const, x: 100, y: 100, button: "left" as const }] },
        send(689),
      ]),
    ).toBe(2);
  });
});
