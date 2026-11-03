// Do it for me in the main process: the mode (held here, Show me at every start), and running
// the batches the panel sends, with the stop signals: Esc or the hotkey. The user's own mouse and
// keys don't stop a task, so a nudge of the trackpad doesn't throw the work away.
// The panel asks the API what to do; only this process decides whether and how it happens.
import type { ControlMode } from "@tandrix/contracts";
import { dialog, screen } from "electron";
import { runBatch, type Batch, type BatchResult } from "./do-it";
import { drive, stopDriver } from "./input-driver";
import { talkKeysAccess } from "./push-to-talk";
import { setPresence } from "./presence";
import { setCancelKey, withEscFree } from "./hotkey";
import { clearWorkPointer, sendToPanel, showWorkPointer, workPointerAt } from "./windows";
import { openApp } from "./apps";
import { channels } from "../shared/bridge";

const IN_CONTROL = {
  state: "doing",
  label: "Tandrix is in control",
  keys: "Esc",
  keysHint: "to stop",
} as const;

/** Opens an installed app for the task in progress, saying so at the top of the screen. */
export async function openTaskApp(name: string): Promise<boolean> {
  if (mode !== "do" || !active || stopRequested) return false;
  setPresence({ ...IN_CONTROL, label: `Opening ${name.slice(0, 60)}` });
  try {
    return await openApp(name);
  } finally {
    setPresence(IN_CONTROL);
  }
}

let mode: ControlMode = "show";
let active = false;
let stopRequested = false;
let history: number[] = [];
/** Where the task began (the cursor then), until Tandrix's pointer has somewhere to be. */
let startedAt: { x: number; y: number } | null = null;

/** The point whose display the task works on: its pointer, or where it began. */
export const taskPoint = () => workPointerAt() ?? startedAt ?? screen.getCursorScreenPoint();

export const controlMode = () => mode;

/** Switches the mode. Do it for me needs Accessibility, to post input. Returns the mode in force. */
export function setControlMode(next: ControlMode): ControlMode {
  if (next === "do" && !talkKeysAccess(false)) {
    talkKeysAccess(true);
    return mode;
  }
  mode = next;
  if (mode === "show") stopDoing();
  return mode;
}

/** Stops whatever Tandrix is doing, and tells the panel at once so the task ends now. */
export function stopDoing() {
  const running = active && !stopRequested;
  stopRequested = true;
  clearWorkPointer();
  if (running) sendToPanel(channels.doStopped);
}

/** A task starts: the in-control pill, and Esc to stop. */
export function beginTask() {
  active = true;
  stopRequested = false;
  history = [];
  startedAt = screen.getCursorScreenPoint();
  setCancelKey("task", stopDoing);
  setPresence(IN_CONTROL);
}

export function endTask() {
  active = false;
  setCancelKey("task", null);
  clearWorkPointer();
}

export const doingTask = () => active;

export const confirm = async (prompt: string) => {
  const r = await dialog.showMessageBox({
    type: "question",
    message: prompt,
    detail: "Tandrix is doing this for you. Allow this step, or stop and take control back.",
    buttons: ["Allow", "Stop"],
    defaultId: 1,
    cancelId: 1,
  });
  return r.response === 0;
};

/** How often a wait looks for Esc or the hotkey. */
const STOP_POLL_MS = 50;

/** Waits, or ends early (true) when the user presses Esc or the hotkey. */
const waitOrStop = (ms: number) =>
  new Promise<boolean>((resolve) => {
    if (stopRequested) return resolve(true);
    const started = Date.now();
    const timer = setInterval(() => {
      if (stopRequested || Date.now() - started >= ms) {
        clearInterval(timer);
        resolve(stopRequested);
      }
    }, STOP_POLL_MS);
  });

/** Runs one batch from the panel. Refuses outright unless Do it for me is on and a task is open. */
export async function runDoBatch(batch: Batch): Promise<BatchResult> {
  if (mode !== "do" || !active)
    return { status: "refused", ran: 0, message: "Do it for me is off. Switch it on in Tandrix." };
  const result = await runBatch(batch, {
    mode: controlMode,
    drive: (cmd) =>
      cmd.op === "keys" && cmd.keys.some((k) => /^esc/i.test(k))
        ? withEscFree(() => drive(cmd))
        : drive(cmd),
    confirm,
    announce: (at, caption, act) =>
      at ? showWorkPointer(at, caption ?? "", act ?? "move") : clearWorkPointer(),
    waitOrStop,
    stopped: () => stopRequested,
    now: Date.now,
    history,
  });
  // Status and counts only: never the screen, the text typed or the model's words.
  console.log(
    JSON.stringify({
      event: "do_batch",
      status: result.status,
      ran: result.ran,
      of: batch.actions.length,
      ...(result.status !== "ran" ? { message: result.message } : {}),
    }),
  );
  return result;
}

export function shutdownDoing() {
  stopDoing();
  stopDriver();
}
