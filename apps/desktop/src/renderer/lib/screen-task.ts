// One task on the screen, seen through to the end. Each turn is a fresh, fast model call with the
// current screenshot and a running memory of what's been done (sending the whole history every
// turn made each turn slower than the last). It never redoes what the memory says is done,
// notices when a step had no effect and tries another way, double-checks the screen before saying
// it's finished, takes corrections said mid-task, and keeps going until the job is done, the user
// stops it, or it's truly stuck and says so.
import { DO_MAX_TURNS, type DesktopAction, type DoTurnResponse } from "@tandrix/contracts";
import type { DoBatch, DoBatchResult, ScreenCapture, ScreenControl } from "../../shared/bridge";
import { onShot, snapClicks, type ShotControl } from "./controls";

export interface ScreenTaskDeps {
  capture: () => Promise<ScreenCapture>;
  apps: () => Promise<{ apps: string[]; front?: string }>;
  openApp: (name: string) => Promise<boolean>;
  turn: (req: {
    screenshot: { mimeType: ScreenCapture["mimeType"]; data: string };
    task: string;
    geometry: ScreenCapture["geometry"];
    apps: string[];
    frontApp?: string;
    planned: boolean;
    memory: string[];
    turn: number;
    controls?: ShotControl[];
  }) => Promise<DoTurnResponse>;
  /** Continues the same model conversation (it remembers its own last few steps). */
  next: (req: {
    session: string;
    screenshot: { mimeType: ScreenCapture["mimeType"]; data: string };
    geometry: ScreenCapture["geometry"];
    acknowledged: DoBatch["safetyChecks"];
  }) => Promise<DoTurnResponse>;
  run: (batch: DoBatch) => Promise<DoBatchResult>;
  /** Says a progress line aloud. */
  say: (line: string) => void;
  /** What it's doing right now, for the bar at the top ("Opening Calendar"). */
  doing?: (label: string) => void;
  /** Corrections the user said since the last turn ("no, Thursday the 13th"). */
  steer: () => string[];
  stopped: () => boolean;
  settle: (ms: number) => Promise<void>;
  base64: (bytes: Uint8Array) => string;
  /** The app in front now, when the Mac can tell. */
  front?: () => Promise<string | undefined>;
  /** The front window's controls (SP5), read from the app; empty when it can't be read. */
  controls?: () => Promise<ScreenControl[]>;
  /** What a screen holds that the task needs, written down; null when nothing. */
  note?: (req: {
    screenshot: { mimeType: ScreenCapture["mimeType"]; data: string };
    task: string;
  }) => Promise<string | null>;
}

export type ScreenTaskResult =
  | { status: "done"; reply: string }
  | { status: "stopped"; reply: string }
  | { status: "stuck"; reply: string }
  | { status: "failed"; reply: string };

export const STOPPED_REPLY = "Stopped. You have control back.";

/** How long the screen gets to settle after a batch before the next screenshot. */
const SETTLE_MS = 300;
/** In a row, steps that changed nothing, before Tandrix stops and asks. */
const STUCK_AFTER = 3;
/** The model sees this much recent memory each turn. */
const MEMORY_LINES = 30;
/** At most one progress line spoken this often while working. */
const SPEAK_EVERY_MS = 3500;
/**
 * Turns continued in the same model conversation before starting fresh with the memory: enough for
 * the model to remember what it just did, few enough that turns don't slow down as screenshots pile
 * up.
 */
const CHAIN = 0;
/** Turns of only clicking and near-identical narration before Tandrix calls it going in circles. */
const CIRCLE_TURNS = 5;
/** The same batch this often in the last six turns: told to change tack, then stopped. */
const REPEAT_NUDGE = 3;
const REPEAT_STOP = 5;

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{3,}/g) ?? []);
/** How alike two lines are, 0 to 1, by the words they share. */
export function likeness(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / Math.min(A.size, B.size);
}

/**
 * Going in circles: the last few turns only clicked or moved (nothing typed, pressed or dragged)
 * and said much the same thing. Selecting things over and over isn't progress.
 */
export function circling(recent: Array<{ reply: string; actions: DesktopAction[] }>): boolean {
  if (recent.length < CIRCLE_TURNS) return false;
  const last = recent.slice(-CIRCLE_TURNS);
  const onlyPointing = last.every((t) =>
    t.actions.every((a) => a.type === "click" || a.type === "move" || a.type === "wait"),
  );
  if (!onlyPointing) return false;
  let alike = 0;
  for (let i = 1; i < last.length; i++)
    if (likeness(last[i - 1]!.reply, last[i]!.reply) >= 0.5) alike++;
  return alike >= last.length - 2;
}

