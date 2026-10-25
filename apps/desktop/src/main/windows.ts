// The menu-bar panel and one transparent, click-through overlay per display.
import { join } from "node:path";
import { BrowserWindow, screen, type Rectangle } from "electron";
import { channels, type OverlayPointer } from "../shared/bridge";
import { APP_ORIGIN } from "./app-protocol";
import { centre, toOverlay, type DisplayInfo, type Point } from "./displays";

const PANEL = { width: 400, height: 620 };
const TEST_POINTER_MS = 4000;

const overlays = new Map<number, BrowserWindow>();
let panel: BrowserWindow | undefined;
let clearTimer: NodeJS.Timeout | undefined;

const secure = {
  preload: join(__dirname, "../preload/index.cjs"),
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  spellcheck: false,
};

function load(win: BrowserWindow, page: "panel" | "overlay") {
  const dev = process.env.TANDRIX_RENDERER_URL;
  void win.loadURL(`${dev ?? APP_ORIGIN}/${page}.html`);
}

/** True for messages from this app's own windows. */
export function isOwnWindow(win: BrowserWindow | null): boolean {
  return !!win && (win === panel || [...overlays.values()].includes(win));
}

export function createPanel(): BrowserWindow {
  panel = new BrowserWindow({
    ...PANEL,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    webPreferences: secure,
  });
  panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Behaves like a menu-bar menu: clicking anywhere else puts it away.
  panel.on("blur", () => {
    if (!panel?.webContents.isDevToolsOpened()) panel?.hide();
  });
  load(panel, "panel");
  return panel;
}

/** Opens the panel under the menu-bar icon, or closes it if it's open. */
export function togglePanel(anchor: Rectangle) {
  if (!panel) return;
  if (panel.isVisible()) return panel.hide();
  const area = screen.getDisplayMatching(anchor).workArea;
  const x = Math.round(anchor.x + anchor.width / 2 - PANEL.width / 2);
  panel.setPosition(
    Math.min(Math.max(x, area.x + 8), area.x + area.width - PANEL.width - 8),
    area.y + 4,
  );
  panel.show();
  panel.focus();
}

const displayInfo = (): DisplayInfo[] =>
  screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, scaleFactor: d.scaleFactor }));

function createOverlay(d: DisplayInfo): BrowserWindow {
  const win = new BrowserWindow({
    ...d.bounds,
    show: false,
    transparent: true,
    frame: false,
    hasShadow: false,
    focusable: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    enableLargerThanScreen: true,
    webPreferences: secure,
  });
  win.setIgnoreMouseEvents(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // macOS keeps new windows below the menu bar; place it again once it exists.
  win.setBounds(d.bounds);
  win.once("ready-to-show", () => win.showInactive());
  load(win, "overlay");
  return win;
}

/** One overlay per connected display; call again whenever displays change. */
export function syncOverlays() {
  const current = displayInfo();
  for (const [id, win] of overlays) {
    const d = current.find((c) => c.id === id);
    if (!d) {
      win.destroy();
      overlays.delete(id);
    } else win.setBounds(d.bounds);
  }
  for (const d of current) if (!overlays.has(d.id)) overlays.set(d.id, createOverlay(d));
}

function send(displayId: number, pointer: OverlayPointer | null) {
  overlays.get(displayId)?.webContents.send(channels.pointer, pointer);
}

export function clearPointer() {
  clearTimeout(clearTimer);
  for (const id of overlays.keys()) send(id, null);
}

/** Draws the pointer at a global point (in points), on whichever display shows it. */
export function showPointer(at: Point, caption?: string) {
  clearTimeout(clearTimer);
  const target = toOverlay(at, displayInfo());
  for (const id of overlays.keys())
    send(id, target?.displayId === id ? { ...target.point, caption } : null);
}

/** The pointer at the centre of every display, so the user can see each overlay works. */
export function testPointer() {
  const displays = displayInfo();
  displays.forEach((d, i) => {
    const local = toOverlay(centre(d.bounds), [d]);
    if (local)
      send(d.id, {
        ...local.point,
        caption:
          displays.length > 1
            ? `Tandrix can point here: screen ${i + 1} of ${displays.length}`
            : "Tandrix can point here",
      });
  });
  clearTimeout(clearTimer);
  clearTimer = setTimeout(clearPointer, TEST_POINTER_MS);
}
