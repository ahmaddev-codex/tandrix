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
  Notification,
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
  sendToPanel,
  isOwnWindow,
  showPanel,
  syncOverlays,
  testPointer,
  togglePanel,
} from "./windows";

import { speak, stopSpeaking } from "./speech";
import { setPresence } from "./presence";
import { stopPushToTalk, talkKeysAccess } from "./push-to-talk";
import {
  beginTask,
  controlMode,
  endTask,
  openTaskApp,
  runDoBatch,
  setControlMode,
  shutdownDoing,
  stopDoing,
} from "./do-session";
import { frontApp, installedApps } from "./apps";
import { finishSample, setWakeWord, startSample, stopWakeWord } from "./wake";
import { fromSetup, SETUP_PHRASES, shouldAnswer, voiceprintStore } from "./voiceprint";
import {
  AgentCall,
  ControlMode,
  DesktopAction,
  SafetyCheck,
  ScreenGeometry,
} from "@tandrix/contracts";
import { runMacTool } from "./mac-tools";
import { captureTab, closeTab, openSignIn, openTab, runInTab } from "./browser-session";
import { z } from "zod";

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
/** Checked in detail by the handler itself. */
const one = (a: unknown[]): a is [unknown] => a.length === 1;
const modeArg = (a: unknown[]): a is [ControlMode] =>
  a.length === 1 && ControlMode.safeParse(a[0]).success;
/** A batch from the panel, checked before anything runs. */
const DoBatchSchema = z.strictObject({
  actions: z.array(DesktopAction).max(16),
  geometry: ScreenGeometry,
  intent: z.string().max(600),
  safetyChecks: z.array(SafetyCheck).max(10),
});
const flag = (a: unknown[]): a is [boolean] => a.length === 1 && typeof a[0] === "boolean";
const httpsUrl = (a: unknown[]): a is [string] =>
  a.length === 1 && typeof a[0] === "string" && a[0].length < 2000 && /^https:\/\//i.test(a[0]);
const tabId = (a: unknown[]): a is [number] => a.length === 1 && Number.isInteger(a[0]);
const phraseArgs = (a: unknown[]): a is [number, "start" | "stop"] =>
  a.length === 2 &&
  Number.isInteger(a[0]) &&
  (a[0] as number) >= 0 &&
  (a[0] as number) < SETUP_PHRASES &&
  (a[1] === "start" || a[1] === "stop");

/** The user's voiceprint, on this Mac only. */
const voices = () => voiceprintStore(app.getPath("userData"));
/** Prints of the voice setup phrases recorded so far. */
let setupPrints: Array<number[] | undefined> = [];
/** Wakes are ignored until then: while a setup phrase records, and just after. */
let quietUntil = 0;
/** Checked in detail by the handler itself. */
const pointArgs = (
  a: unknown[],
): a is
  | [unknown, unknown, unknown]
  | [unknown, unknown, unknown, unknown]
  | [unknown, unknown, unknown, unknown, unknown] => a.length >= 3 && a.length <= 5;

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