/** A one-line record of a batch, in plain words, for the memory. */
export function memoryLine(reply: string, actions: DesktopAction[]): string {
  const did = actions
    .map((a) =>
      a.type === "type"
        ? `typed "${a.text.length > 40 ? `${a.text.slice(0, 40)}…` : a.text}"`
        : a.type === "keypress"
          ? `pressed ${a.keys.join("+")}`
          : a.type === "click" || a.type === "double_click"
            ? `${a.type === "double_click" ? "double-clicked" : "clicked"} at ${a.x},${a.y}`
            : a.type === "scroll"
              ? "scrolled"
              : a.type === "drag"
                ? "dragged"
                : a.type === "wait"
                  ? null
                  : a.type,
    )
    .filter(Boolean)
    .join(", ");
  return `${reply ? `${reply.replace(/\s+/g, " ").trim()} ` : ""}(${did || "looked"})`.slice(
    0,
    290,
  );
}

/** The model's plan and what it noted down to use later, out of a reply ("PLAN: …", "NOTE: …"). */
export function notesIn(reply: string): string[] {
  const out: string[] = [];
  for (const m of reply.matchAll(/\b(PLAN|NOTE):\s*([\s\S]*?)(?=\s*\b(?:PLAN|NOTE):|$)/g)) {
    const text = m[2]!.replace(/\s+/g, " ").trim();
    const label = m[1] === "PLAN" ? "Your plan:" : "You noted:";
    // Kept whole: long notes go over several lines rather than being cut.
    for (let i = 0; i < text.length && out.length < 6; i += 270)
      out.push(`${label} ${text.slice(i, i + 270)}`);
  }
  return out;
}

/**
 * What of a reply is worth saying aloud: never the plan or notes, and without the filler a model
 * opens with ("Got it.", "Okay,").
 */
export function spokenPart(reply: string): string {
  return reply
    .replace(/\b(PLAN|NOTE):[\s\S]*?(?=\s*\b(?:PLAN|NOTE):|$)/g, "")
    .replace(/^\s*((got it|okay|ok|sure|alright|all right|on it|right|great)\b[\s,.!—–-]*)+/i, "")
    .trim();
}

/**
 * Whether the screen changed between two sketches (48×30 brightness): more than a few cells
 * moved by more than a little. A blinking caret or a ticking clock is one faint cell, not a change.
 */
export function screenChanged(a: number[] | undefined, b: number[] | undefined): boolean | null {
  if (!a || !b || a.length !== b.length) return null;
  let moved = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i]! - b[i]!) > 10) moved++;
  return moved > 3;
}

/** A batch as a pattern: positions to about 16 px, so the same step aimed a pixel away still counts. */
export function batchPattern(actions: DesktopAction[]): string {
  return JSON.stringify(
    actions
      .filter((a) => a.type !== "wait" && a.type !== "screenshot")
      .map((a) =>
        "x" in a && "y" in a
          ? { ...a, x: Math.round(a.x / 16), y: Math.round(a.y / 16) }
          : a.type === "drag"
            ? {
                type: a.type,
                from: a.path.map((p) => [Math.round(p.x / 16), Math.round(p.y / 16)]),
              }
            : a,
      ),
  );
}

/** How many of the last few batches were this same batch again. */
export function repeats(recent: Array<{ actions: DesktopAction[] }>, window = 6): number {
  const last = recent.at(-1);
  if (!last || !last.actions.length) return 0;
  const p = batchPattern(last.actions);
  return recent.slice(-window).filter((t) => batchPattern(t.actions) === p).length;
}

/**
 * What Tandrix is doing this turn, short enough for the bar: the first sentence of what it said,
 * else what its actions are ("Typing", "Scrolling").
 */
export function actionLabel(reply: string, actions: DesktopAction[]): string {
  const said = spokenPart(reply)
    .split(/(?<=[.!?])\s/)[0]
    ?.replace(/[.!]+$/, "")
    .trim();
  if (said) return said.length > 64 ? `${said.slice(0, 63).trimEnd()}…` : said;
  const a = actions.find((x) => x.type !== "wait" && x.type !== "screenshot");
  if (!a) return "Looking at the screen";
  switch (a.type) {
    case "type":
      return "Typing";
    case "keypress":
      return "Pressing keys";
    case "scroll":
      return "Scrolling";
    case "drag":
      return "Dragging";
    default:
      return "Clicking";
  }
}

