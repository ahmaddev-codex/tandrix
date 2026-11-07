// Show me in the main process: the hotkey and ⌥⌘, the screenshot the question is about, and
// pointing at the answer. The panel's renderer does the listening, the API calls and the speaking,
// without showing itself: the presence bar at the top of the screen says what's happening.
import { Point, ScreenGeometry } from "@tandrix/contracts";
import {
  channels,
  type AnnotatedRegion,
  type PointAnnotation,
  type ScreenCapture,
} from "../shared/bridge";
import { captureDisplayAt, captureDisplayUnderCursor } from "./capture";
import { captureToGlobal } from "./displays";
import { registerAskHotkey, setCancelKey } from "./hotkey";
import { setupPushToTalk } from "./push-to-talk";
import { doingTask, stopDoing, taskPoint } from "./do-session";
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

/** Tandrix is answering: Esc stops it, for as long as it is (and no longer). */
export function setAnswering(on: boolean) {
  setCancelKey("answer", on ? () => sendToPanel(channels.answerStop) : null);
}

export function setListening(on: boolean) {
  listening = on;
  setCancelKey("listening", on ? () => sendToPanel(channels.askCancel) : null);
}

export async function captureForQuestion(): Promise<ScreenCapture> {
  // A task's own screenshots: its display, whatever the user's mouse is doing, and its pointer
  // stays up (the overlay never shows in screenshots).
  if (doingTask()) {
    await hidePanelForCapture();
    return captureDisplayAt(taskPoint());
  }
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
  annotation?: unknown,
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
  showPointer(at, caption.trim() ? caption.slice(0, 280) : undefined, cleanAnnotation(annotation));
}

const finite = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
const words = (v: unknown, max: number) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

/** What the panel asked the pointer to carry, checked: sizes on screen, short text, a sane hold. */
export function cleanAnnotation(raw: unknown): PointAnnotation {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const box = r.box as Record<string, unknown> | undefined;
  const width = finite(box?.width, 8, 8000);
  const height = finite(box?.height, 8, 8000);
  const out: PointAnnotation = {};
  if (width !== undefined && height !== undefined) out.box = { width, height };
  const label = words(r.label, 60);
  const note = words(r.note, 600);
  const hold = finite(r.hold, 2000, 60_000);
  const step = finite(r.step, 1, 99);
  if (label) out.label = label;
  if (note) out.note = note;
  if (hold !== undefined) out.hold = hold;
  if (step !== undefined) out.step = Math.round(step);
  if (Array.isArray(r.regions)) {
    const regions = r.regions.slice(0, 6).flatMap((g): AnnotatedRegion[] => {
      if (!g || typeof g !== "object") return [];
      const v = g as Record<string, unknown>;
      const dx = finite(v.dx, -8000, 8000);
      const dy = finite(v.dy, -8000, 8000);
      const w = finite(v.width, 8, 8000);
      const h = finite(v.height, 8, 8000);
      const name = words(v.label, 60);
      if (dx === undefined || dy === undefined || w === undefined || h === undefined || !name)
        return [];
      const detail = words(v.detail, 160);
      const ax = finite(v.ax, -8000, 8000);
      const ay = finite(v.ay, -8000, 8000);
      // The strokes: at most 8, each at most 400 points, every number finite and on a screen.
      const m = v.mark as { kind?: unknown; strokes?: unknown } | undefined;
      const kind = words(m?.kind, 20);
      const strokes = Array.isArray(m?.strokes)
        ? (m.strokes as unknown[])
            .slice(0, 8)
            .filter((st): st is number[] => Array.isArray(st))
            .map((st) => st.slice(0, 800).map((n) => finite(n, -8000, 8000) ?? 0))
            .filter((st) => st.length >= 2 && st.length % 2 === 0)
        : [];
      return [
        {
          dx,
          dy,
          width: w,
          height: h,
          label: name,
          ...(detail ? { detail } : {}),
          ...(ax !== undefined && ay !== undefined ? { ax, ay } : {}),
          ...(kind ? { mark: { kind, strokes } } : {}),
        },
      ];
    });
    if (regions.length) out.regions = regions;
  }
  return out;
}
