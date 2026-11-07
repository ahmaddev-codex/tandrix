import type { DoTurnResponse } from "@tandrix/contracts";
import { describe, expect, it } from "vitest";
import type { ScreenCapture } from "../src/shared/bridge";
import {
  notesIn,
  pageMoved,
  spokenPart,
  circling,
  fingerprint,
  actionLabel,
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
    say: (l, current) => {
      if (current()) said.push(l);
    },
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
  it("ends a single request the moment the model says it's done, without another look", async () => {
    const s = setup([act("Opening the chat."), act("Sending it."), done("Sent."), act("Again?")]);
    const r = await runScreenTask("Text Sam that I'm free for lunch", s.d);
    expect(r).toEqual({ status: "done", reply: "Sent." });
    expect(s.sent).toHaveLength(3);
  });

  it("says what a step is about to do before doing it", async () => {
    const order: string[] = [];
    const s = setup([act("Opening the chat."), done("Sent.")]);
    s.d.say = async (line) => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(`said ${line}`);
    };
    s.d.settle = (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 200)));
    s.d.run = async () => {
      order.push("clicked");
      return { status: "ran", ran: 1, acknowledged: [] };
    };
    await runScreenTask("Text Sam", s.d);
    expect(order).toEqual(["said Opening the chat.", "clicked"]);
  });

  it("drops a progress line once the task has moved past it", async () => {
    const lines: Array<{ line: string; current: () => boolean }> = [];
    const s = setup([act("Opening the chat."), done("Sent.")]);
    s.d.say = (line, current) => {
      lines.push({ line, current });
    };
    await runScreenTask("Text Sam", s.d);
    expect(lines.map((l) => l.line)).toEqual(["Opening the chat."]);
    expect(lines[0]!.current()).toBe(false);
  });

  it("carries what's been done into every turn instead of resending history", async () => {
    const s = setup([
      act("Opening the note."),
      act("Adding bread."),
      done("Added bread."),
      done("Added bread."),
    ]);
    const r = await runScreenTask("Open my shopping note and add bread", s.d);
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
    const r = await runScreenTask("Do one thing and then another", s.d);
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

  it("doesn't finish over an update said as it finished: it does that too, then checks", async () => {
    const s = setup([
      act("Writing the note."),
      done("Written."),
      act("Bolding it."),
      done("Bolded."),
    ]);
    let turns = 0;
    const turn = s.d.turn;
    s.d.turn = async (req) => {
      const r = await turn(req);
      // "Tandrix, also make the title bold", heard just as the model says it's done.
      if (++turns === 2) s.steer("Also make the title bold");
      return r;
    };
    const r = await runScreenTask("Write a note about lunch", s.d);
    expect(r.status).toBe("done");
    // The update went to the model on the turn after the claimed finish, and stays in its memory.
    expect(s.sent[2]!.memory.some((m) => m.includes('"Also make the title bold"'))).toBe(true);
    expect(s.sent.at(-1)!.memory.some((m) => m.includes('"Also make the title bold"'))).toBe(true);
    // And before calling it done, a look to check the whole of it is.
    expect(s.sent.some((t) => t.memory.some((m) => /Check this screen/.test(m)))).toBe(true);
  });

  it("keeps an update in mind through a long task", async () => {
    const steps = Array.from({ length: 40 }, (_, i) => act(`Step ${i}.`, i));
    const s = setup([...steps, done("All done.")]);
    const run = runScreenTask("A long job", s.d);
    s.steer("Use the blue theme");
    await run;
    expect(s.sent.at(-1)!.memory.some((m) => m.includes('"Use the blue theme"'))).toBe(true);
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

describe("actionLabel", () => {
  it("is what Tandrix said it's doing, first sentence only", () => {
    expect(actionLabel("Got it. Opening your calendar to add them. PLAN: three events", [])).toBe(
      "Opening your calendar to add them",
    );
  });
  it("falls back to the action", () => {
    expect(actionLabel("", [{ type: "type", text: "Acme" }])).toBe("Typing");
  });
});

describe("pageMoved", () => {
  const page: number[] = Array.from({ length: 48 * 30 }, (_, i) => (i % 48 < 24 ? 240 : 60));
  it("sees a scrolled page", () => {
    // Everything shifted down by three rows.
    const scrolled = page.map(
      (_, i) => page[(i + 48 * 30 - 48 * 3) % page.length]! + ((i / 48) % 2 ? 40 : 0),
    );
    expect(pageMoved(page, scrolled)).toBe(true);
  });
  it("ignores a cursor, a caret or a clock", () => {
    const nudged = [...page];
    for (const i of [5, 6, 300, 1439]) nudged[i] = nudged[i]! + 80;
    expect(pageMoved(page, nudged)).toBe(false);
  });
  it("can't tell without both sketches, so it doesn't stop", () => {
    expect(pageMoved(undefined, page)).toBe(false);
    expect(pageMoved(page, null)).toBe(false);
  });
});
