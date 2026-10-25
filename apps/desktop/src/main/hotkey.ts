// The Show me hotkey. Electron's global shortcuts report presses only, never releases, so the
// hotkey is tap to start listening and tap again to ask; Esc cancels while listening. (Holding
// to talk works on the panel's mic button.)
import { globalShortcut } from "electron";

export const ASK_ACCELERATOR = "Control+Alt+Space";

export function registerAskHotkey(onPress: () => void): boolean {
  return globalShortcut.register(ASK_ACCELERATOR, onPress);
}

/** Esc is only taken while listening, so it keeps working everywhere else. */
export function setCancelKey(onCancel: (() => void) | null) {
  if (onCancel) {
    if (!globalShortcut.isRegistered("Escape")) globalShortcut.register("Escape", onCancel);
  } else if (globalShortcut.isRegistered("Escape")) globalShortcut.unregister("Escape");
}
