// Tandrix for Mac: a menu-bar panel plus a pointer overlay on every display.
import { execFileSync } from "node:child_process";
import os from "node:os";
import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  systemPreferences,
  Tray,
  type IpcMainInvokeEvent,
} from "electron";
import { channels } from "../shared/bridge";
import { registerAppScheme, serveAppScheme } from "./app-protocol";
import { openScreenSettings, requestScreenAccess, screenAccess } from "./screen-access";
import { sessionStore } from "./session-store";
import { captureForQuestion, pointAtCapture, setListening, setupShowMe } from "./show-me";
import {
  clearPointer,
  createPanel,
  isOwnWindow,
  showPanel,
  syncOverlays,
  testPointer,
  togglePanel,
} from "./windows";

let tray: Tray | undefined;

function handle<A extends unknown[], R>(
  channel: string,
  fn: (...args: A) => R | Promise<R>,
  valid: (args: unknown[]) => args is A,
) {
  ipcMain.handle(channel, (e: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!isOwnWindow(BrowserWindow.fromWebContents(e.sender))) throw new Error("Not allowed");
    if (!valid(args)) throw new Error("Bad request");
    return fn(...args);
  });
}

const none = (a: unknown[]): a is [] => a.length === 0;
const key = (a: unknown[]): a is [string] => a.length === 1 && typeof a[0] === "string";
const keyValue = (a: unknown[]): a is [string, string] =>
  a.length === 2 && typeof a[0] === "string" && typeof a[1] === "string";
const flag = (a: unknown[]): a is [boolean] => a.length === 1 && typeof a[0] === "boolean";
/** Checked in detail by the handler itself. */
const three = (a: unknown[]): a is [unknown, unknown, unknown] => a.length === 3;

/** The name set in System Settings > General > About, else the host name tidied up. */
function deviceName(): string {
  let name = "";
  if (process.platform === "darwin") {
    try {
      name = execFileSync("scutil", ["--get", "ComputerName"], { encoding: "utf8" }).trim();
    } catch {
      // Fall back to the host name below.
    }
  }
  name ||= os
    .hostname()
    .replace(/\.local$/, "")
    .replace(/-/g, " ");
  return name.trim().slice(0, 80) || "Mac";
}

async function micAccess(): Promise<boolean> {
  if (process.platform !== "darwin") return true;
  if (systemPreferences.getMediaAccessStatus("microphone") === "granted") return true;
  return systemPreferences.askForMediaAccess("microphone");
}

/** Pages may use the microphone (never the camera or anything else), and only our own pages. */
function limitPermissions() {
  const own = (wc: Electron.WebContents | null) =>
    isOwnWindow(wc && BrowserWindow.fromWebContents(wc));
  session.defaultSession.setPermissionRequestHandler((wc, permission, done, details) => {
    const media = "mediaTypes" in details ? (details.mediaTypes ?? []) : [];
    done(
      permission === "media" && own(wc) && media.length > 0 && media.every((m) => m === "audio"),
    );
  });
  session.defaultSession.setPermissionCheckHandler(
    (wc, permission, _origin, details) =>
      permission === "media" && own(wc) && details.mediaType === "audio",
  );
}

function registerIpc() {
  handle(channels.storageGet, sessionStore.getItem, key);
  handle(channels.storageSet, sessionStore.setItem, keyValue);
  handle(channels.storageRemove, sessionStore.removeItem, key);
  handle(channels.screenAccess, screenAccess, none);
  handle(
    channels.screenSettings,
    async () => {
      if (screenAccess() === "not-determined") await requestScreenAccess();
      else await openScreenSettings();
    },
    none,
  );
  handle(channels.testPointer, testPointer, none);
  handle(channels.screenCapture, captureForQuestion, none);
  handle(channels.pointAt, pointAtCapture, three);
  handle(channels.clearPointer, clearPointer, none);
  handle(channels.deviceName, deviceName, none);
  handle(channels.panelShow, () => tray && showPanel(tray.getBounds()), none);
  handle(channels.micAccess, micAccess, none);
  handle(channels.listening, setListening, flag);
}

function createTray() {
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle("Tandrix");
  tray.setToolTip("Tandrix");
  const menu = Menu.buildFromTemplate([{ label: "Quit Tandrix", role: "quit" }]);
  tray.on("click", () => tray && togglePanel(tray.getBounds()));
  tray.on("right-click", () => tray?.popUpContextMenu(menu));
}

if (!app.requestSingleInstanceLock()) app.quit();
registerAppScheme();

// No window may open new windows or navigate away from the app's own pages.
app.on("web-contents-created", (_e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (e) => e.preventDefault());
});

void app.whenReady().then(() => {
  app.dock?.hide();
  serveAppScheme();
  limitPermissions();
  registerIpc();
  createPanel().once("ready-to-show", () => tray && togglePanel(tray.getBounds()));
  createTray();
  if (!setupShowMe(() => tray?.getBounds()))
    console.warn("The Show me hotkey is taken by another app.");
  syncOverlays();
  screen.on("display-added", syncOverlays);
  screen.on("display-removed", syncOverlays);
  screen.on("display-metrics-changed", syncOverlays);
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("second-instance", () => tray && togglePanel(tray.getBounds()));
// A menu-bar app keeps running with its windows hidden.
app.on("window-all-closed", () => undefined);
