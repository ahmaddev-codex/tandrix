// The menu-bar panel and one transparent, click-through overlay per display.
import { join } from "node:path";
import { BrowserWindow, screen, type Rectangle } from "electron";
import { channels, type OverlayPointer, type PointAnnotation } from "../shared/bridge";
import { APP_ORIGIN } from "./app-protocol";
import { centre, toOverlay, type DisplayInfo, type Point } from "./displays";

const PANEL = { width: 400, height: 620 };
const TEST_POINTER_MS = 4000;
/** An answer's pointer stays this long, or until the next question. */
const ANSWER_POINTER_MS = 15_000;

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
    // The panel listens and speaks while it's hidden or behind other windows.
    webPreferences: { ...secure, backgroundThrottling: false },
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
export function togglePanel(anchor: Rectangle, focus = true) {
  if (!panel) return;
  if (panel.isVisible()) return panel.hide();
  const area = screen.getDisplayMatching(anchor).workArea;
  const x = Math.round(anchor.x + anchor.width / 2 - PANEL.width / 2);
  panel.setPosition(
    Math.min(Math.max(x, area.x + 8), area.x + area.width - PANEL.width - 8),
    area.y + 4,
  );
  if (focus) {
    panel.show();
    panel.focus();
  } else panel.showInactive();
}

/** Puts the panel away (before a screenshot) and reports whether it was open. */
export async function hidePanelForCapture(): Promise<boolean> {
  if (!panel?.isVisible()) return false;
  panel.hide();
  // Let the window server remove it before the screen is captured.
  await new Promise((r) => setTimeout(r, 150));
  return true;
}

/** Shows the panel under the menu-bar icon if it's hidden. */
export function showPanel(anchor: Rectangle) {
  if (!panel || panel.isVisible()) return;
  togglePanel(anchor);
}

export function sendToPanel(channel: string, ...args: unknown[]) {
  panel?.webContents.send(channel, ...args);
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
  // Never in screenshots: the model should see the user's screen, not Tandrix's pointer and pill.
  win.setContentProtection(true);
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

/** Sends to one display's overlay. */
export function sendToOverlay(displayId: number, channel: string, payload: unknown) {
  overlays.get(displayId)?.webContents.send(channel, payload);
}

/** Where a display's overlay window starts, in global points (macOS may keep it under the menu bar). */
export const overlayTop = (displayId: number) => overlays.get(displayId)?.getContentBounds().y;

/** Every display that has an overlay. */
export const overlayDisplayIds = () => [...overlays.keys()];

/**
 * Sends the pointer to a display's overlay. Points arrive relative to the display; if macOS has
 * placed the overlay window anywhere else (below the menu bar, say), they're moved by the same
 * amount, so the pointer lands where the model meant, not a menu bar's height lower.
 */
function send(displayId: number, pointer: OverlayPointer | null) {
  const win = overlays.get(displayId);
  if (!win) return;
  const display = displayInfo().find((d) => d.id === displayId);
  if (pointer && display) {
    const w = win.getContentBounds();
    pointer = {
      ...pointer,
      x: pointer.x - (w.x - display.bounds.x),
      y: pointer.y - (w.y - display.bounds.y),
    };
  }
  win.webContents.send(channels.pointer, pointer);
}

export function clearPointer() {
  clearTimeout(clearTimer);
  for (const id of overlays.keys()) send(id, null);
}

/** Draws the pointer at a global point (in points), on whichever display shows it. */
export function showPointer(at: Point, caption?: string, annotation: PointAnnotation = {}) {
  clearTimeout(clearTimer);
  const target = toOverlay(at, displayInfo());
  for (const id of overlays.keys())
    send(id, target?.displayId === id ? { ...target.point, caption, ...annotation } : null);
  // An annotation stays as long as it was asked to (longer while teaching), then it's gone.
  clearTimer = setTimeout(clearPointer, annotation.hold ?? ANSWER_POINTER_MS);
}

let workAt: Point | null = null;

/** The pointer never leaves the screen: a point past an edge sits just inside the nearest display. */
export function onScreen(p: Point): Point {
  const b = screen.getDisplayNearestPoint(p).bounds;
  const inset = 2;
  return {
    x: Math.min(Math.max(p.x, b.x + inset), b.x + b.width - inset),
    y: Math.min(Math.max(p.y, b.y + inset), b.y + b.height - inset),
  };
}
let workSeq = 0;
/**
 * Tandrix's pointer doing the work: it stays on screen for the whole task (no timer), glides to each
 * target, and shows what it's doing. "here" keeps it where it is (typing, keys).
 */
export function showWorkPointer(
  at: Point | "here",
  caption: string,
  act: NonNullable<OverlayPointer["working"]>["act"],
) {
  clearTimeout(clearTimer);
  if (at !== "here") workAt = onScreen(at);
  if (!workAt) return;
  const target = toOverlay(workAt, displayInfo());
  workSeq++;
  for (const id of overlays.keys())
    send(
      id,
      target?.displayId === id
        ? { ...target.point, caption, working: { act, seq: workSeq } }
        : null,
    );
}

/** Where Tandrix's pointer is working, if it is. */
export const workPointerAt = () => workAt;

export function clearWorkPointer() {
  workAt = null;
  clearPointer();
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
