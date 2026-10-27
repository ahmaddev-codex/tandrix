// What the presence bar at the top of the screen shows, from the panel's Show me work. Idle shows
// nothing; a reply stays up about as long as it takes to read, then the screen is clear again.
import type { Presence } from "../../shared/bridge";

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let current: Presence["state"] | null = null;

export function present(p: Presence | null) {
  clearTimeout(clearTimer);
  current = p?.state ?? null;
  void window.tandrix.overlay.setPresence(p).catch(() => undefined);
}

/** How long a reply stays up: enough to read it, between 4 and 15 seconds. */
export const readingMs = (text: string) =>
  Math.max(4000, Math.min(15_000, 2500 + text.split(/\s+/).length * 380));

export function presentAnswer(text: string) {
  present({ state: "answering", label: "Tandrix", text });
  clearTimer = setTimeout(() => present(null), readingMs(text));
}

/** The state shown now, so work that ends without a reply can clear it. */
export const presenceState = () => current;
