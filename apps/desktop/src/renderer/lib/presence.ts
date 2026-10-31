// What the presence bar at the top of the screen shows, from the panel's Show me work: only what
// Tandrix is doing right now ("Looking at your screen", "Opening Calendar"). Idle shows nothing; a
// reply stays up about as long as it takes to read, then the screen is clear again.
import type { Presence } from "../../shared/bridge";

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let current: Presence["state"] | null = null;

const send = (p: Presence | null) =>
  void window.tandrix.overlay.setPresence(p).catch(() => undefined);

export function present(p: Presence | null) {
  clearTimeout(clearTimer);
  current = p?.state ?? null;
  send(p);
}

/** A task's current action on the bar, keeping its keys ("Esc to stop"). */
export function presentAction(label: string) {
  present({ state: "doing", label: label.slice(0, 80), keys: "Esc", keysHint: "to stop" });
}

/** How long a reply stays up: enough to read it, between 4 and 15 seconds. */
export const readingMs = (text: string) =>
  Math.max(4000, Math.min(15_000, 2500 + text.split(/\s+/).length * 380));

export function presentAnswer(text: string) {
  present({ state: "answering", label: "Tandrix" });
  clearTimer = setTimeout(() => present(null), readingMs(text));
}

/** The state shown now, so work that ends without a reply can clear it. */
export const presenceState = () => current;
