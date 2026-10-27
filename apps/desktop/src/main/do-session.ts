// Do it for me in the main process: the mode (held here, Show me at every start), and running
// the batches the panel sends, with the stop signals: Esc, the hotkey, or any input from the user.
// The panel asks the API what to do; only this process decides whether and how it happens.
import type { ControlMode } from "@tandrix/contracts";
import { dialog } from "electron";
import { runBatch, type Batch, type BatchResult } from "./do-it";
import { drive, driving, stopDriver } from "./input-driver";
import { inputWatched, onUserInput, talkKeysAccess } from "./push-to-talk";
import { setPresence } from "./presence";
import { setCancelKey } from "./hotkey";
import { clearPointer, showPointer } from "./windows";

let mode: ControlMode = "show";
let active = false;
let stopRequested = false;
let history: number[] = [];

export const controlMode = () => mode;

/**
 * Switches the mode. Do it for me needs Accessibility: to post input, and to notice the user's
 * own input, which takes control back. Returns the mode now in force.
 */
export function setControlMode(next: ControlMode): ControlMode {
  if (next === "do" && !(talkKeysAccess(false) && inputWatched())) {
    talkKeysAccess(true);
    return mode;
  }
  mode = next;
  if (mode === "show") stopDoing();
  return mode;
}

/** Stops whatever Tandrix is doing; the next batch won't start. */
export function stopDoing() {
  stopRequested = true;
  clearPointer();
}

/** A task starts: the in-control pill, and Esc to stop. */
export function beginTask() {
  active = true;
  stopRequested = false;
  history = [];
  setCancelKey(stopDoing);
  setPresence({
    state: "doing",
    label: "Tandrix is in control",
    keys: "Esc",
    keysHint: "or move the mouse to stop",
  });
}

export function endTask() {
  active = false;
  setCancelKey(null);
  clearPointer();
}

export const doingTask = () => active;

const confirm = async (prompt: string) => {
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

/** Waits, or ends early (true) when the user acts or asks to stop. */
const waitOrStop = (ms: number) =>
  new Promise<boolean>((resolve) => {
    if (stopRequested) return resolve(true);
    const done = (stopped: boolean) => {
      clearTimeout(timer);
      off();
      resolve(stopped);
    };
    const timer = setTimeout(() => done(stopRequested), ms);
    const off = onUserInput(() => {
      if (!driving()) {
        stopRequested = true;
        done(true);
      }
    });
  });

/** Runs one batch from the panel. Refuses outright unless Do it for me is on and a task is open. */
export async function runDoBatch(batch: Batch): Promise<BatchResult> {
  if (mode !== "do" || !active)
    return { status: "refused", ran: 0, message: "Do it for me is off. Switch it on in Tandrix." };
  // The user's own input during a batch takes control back too.
  const off = onUserInput(() => {
    if (!driving()) stopRequested = true;
  });
  try {
    return await runBatch(batch, {
      mode: controlMode,
      drive,
      confirm,
      announce: (at, caption) => (at ? showPointer(at, caption) : clearPointer()),
      waitOrStop,
      stopped: () => stopRequested,
      now: Date.now,
      history,
    });
  } finally {
    off();
  }
}

export function shutdownDoing() {
  stopDoing();
  stopDriver();
}
