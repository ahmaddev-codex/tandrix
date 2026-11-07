// The Show me hotkey. Electron's global shortcuts report presses only, never releases, so the
// hotkey is tap to start listening and tap again to ask; Esc cancels while listening. (Holding
// to talk works on the panel's mic button.)
import { globalShortcut } from "electron";

export const ASK_ACCELERATOR = "Control+Alt+Space";

export function registerAskHotkey(onPress: () => void): boolean {
  return globalShortcut.register(ASK_ACCELERATOR, onPress);
}

type CancelOwner = "listening" | "task" | "answer";
const cancels = new Map<CancelOwner, () => void>();
const pressedEsc = () => {
  for (const cancel of [...cancels.values()]) cancel();
};

/**
 * Esc is only taken while listening, answering (working out, speaking, touring) or during a task,
 * so it keeps working everywhere else. Each
 * keeps its own claim: talking during a task must not take Esc away from the task.
 */
export function setCancelKey(owner: CancelOwner, onCancel: (() => void) | null) {
  if (onCancel) cancels.set(owner, onCancel);
  else cancels.delete(owner);
  const held = globalShortcut.isRegistered("Escape");
  if (cancels.size && !held) {
    if (!globalShortcut.register("Escape", pressedEsc))
      console.warn(JSON.stringify({ event: "esc_unavailable" }));
  } else if (!cancels.size && held) globalShortcut.unregister("Escape");
}

/**
 * Tandrix pressing Esc itself, to close a dialog: macOS would hand it to our own shortcut, stopping
 * the task and never reaching the app, so the shortcut lets go until the key has been sent.
 */
export async function withEscFree<T>(press: () => Promise<T>): Promise<T> {
  if (globalShortcut.isRegistered("Escape")) globalShortcut.unregister("Escape");
  try {
    return await press();
  } finally {
    if (cancels.size) globalShortcut.register("Escape", pressedEsc);
  }
}
