// Tandrix's own browser: hidden windows where background agents use websites without the user's
// screen, mouse or keyboard. Each is drawn off screen and driven with Electron's own input events,
// so the real pointer never moves and the user's typing never goes astray. They share one saved
// profile, where the user signs in to sites once (openSignIn); their own browsers are untouched.
// Actions pass the same guard as on the screen, so paying, sending or deleting still asks.
import { BrowserWindow, session, type KeyboardInputEvent, type Session } from "electron";
import type { ScreenGeometry } from "@tandrix/contracts";
import { confirm } from "./do-session";
import { runBatch, type Batch, type BatchResult } from "./do-it";
import type { DriverCommand, DriverReply } from "./input-driver";

export const PARTITION = "persist:tandrix-browser";
/** A laptop-sized page: big enough to read, small enough for the model to see well. */
const WIDTH = 1280;
const HEIGHT = 800;

interface Tab {
  win: BrowserWindow;
  /** After ⌘L: what's typed goes to the address, and Return opens it. */
  address: string | null;
  history: number[];
  stopped: boolean;
}

const tabs = new Map<number, Tab>();
let nextId = 1;
let prepared: Session | undefined;

/** The profile's rules, set once: no downloads, no camera or other permissions, no pop-ups. */
function profile(): Session {
  if (prepared) return prepared;
  const s = session.fromPartition(PARTITION);
  s.on("will-download", (e) => e.preventDefault());
  s.setPermissionRequestHandler((_wc, _perm, done) => done(false));
  prepared = s;
  return s;
}

/** An address or a search, as typed after ⌘L. */
export function addressOf(typed: string): string {
  const t = typed.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(t)) return `https://${t}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(t)}`;
}

export async function openTab(url: string): Promise<number> {
  const win = new BrowserWindow({
    show: false,
    width: WIDTH,
    height: HEIGHT,
    webPreferences: {
      session: profile(),
      offscreen: true,
      backgroundThrottling: false,
      sandbox: true,
    },
  });
  win.webContents.setFrameRate(10);
  // Links that open a new window open here instead.
  win.webContents.setWindowOpenHandler(({ url: next }) => {
    if (/^https?:/i.test(next)) void win.loadURL(next);
    return { action: "deny" };
  });
  const id = nextId++;
  tabs.set(id, { win, address: null, history: [], stopped: false });
  await win.loadURL(addressOf(url)).catch(() => undefined);
  return id;
}

export function closeTab(id: number) {
  const tab = tabs.get(id);
  tabs.delete(id);
  if (tab && !tab.win.isDestroyed()) tab.win.destroy();
}

export function stopTabs() {
  for (const tab of tabs.values()) tab.stopped = true;
}

const geometryOf = (imageWidth: number, imageHeight: number): ScreenGeometry => ({
  displayId: "tandrix-browser",
  imageWidth,
  imageHeight,
  originX: 0,
  originY: 0,
  displayWidth: WIDTH,
  displayHeight: HEIGHT,
});

export async function captureTab(id: number) {
  const tab = tabs.get(id);
  if (!tab) throw new Error("That browser tab is closed.");
  const shot = await tab.win.webContents.capturePage();
  const { width, height } = shot.getSize();
  return {
    image: new Uint8Array(shot.toJPEG(80)),
    mimeType: "image/jpeg" as const,
    geometry: geometryOf(width, height),
    capturedAt: new Date().toISOString(),
    url: tab.win.webContents.getURL(),
  };
}

type Modifier = NonNullable<KeyboardInputEvent["modifiers"]>[number];
const MODIFIERS: Record<string, Modifier> = {
  cmd: "meta",
  command: "meta",
  meta: "meta",
  super: "meta",
  ctrl: "control",
  control: "control",
  alt: "alt",
  option: "alt",
  shift: "shift",
};
const KEYS: Record<string, string> = {
  enter: "Enter",
  return: "Enter",
  tab: "Tab",
  esc: "Escape",
  escape: "Escape",
  backspace: "Backspace",
  delete: "Delete",
  space: "Space",
  up: "Up",
  arrowup: "Up",
  down: "Down",
  arrowdown: "Down",
  left: "Left",
  arrowleft: "Left",
  right: "Right",
  arrowright: "Right",
  pageup: "PageUp",
  pagedown: "PageDown",
  home: "Home",
  end: "End",
};

type Wc = BrowserWindow["webContents"];
const button = (b?: string) => (b === "right" ? "right" : b === "wheel" ? "middle" : "left");

