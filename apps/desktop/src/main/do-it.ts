// Running one batch of model-proposed actions for Do it for me, in the main process. Each action:
// mapped from screenshot pixels to the display, checked by the action guard (@tandrix/core),
// confirmed by the user in a native alert when the guard or the model asks, announced with the
// pointer for about a second, then run. Any input from the user, Esc or the hotkey stops it.
import { guardAction, type GuardDecision } from "@tandrix/core";
import type { ControlMode, DesktopAction, SafetyCheck, ScreenGeometry } from "@tandrix/contracts";

type Point = { x: number; y: number };
import type { DriverCommand, DriverReply } from "./input-driver";

/** How long the pointer shows what's next before it happens: the user's window to stop it. */
export const ANNOUNCE_MS = 1000;

export type BatchResult =
  | { status: "ran"; ran: number; acknowledged: SafetyCheck[] }
  /** The user took control back, or said no. */
  | { status: "stopped"; ran: number; message: string }
  /** The guard refused an action; the task stops there. */
  | { status: "refused"; ran: number; message: string };

export interface BatchDeps {
  mode: () => ControlMode;
  drive: (cmd: DriverCommand) => Promise<DriverReply>;
  /** Asks the user (a native alert); true to allow. */
  confirm: (prompt: string) => Promise<boolean>;
  /** Shows the pointer at a global point with a caption, or clears it. */
  announce: (at: Point | null, caption?: string) => void;
  /** Resolves after `ms`, or early (true) when the user takes control back. */
  waitOrStop: (ms: number) => Promise<boolean>;
  stopped: () => boolean;
  now: () => number;
  /** Times of actions already run for this task. */
  history: number[];
}

export interface Batch {
  actions: DesktopAction[];
  geometry: ScreenGeometry;
  /** What the model said this turn, for the guard's sensitive check. */
  intent: string;
  safetyChecks: SafetyCheck[];
}

const toGlobal = (p: Point, g: ScreenGeometry): Point => ({
  x: g.originX + (p.x * g.displayWidth) / g.imageWidth,
  y: g.originY + (p.y * g.displayHeight) / g.imageHeight,
});

/** What the pointer says before an action. */
export function caption(a: DesktopAction): string {
  switch (a.type) {
    case "click":
      return a.button === "right" ? "Right-clicking here" : "Clicking here";
    case "double_click":
      return "Double-clicking here";
    case "drag":
      return "Dragging";
    case "scroll":
      return "Scrolling";
    case "type":
      return `Typing "${a.text.length > 30 ? `${a.text.slice(0, 30)}…` : a.text}"`;
    case "keypress":
      return `Pressing ${a.keys.join("+")}`;
    case "move":
      return "Moving here";
    case "screenshot":
    case "wait":
      return "Looking";
  }
}

function command(a: DesktopAction, g: ScreenGeometry): DriverCommand | null {
  switch (a.type) {
    case "click": {
      const p = toGlobal(a, g);
      return { op: "click", ...p, button: a.button, count: 1 };
    }
    case "double_click":
      return { op: "click", ...toGlobal(a, g), count: 2 };
    case "move":
      return { op: "move", ...toGlobal(a, g) };
    case "drag":
      return { op: "drag", path: a.path.map((p) => toGlobal(p, g)) };
    case "scroll": {
      // Scroll distances are screenshot pixels too.
      const k = g.displayWidth / g.imageWidth;
      return {
        op: "scroll",
        ...toGlobal(a, g),
        dx: Math.round(a.scroll_x * k),
        dy: Math.round(a.scroll_y * k),
      };
    }
    case "type":
      return { op: "type", text: a.text };
    case "keypress":
      return { op: "keys", keys: a.keys };
    case "screenshot":
    case "wait":
      return null;
  }
}

const where = (a: DesktopAction, g: ScreenGeometry): Point | null =>
  "x" in a && "y" in a ? toGlobal(a, g) : a.type === "drag" ? toGlobal(a.path[0]!, g) : null;

export async function runBatch(b: Batch, d: BatchDeps): Promise<BatchResult> {
  let ran = 0;
  const stop = (message: string): BatchResult => {
    d.announce(null);
    return { status: "stopped", ran, message };
  };

  // The model's own checks first: the user accepts them or the task stops.
  for (const check of b.safetyChecks) {
    if (!(await d.confirm(check.message || "Tandrix wants to do something that needs your OK.")))
      return stop("Stopped. You said no, so nothing more was done.");
  }

  for (const action of b.actions) {
    if (d.stopped()) return stop("Stopped. You have control back.");
    if (action.type === "wait") {
      if (await d.waitOrStop(Math.min(action.ms ?? 1000, 5000)))
        return stop("Stopped. You have control back.");
      continue;
    }
    const secure =
      action.type === "type" ? (await d.drive({ op: "focus" })).secure === true : false;
    const decision: GuardDecision = guardAction(action, {
      mode: d.mode(),
      intent: b.intent,
      focusedFieldIsSecure: secure,
      actionsThisRequest: d.history.length,
      recentActionTimes: d.history,
      now: d.now(),
    });
    if (decision.decision === "deny") {
      if (decision.code === "rate_limit") {
        if (await d.waitOrStop(400)) return stop("Stopped. You have control back.");
      } else {
        d.announce(null);
        return { status: "refused", ran, message: decision.message };
      }
    }
    if (decision.decision === "confirm" && !(await d.confirm(decision.prompt)))
      return stop("Stopped. You said no, so nothing more was done.");

    const cmd = command(action, b.geometry);
    if (!cmd) continue;
    // Show what's next, and give the user a moment to stop it.
    d.announce(where(action, b.geometry), caption(action));
    if (await d.waitOrStop(ANNOUNCE_MS)) return stop("Stopped. You have control back.");
    const r = await d.drive(cmd);
    d.history.push(d.now());
    if (!r.ok) {
      d.announce(null);
      return {
        status: "refused",
        ran,
        message: "Tandrix couldn't do that step. You have control back.",
      };
    }
    ran++;
  }
  d.announce(null);
  return { status: "ran", ran, acknowledged: b.safetyChecks };
}