/** A cheap fingerprint of a screenshot, to tell whether a step changed anything. */
export function fingerprint(bytes: Uint8Array): string {
  let h = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) h = Math.imul(h ^ bytes[i]!, 16777619);
  return `${bytes.length}:${(h >>> 0).toString(36)}`;
}

const ONLY_OPEN = (app: string) =>
  new RegExp(
    `^(?:please\\s+)?(?:open|launch|start|switch to)\\s+${app.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+for\\s+me)?[.!]*$`,
    "i",
  );

export async function runScreenTask(task: string, d: ScreenTaskDeps): Promise<ScreenTaskResult> {
  const memory: string[] = [];
  /** The plan and what was noted to use later: sent every turn, never pushed out. */
  const notes: string[] = [];
  let lastSpoken = "";
  let lastSpokenAt = 0;
  /** Progress is spoken when it's new, and not more often than this. */
  const say = (reply: string) => {
    const line = spokenPart(reply);
    const now = Date.now();
    if (!line || likeness(line, lastSpoken) > 0.6 || now - lastSpokenAt < SPEAK_EVERY_MS) return;
    lastSpoken = line;
    lastSpokenAt = now;
    d.say(line);
  };
  const { apps, front } = await d.apps();
  let frontApp = front;
  let capture = await d.capture();
  let planned = false;
  let opened = 0;
  let checked = false;
  let noEffect = 0;
  let lastSig = "";
  let lastPrint = fingerprint(capture.image);
  const recent: Array<{ reply: string; actions: DesktopAction[] }> = [];
  /** The last turn's session and what the user accepted, to continue it; null to start fresh. */
  let chain: { session: string; acknowledged: DoBatch["safetyChecks"]; left: number } | null = null;
  let nudged = false;

  /** Where the last turn was, and whether anything was noted there. */
  let app = d.front ? await d.front() : undefined;
  let shotInApp: ScreenCapture | null = null;
  let notedInApp = false;

  for (let turn = 1; turn <= DO_MAX_TURNS; turn++) {
    if (d.stopped()) return { status: "stopped", reply: STOPPED_REPLY };
    // Left an app without writing down what it read there: the next turn would only see the new
    // app, and go back for it. Write it down from the last look at that app, once, before going on.
    if (d.front) {
      const now = await d.front();
      if (now && app && now !== app && shotInApp && !notedInApp && d.note) {
        const note = await d
          .note({
            screenshot: { mimeType: shotInApp.mimeType, data: d.base64(shotInApp.image) },
            task,
          })
          .catch(() => null);
        if (note)
          for (let i = 0; i < note.length && i < 1080; i += 250)
            notes.push(`You noted in ${app}: ${note.slice(i, i + 250)}`);
      }
      if (now && now !== app) {
        app = now;
        notedInApp = false;
        shotInApp = null;
      }
    }
    if (d.stopped()) return { status: "stopped", reply: STOPPED_REPLY };
    for (const said of d.steer()) {
      memory.push(`The user just said: "${said}". Change what you're doing to match.`);
      checked = false;
      chain = null;
    }
    const screenshot = { mimeType: capture.mimeType, data: d.base64(capture.image) };
    // What the app says is on screen, placed on this screenshot, to land a click that just misses
    // its control. Not named to the model: on the task bench a list of controls in the prompt made
    // it fill forms worse (1 of 3 tasks against 3 of 3; docs/engineering/latency.md).
    const controls = d.controls ? onShot(await d.controls().catch(() => []), capture.geometry) : [];
    const r: DoTurnResponse = chain
      ? await d.next({
          session: chain.session,
          screenshot,
          geometry: capture.geometry,
          acknowledged: chain.acknowledged,
        })
      : await d.turn({
          screenshot,
          task,
          geometry: capture.geometry,
          apps,
          ...(frontApp ? { frontApp } : {}),
          planned,
          // Each line within the API's limit, whatever the model said.
          memory: [
            ...notes.slice(-10),
            ...memory.slice(-(MEMORY_LINES - Math.min(notes.length, 10))),
          ].map((m) => (m.length > 290 ? `${m.slice(0, 289)}…` : m)),
          turn,
        });
    const left: number = chain ? chain.left - 1 : CHAIN;
    chain = null;
    if (d.stopped()) return { status: "stopped", reply: STOPPED_REPLY };

    if (r.status === "open_app") {
      d.doing?.(`Opening ${r.app}`);
      if (++opened > 6 || !(await d.openApp(r.app)))
        return {
          status: "failed",
          reply: `I couldn't open ${r.app}. Open it yourself and I'll take it from there.`,
        };
      memory.push(`Opened ${r.app}.`);
      planned = true;
      frontApp = r.app;
      if (ONLY_OPEN(r.app).test(task.trim())) return { status: "done", reply: `Opened ${r.app}.` };
      await d.settle(SETTLE_MS);
      capture = await d.capture();
      lastPrint = fingerprint(capture.image);
      continue;
    }
    planned = true;
    if (r.status === "unavailable") return { status: "failed", reply: r.message };

    if (r.status === "done") {
      // Before calling it finished, one look at the screen with that claim in hand: models stop
      // early. If something's left, the next turn does it.
      if (!checked && turn > 1) {
        checked = true;
        memory.push(
          `You said: "${r.reply.slice(0, 120)}". Check this screen against the whole request: if any part isn't done yet, do it now; if it's all done, just say what you did.`,
        );
        continue;
      }
      return { status: "done", reply: r.reply || "Done." };
    }

    // Act.
    for (const n of notesIn(r.reply)) {
      if (!notes.includes(n)) notes.push(n);
      if (n.startsWith("You noted:")) notedInApp = true;
    }
    shotInApp = capture;
    d.doing?.(actionLabel(r.reply, r.actions));
    if (r.reply) say(r.reply);
    const ran = await d.run({
      actions: snapClicks(r.actions, controls),
      geometry: capture.geometry,
      intent: r.reply,
      safetyChecks: r.safetyChecks,
    });
    if (ran.status !== "ran")
      return ran.status === "stopped"
        ? { status: "stopped", reply: ran.message }
        : { status: "failed", reply: ran.message };
    if (left > 0) chain = { session: r.session, acknowledged: ran.acknowledged, left };
    memory.push(memoryLine(spokenPart(r.reply) || "Planned and noted.", r.actions));
    checked = false;
    recent.push({ reply: r.reply, actions: r.actions });
    // The same step again and again (a click landing just off a field, then typing into nothing):
    // the screen may change each time, but the job doesn't move.
    const again = repeats(recent);
    if (again >= REPEAT_STOP)
      return {
        status: "stuck",
        reply:
          "I've tried the same step five times and it isn't working, so I've stopped. Want to take it from here, or tell me what to try?",
      };
    if (again >= REPEAT_NUDGE) {
      chain = null;
      memory.push(
        `You've now done exactly this ${again} times and it hasn't done the job: ${memoryLine("", r.actions)}. Your click is probably landing just off its target. Aim at the very middle of the control, well inside its edges, or reach it another way: a keyboard shortcut, Tab to it, or its button.`,
      );
    }
    if (circling(recent)) {
      if (nudged)
        return {
          status: "stuck",
          reply:
            "I'm going in circles on this one, so I've stopped rather than make a mess. Want to take it from here, or tell me what to try?",
        };
      nudged = true;
      recent.length = 0;
      chain = null;
      memory.push(
        "You've spent several turns clicking around without changing anything. Stop selecting things: make the fix directly now (for example select the wrong text and type the right text, or delete it and redo it).",
      );
    }

    await d.settle(SETTLE_MS);
    const before = capture;
    capture = await d.capture();
    const print = fingerprint(capture.image);
    const sig = JSON.stringify(r.actions);
    // By the sketches when there are some (a caret blink isn't a change), else exact bytes.
    const changed = screenChanged(before.sketch, capture.sketch) ?? print !== lastPrint;
    if (!changed && sig === lastSig) {
      noEffect++;
      memory.push("That last step had no effect: the screen didn't change. Try a different way.");
      chain = null;
      if (noEffect >= STUCK_AFTER)
        return {
          status: "stuck",
          reply:
            "I'm stuck on this one. I've tried a few ways and the screen isn't changing. Want to take it from here, or tell me what to try?",
        };
    } else noEffect = 0;
    lastSig = sig;
    lastPrint = print;
  }
  return {
    status: "stuck",
    reply: "This one's taking a lot of steps, so I've paused. Want me to keep going?",
  };
}