/** One driver command, as events inside the hidden page. */
async function driveTab(tab: Tab, cmd: DriverCommand): Promise<DriverReply> {
  const wc: Wc = tab.win.webContents;
  switch (cmd.op) {
    case "move":
      wc.sendInputEvent({ type: "mouseMove", x: cmd.x, y: cmd.y });
      return { ok: true };
    case "click": {
      const b = button(cmd.button);
      const clickCount = cmd.count ?? 1;
      wc.sendInputEvent({ type: "mouseMove", x: cmd.x, y: cmd.y });
      for (let i = 1; i <= clickCount; i++) {
        wc.sendInputEvent({ type: "mouseDown", x: cmd.x, y: cmd.y, button: b, clickCount: i });
        wc.sendInputEvent({ type: "mouseUp", x: cmd.x, y: cmd.y, button: b, clickCount: i });
      }
      tab.address = null;
      return { ok: true };
    }
    case "drag": {
      const [first, ...rest] = cmd.path;
      if (!first) return { ok: true };
      wc.sendInputEvent({
        type: "mouseDown",
        x: first.x,
        y: first.y,
        button: "left",
        clickCount: 1,
      });
      for (const p of rest)
        wc.sendInputEvent({ type: "mouseMove", x: p.x, y: p.y, button: "left" });
      const end = rest.at(-1) ?? first;
      wc.sendInputEvent({ type: "mouseUp", x: end.x, y: end.y, button: "left", clickCount: 1 });
      return { ok: true };
    }
    case "scroll":
      // Electron's wheel: negative deltaY scrolls the page down.
      wc.sendInputEvent({
        type: "mouseWheel",
        x: cmd.x,
        y: cmd.y,
        deltaX: -cmd.dx,
        deltaY: -cmd.dy,
      });
      return { ok: true };
    case "type":
      if (tab.address !== null) tab.address += cmd.text;
      else wc.insertText(cmd.text);
      return { ok: true };
    case "keys":
      return keys(tab, cmd.keys);
    case "focus": {
      const secure = await wc
        .executeJavaScript(
          `(() => { const e = document.activeElement; return !!e && e.type === "password"; })()`,
        )
        .catch(() => false);
      return { ok: true, secure: secure === true };
    }
    case "front":
      return { ok: true, app: "Tandrix browser" };
    // A page has no accessibility tree to read here; its screenshot is enough.
    case "tree":
      return { ok: true, controls: [] };
  }
}

/** A key chord. The usual Mac shortcuts become what they'd do in a browser. */
async function keys(tab: Tab, chord: string[]): Promise<DriverReply> {
  const wc = tab.win.webContents;
  const lower = chord.map((k) => k.toLowerCase());
  const mods: Modifier[] = lower.flatMap((k) => (MODIFIERS[k] ? [MODIFIERS[k]] : []));
  const key = lower.find((k) => !MODIFIERS[k]) ?? "";
  const command = mods.includes("meta") || mods.includes("control");
  if (command && key === "l") {
    tab.address = "";
    return { ok: true };
  }
  if (tab.address !== null && (key === "enter" || key === "return")) {
    const to = addressOf(tab.address);
    tab.address = null;
    await wc.loadURL(to).catch(() => undefined);
    return { ok: true };
  }
  if (tab.address !== null && key === "backspace") {
    tab.address = tab.address.slice(0, -1);
    return { ok: true };
  }
  if (command) {
    const edits: Record<string, () => void> = {
      a: () => wc.selectAll(),
      c: () => wc.copy(),
      v: () => wc.paste(),
      x: () => wc.cut(),
      z: () => wc.undo(),
      r: () => wc.reload(),
      "[": () => wc.navigationHistory.goBack(),
      "]": () => wc.navigationHistory.goForward(),
    };
    const edit = edits[key];
    if (edit) {
      edit();
      return { ok: true };
    }
  }
  const keyCode = KEYS[key] ?? (key.length === 1 ? key : "");
  if (!keyCode) return { ok: false, error: `Unknown key ${key}` };
  wc.sendInputEvent({ type: "keyDown", keyCode, modifiers: mods });
  if (keyCode.length === 1 && !command)
    wc.sendInputEvent({ type: "char", keyCode, modifiers: mods });
  wc.sendInputEvent({ type: "keyUp", keyCode, modifiers: mods });
  return { ok: true };
}

/** Runs one batch of model actions in a hidden tab, through the same guard as the screen. */
export async function runInTab(id: number, batch: Batch): Promise<BatchResult> {
  const tab = tabs.get(id);
  if (!tab) return { status: "stopped", ran: 0, message: "That browser tab is closed." };
  return runBatch(batch, {
    mode: () => "do",
    drive: (cmd) => driveTab(tab, cmd),
    confirm: (prompt) => confirm(`In Tandrix's browser: ${prompt}`),
    announce: () => undefined,
    waitOrStop: (ms) =>
      new Promise((resolve) => setTimeout(() => resolve(tab.stopped), Math.min(ms, 5000))),
    stopped: () => tab.stopped,
    now: Date.now,
    history: tab.history,
  });
}

/** A visible window on the same profile, where the user signs in to sites for the agents. */
export function openSignIn(url: string) {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: "Sign in for Tandrix",
    webPreferences: { session: profile(), sandbox: true },
  });
  win.webContents.setWindowOpenHandler(({ url: next }) => {
    if (/^https?:/i.test(next)) void win.loadURL(next);
    return { action: "deny" };
  });
  void win.loadURL(addressOf(url));
}
