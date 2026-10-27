// Hold ⌥⌘ to talk, let go to ask, in any app (talk-keys.ts has the rules). macOS lets an app
// notice keys in other apps only once the user allows it in Privacy & Security > Accessibility;
// until then the ⌃⌥Space hotkey and the panel's mic still work. Only Option, Command and "another
// key" are looked at; which keys the user types is never read or kept.
import { systemPreferences } from "electron";
import { channels } from "../shared/bridge";
import { talkKeys, type TalkKey } from "./talk-keys";

// uiohook key codes: Option (left, right) and Command (left, right).
const OPTION = new Set([56, 3640]);
const COMMAND = new Set([3675, 3676]);
const kind = (keycode: number): TalkKey =>
  OPTION.has(keycode) ? "option" : COMMAND.has(keycode) ? "command" : "other";

let started = false;

/** Whether Tandrix may notice ⌥⌘ in other apps; `ask` shows macOS's prompt. */
export function talkKeysAccess(ask: boolean): boolean {
  if (process.platform !== "darwin") return true;
  return systemPreferences.isTrustedAccessibilityClient(ask);
}

/**
 * Starts listening for ⌥⌘ once access is granted, checking again every few seconds until it is
 * (granting it doesn't need a restart).
 */
export function setupPushToTalk(on: { start(): void; send(channel: string): void }) {
  const keys = talkKeys({
    start: on.start,
    end: () => on.send(channels.talkEnd),
    cancel: () => on.send(channels.askCancel),
  });
  const tryStart = async () => {
    if (started || !talkKeysAccess(false)) return false;
    const { uIOhook } = await import("uiohook-napi");
    uIOhook.on("keydown", (e) => keys.down(kind(e.keycode)));
    uIOhook.on("keyup", (e) => keys.up(kind(e.keycode)));
    uIOhook.start();
    started = true;
    return true;
  };
  // Without the native hook (an unsupported Mac), ⌃⌥Space and the panel's mic still work.
  const attempt = () =>
    tryStart().catch((e: Error) => {
      console.warn(`Hold-to-talk unavailable: ${e.message}`);
      return true;
    });
  void attempt().then((ok) => {
    if (ok) return;
    const timer = setInterval(() => {
      void attempt().then((done) => done && clearInterval(timer));
    }, 3000);
  });
}

export async function stopPushToTalk() {
  if (!started) return;
  const { uIOhook } = await import("uiohook-napi");
  uIOhook.stop();
  started = false;
}
