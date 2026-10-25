// Tandrix for Mac: a menu-bar panel plus a pointer overlay on every display.
import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  Tray,
  type IpcMainInvokeEvent,
} from "electron";
import { channels } from "../shared/bridge";
import { registerAppScheme, serveAppScheme } from "./app-protocol";
import { openScreenSettings, requestScreenAccess, screenAccess } from "./screen-access";
import { sessionStore } from "./session-store";
import { createPanel, isOwnWindow, syncOverlays, testPointer, togglePanel } from "./windows";

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
  registerIpc();
  createPanel().once("ready-to-show", () => tray && togglePanel(tray.getBounds()));
  createTray();
  syncOverlays();
  screen.on("display-added", syncOverlays);
  screen.on("display-removed", syncOverlays);
  screen.on("display-metrics-changed", syncOverlays);
});

app.on("second-instance", () => tray && togglePanel(tray.getBounds()));
// A menu-bar app keeps running with its windows hidden.
app.on("window-all-closed", () => undefined);