function notify(title: string, body: string) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: title.slice(0, 120), body: body.slice(0, 240) });
  n.on("click", () => tray && showPanel(tray.getBounds()));
  n.show();
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
  handle(channels.pointAt, pointAtCapture, pointArgs);
  handle(channels.clearPointer, clearPointer, none);
  handle(channels.deviceName, deviceName, none);
  handle(channels.panelShow, () => tray && showPanel(tray.getBounds()), none);
  handle(channels.notify, notify, keyValue);
  handle(channels.micAccess, micAccess, none);
  handle(
    channels.micStatus,
    () =>
      process.platform === "darwin"
        ? systemPreferences.getMediaAccessStatus("microphone")
        : "granted",
    none,
  );
  handle(channels.listening, setListening, flag);
  handle(channels.speak, speak, key);
  handle(channels.setPresence, setPresence, one);
  handle(channels.controlMode, controlMode, none);
  handle(channels.setControlMode, setControlMode, modeArg);
  handle(channels.doBegin, beginTask, none);
  handle(channels.doRun, (raw) => runDoBatch(DoBatchSchema.parse(raw)), one);
  handle(channels.doEnd, endTask, none);
  handle(channels.doStop, stopDoing, none);
  handle(
    channels.wakeSet,
    (on: boolean) =>
      setWakeWord(on, {
        status: (status, message) =>
          sendToPanel(channels.wakeStatus, { status, ...(message ? { message } : {}) }),
        wake: (rest, voice) => {
          // The setup phrases say "Hey Tandrix" on purpose; they aren't wakes.
          if (Date.now() < quietUntil) return;
          if (shouldAnswer(voices().load(), voice)) sendToPanel(channels.wake, rest);
          else sendToPanel(channels.wakeIgnored);
        },
      }),
    flag,
  );
  handle(
    channels.agentTool,
    (raw: unknown) =>
      runMacTool(AgentCall.parse(raw), {
        // The panel runs browsing itself (it needs the model); this path never gets there.
        browse: async () => "Browsing runs from the panel.",
      }),
    one,
  );
  handle(channels.browserOpen, (url: string) => openTab(url), httpsUrl);
  handle(channels.browserCapture, (id: number) => captureTab(id), tabId);
  handle(
    channels.browserRun,
    (id: number, raw: unknown) => runInTab(id, DoBatchSchema.parse(raw)),
    (a: unknown[]): a is [number, unknown] => a.length === 2 && Number.isInteger(a[0]),
  );
  handle(channels.browserClose, (id: number) => closeTab(id), tabId);
  handle(channels.browserSignIn, (url: string) => openSignIn(url), httpsUrl);
  handle(
    channels.voiceprint,
    () => {
      const vp = voices().load();
      return { enrolled: vp !== null, onlyMine: vp?.onlyMine ?? false };
    },
    none,
  );
  handle(
    channels.voicePhrase,
    async (index: number, action: "start" | "stop") => {
      if (action === "start") {
        quietUntil = Infinity;
        setupPrints[index] = undefined;
        return startSample() ? { ok: true } : { ok: false, reason: "not_listening" };
      }
      const r = await finishSample();
      quietUntil = Date.now() + 2500;
      if (!r.print) return { ok: false, reason: r.reason };
      setupPrints[index] = r.print;
      return { ok: true };
    },
    phraseArgs,
  );
  handle(
    channels.voiceFinish,
    () => {
      const prints = setupPrints.slice(0, SETUP_PHRASES);
      const missing = prints.findIndex((p) => !p);
      if (prints.length < SETUP_PHRASES || missing >= 0)
        return { ok: false, redo: Math.max(missing, prints.length) };
      const made = fromSetup(prints as number[][]);
      if ("redo" in made) return { ok: false, redo: made.redo };
      voices().save({
        version: 1,
        print: made.print,
        onlyMine: true,
        createdAt: new Date().toISOString(),
      });
      setupPrints = [];
      return { ok: true };
    },
    none,
  );
  handle(
    channels.voiceOnlyMine,
    (on: boolean) => {
      const vp = voices().load();
      if (vp) voices().save({ ...vp, onlyMine: on });
    },
    flag,
  );
  handle(
    channels.voiceDelete,
    () => {
      voices().remove();
      setupPrints = [];
    },
    none,
  );
  handle(
    channels.doApps,
    async () => {
      const front = await frontApp();
      return { apps: installedApps(), ...(front ? { front } : {}) };
    },
    none,
  );
  handle(channels.doOpenApp, openTaskApp, key);
  handle(channels.talkKeysAccess, talkKeysAccess, flag);
  handle(channels.stopSpeaking, stopSpeaking, none);
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
  if (!setupShowMe()) console.warn("The Show me hotkey is taken by another app.");
  syncOverlays();
  screen.on("display-added", syncOverlays);
  screen.on("display-removed", syncOverlays);
  screen.on("display-metrics-changed", syncOverlays);
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  void stopPushToTalk();
  shutdownDoing();
  stopWakeWord();
});
app.on("second-instance", () => tray && togglePanel(tray.getBounds()));
// A menu-bar app keeps running with its windows hidden.
app.on("window-all-closed", () => undefined);
