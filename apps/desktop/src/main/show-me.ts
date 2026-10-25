// Show me in the main process: the hotkey, the screenshot the question is about, and pointing
// at the answer. The panel's renderer does the listening, the API calls and the speaking.
import { Point, ScreenGeometry } from "@tandrix/contracts";
import type { Rectangle } from "electron";
import { channels, type ScreenCapture } from "../shared/bridge";
import { captureDisplayUnderCursor } from "./capture";
import { captureToGlobal } from "./displays";
import { registerAskHotkey, setCancelKey } from "./hotkey";
import {
  clearPointer,
  hidePanelForCapture,
  sendToPanel,
  showPanelInactive,
  showPointer,
} from "./windows";

/** A hotkey screenshot older than this is stale; the question gets a fresh one. */
const PENDING_MAX_AGE_MS = 60_000;

let listening = false;
let pending: { capture: ScreenCapture; at: number } | undefined;

export function setupShowMe(trayBounds: () => Rectangle | undefined): boolean {
  return registerAskHotkey(() => {
    if (listening) return sendToPanel(channels.askHotkey);
    // Capture what the user is looking at now, before the panel appears over it.
    clearPointer();
    void captureDisplayUnderCursor()
      .then((capture) => (pending = { capture, at: Date.now() }))
      .catch(() => (pending = undefined))
      .finally(() => {
        const anchor = trayBounds();
        if (anchor) showPanelInactive(anchor);
        sendToPanel(channels.askHotkey);
      });
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
export function pointAtCapture(geometry: unknown, point: unknown, caption: unknown) {
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
  showPointer(at, caption.slice(0, 280));
}
