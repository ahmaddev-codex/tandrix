// macOS Screen Recording permission. The OS asks the first time the app captures the screen;
// after a refusal the only way back is System Settings, and the app must be reopened.
import { desktopCapturer, shell, systemPreferences } from "electron";
import type { ScreenAccess } from "../shared/bridge";

const settingsUrl = "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture";

export function screenAccess(): ScreenAccess {
  if (process.platform !== "darwin") return "granted";
  return systemPreferences.getMediaAccessStatus("screen");
}

/** Asks macOS for access by trying a capture, which shows the system prompt the first time. */
export async function requestScreenAccess(): Promise<void> {
  if (screenAccess() !== "not-determined") return;
  await desktopCapturer
    .getSources({ types: ["screen"], thumbnailSize: { width: 1, height: 1 } })
    .catch(() => undefined);
}

export async function openScreenSettings(): Promise<void> {
  await shell.openExternal(settingsUrl);
}
