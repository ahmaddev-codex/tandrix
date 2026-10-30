// One task on the screen, seen through to the end. Each turn is a fresh, fast model call with the
// current screenshot and a running memory of what's been done (sending the whole history every
// turn made each turn slower than the last). It never redoes what the memory says is done,
// notices when a step had no effect and tries another way, double-checks the screen before saying
// it's finished, takes corrections said mid-task, and keeps going until the job is done, the user
// stops it, or it's truly stuck and says so.
import { DO_MAX_TURNS, type DesktopAction, type DoTurnResponse } from "@tandrix/contracts";
import type { DoBatch, DoBatchResult, ScreenCapture } from "../../shared/bridge";

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
  }) => Promise<DoTurnResponse>;
  /** Continues the same model conversation (it remembers its own last few steps). */
  next: (req: {
    session: string;
    screenshot: { mimeType: ScreenCapture["mimeType"]; data: string };
    geometry: ScreenCapture["geometry"];
    acknowledged: DoBatch["safetyChecks"];
  }) => Promise<DoTurnResponse>;
  run: (batch: DoBatch) => Promise<DoBatchResult>;
  /** Says a progress line aloud and shows it at the top of the screen. */
  say: (line: string) => void;
  /** Corrections the user said since the last turn ("no, Thursday the 13th"). */
  steer: () => string[];
  stopped: () => boolean;
  settle: (ms: number) => Promise<void>;
  base64: (bytes: Uint8Array) => string;
}

export type ScreenTaskResult =
  | { status: "done"; reply: string }
  | { status: "stopped"; reply: string }
  | { status: "stuck"; reply: string }
  | { status: "failed"; reply: string };

/** How long the screen gets to settle after a batch before the next screenshot. */
const SETTLE_MS = 300;
/** In a row, steps that changed nothing, before Tandrix stops and asks. */
const STUCK_AFTER = 3;
/** The model sees this much recent memory each turn. */
const MEMORY_LINES = 30;
/**
 * Turns continued in the same model conversation before starting fresh with the memory: enough for
 * the model to remember what it just did, few enough that turns don't slow down as screenshots pile
 * up.
 */
const CHAIN = 1;
/** Turns of only clicking and near-identical narration before Tandrix calls it going in circles. */
const CIRCLE_TURNS = 5;

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

const PROGRESS = [
  "Still on it.",
  "Making progress.",
  "Getting there.",
  "A few more steps.",
  "Nearly there, I think.",
];

export async function runScreenTask(task: string, d: ScreenTaskDeps): Promise<ScreenTaskResult> {
  const memory: string[] = [];
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

  for (let turn = 1; turn <= DO_MAX_TURNS; turn++) {
    if (d.stopped()) return { status: "stopped", reply: "Stopped. You have control back." };
    for (const said of d.steer()) {
      memory.push(`The user just said: "${said}". Change what you're doing to match.`);
      checked = false;
      chain = null;
    }
    const screenshot = { mimeType: capture.mimeType, data: d.base64(capture.image) };
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
          memory: memory
            .slice(-MEMORY_LINES)
            .map((m) => (m.length > 290 ? `${m.slice(0, 289)}…` : m)),
          turn,
        });
    const left: number = chain ? chain.left - 1 : CHAIN;
    chain = null;
    if (d.stopped()) return { status: "stopped", reply: "Stopped. You have control back." };

    if (r.status === "open_app") {
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
    if (r.reply) d.say(r.reply);
    const ran = await d.run({
      actions: r.actions,
      geometry: capture.geometry,
      intent: r.reply,
      safetyChecks: r.safetyChecks,
    });
    if (ran.status !== "ran")
      return ran.status === "stopped"
        ? { status: "stopped", reply: ran.message }
        : { status: "failed", reply: ran.message };
    if (left > 0) chain = { session: r.session, acknowledged: ran.acknowledged, left };
    memory.push(memoryLine(r.reply, r.actions));
    checked = false;
    recent.push({ reply: r.reply, actions: r.actions });
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
    capture = await d.capture();
    const print = fingerprint(capture.image);
    const sig = JSON.stringify(r.actions);
    if (print === lastPrint && sig === lastSig) {
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
    if (turn % 12 === 0) d.say(PROGRESS[(turn / 12) % PROGRESS.length]!);
  }
  return {
    status: "stuck",
    reply: "This one's taking a lot of steps, so I've paused. Want me to keep going?",
  };
}
