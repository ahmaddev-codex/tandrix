// The presence bar: what Tandrix is doing, shown at the top of the display the user is working on
// (the one under the cursor when a question starts) and nowhere else. The panel says what to show;
// this keeps it on one display for the whole question and clears it when Tandrix is idle.
import { screen } from "electron";
import { channels, type OverlayPresence, type Presence } from "../shared/bridge";
import { overlayDisplayIds, sendToOverlay } from "./windows";

let displayId: number | undefined;

const states = new Set(["listening", "thinking", "looking", "answering", "doing"]);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);

/** Checks what the renderer sent: a presence, or null to hide it. */
export function parsePresence(v: unknown): Presence | null | undefined {
  if (v === null) return null;
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.state !== "string" || !states.has(o.state) || typeof o.label !== "string")
    return undefined;
  const level = typeof o.level === "number" && Number.isFinite(o.level) ? o.level : undefined;
  const p: Presence = { state: o.state as Presence["state"], label: o.label.slice(0, 80) };
  for (const [k, max] of [
    ["keys", 12],
    ["keysHint", 40],
    ["text", 600],
  ] as const) {
    const t = text(o[k], max);
    if (t) p[k] = t;
  }
  if (level !== undefined) p.level = Math.max(0, Math.min(1, level));
  return p;
}

export function setPresence(raw: unknown) {
  const p = parsePresence(raw);
  if (p === undefined) throw new Error("Bad request");
  if (!p) {
    for (const id of overlayDisplayIds()) sendToOverlay(id, channels.presence, null);
    displayId = undefined;
    return;
  }
  const d =
    (displayId !== undefined && screen.getAllDisplays().find((x) => x.id === displayId)) ||
    screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  displayId = d.id;
  // Below the menu bar, and the notch on Macs that have one.
  const shown: OverlayPresence = { ...p, top: Math.max(0, d.workArea.y - d.bounds.y) };
  for (const id of overlayDisplayIds())
    sendToOverlay(id, channels.presence, id === d.id ? shown : null);
}
