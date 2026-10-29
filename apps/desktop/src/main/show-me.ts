// Show me in the main process: the hotkey and ⌥⌘, the screenshot the question is about, and
// pointing at the answer. The panel's renderer does the listening, the API calls and the speaking,
// without showing itself: the presence bar at the top of the screen says what's happening.
import { Point, ScreenGeometry } from "@tandrix/contracts";
import { channels, type ScreenCapture } from "../shared/bridge";
import { captureDisplayUnderCursor } from "./capture";
import { captureToGlobal } from "./displays";
import { registerAskHotkey, setCancelKey } from "./hotkey";
import { setupPushToTalk } from "./push-to-talk";
import { doingTask, stopDoing } from "./do-session";
import { clearPointer, hidePanelForCapture, sendToPanel, showPointer } from "./windows";

/** A hotkey screenshot older than this is stale; the question gets a fresh one. */
const PENDING_MAX_AGE_MS = 60_000;

let listening = false;
let pending: { capture: ScreenCapture; at: number } | undefined;

/** Captures what the user is looking at now, then tells the panel to start listening. */
function beginQuestion(channel: string) {
  clearPointer();
  void captureDisplayUnderCursor()
    .then((capture) => (pending = { capture, at: Date.now() }))
    .catch(() => (pending = undefined))
    .finally(() => sendToPanel(channel));
}

export function setupShowMe(): boolean {
  setupPushToTalk({ start: () => beginQuestion(channels.talkStart), send: sendToPanel });
  return registerAskHotkey(() => {
    // While Tandrix is in control, the hotkey takes control back.
    if (doingTask()) return stopDoing();
    if (listening) return sendToPanel(channels.askHotkey);
    beginQuestion(channels.askHotkey);
  });
}

export function setListening(on: boolean) {
  listening = on;
  setCancelKey(on ? () => sendToPanel(channels.askCancel) : null);
}

export async function captureForQuestion(): Promise<ScreenCapture> {
  const ready = pending && Date.now() - pending.at < PENDING_MAX_AGE_MS ? pending.capture : null;
  pending = undefined;
  if (ready) return ready;
  clearPointer();
  await hidePanelForCapture();
  return captureDisplayUnderCursor();
}

/** Points at a pixel of a capture, on the display the capture came from. */
export function pointAtCapture(
  geometry: unknown,
  point: unknown,
  caption: unknown,
  box?: unknown,
  step?: unknown,
) {
  const g = ScreenGeometry.safeParse(geometry);
  const p = Point.safeParse(point);
  if (!g.success || !p.success || typeof caption !== "string") throw new Error("Bad request");
  const at = captureToGlobal(p.data, {
    bounds: {
      x: g.data.originX,
      y: g.data.originY,
      width: g.data.displayWidth,
      height: g.data.displayHeight,
    },
    imageWidth: g.data.imageWidth,
    imageHeight: g.data.imageHeight,
  });
  const b =
    box && typeof box === "object" && "width" in box && "height" in box
      ? {
          width: Number((box as { width: number }).width),
          height: Number((box as { height: number }).height),
        }
      : undefined;
  const s = typeof step === "number" ? step : undefined;
  showPointer(at, caption.trim() ? caption.slice(0, 280) : undefined, b, s);
}
