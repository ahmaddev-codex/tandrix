// What the presence bar at the top of the screen shows, from the panel's Show me work. Idle shows
// nothing; a reply stays up about as long as it takes to read, then the screen is clear again.
// While Tandrix works, the bar shows thinking phrases in turn, chosen from what the work is about,
// never the words it's about to say.
import { nextPhrase } from "@tandrix/core";
import type { Presence } from "../../shared/bridge";

let clearTimer: ReturnType<typeof setTimeout> | undefined;
let rotor: ReturnType<typeof setInterval> | undefined;
let current: Presence["state"] | null = null;

/** States that mean Tandrix is working, so the bar's phrase changes as it goes. */
const WORKING = new Set<Presence["state"]>(["thinking", "looking", "doing"]);
/** Long enough to read a phrase, short enough to feel alive. */
export const PHRASE_MS = 2200;

/** What the work is about (the question or task, and what Tandrix says as it goes): never shown. */
let about = "";
let recent: string[] = [];

/** Starts a new piece of work: its phrases follow what it's about. */
export function workingOn(text: string) {
  about = text.slice(-600);
  recent = [];
}

/** Something Tandrix said or did as it worked, to steer the phrases (Opening WhatsApp → chat). */
export function noteWork(text: string) {
  about = `${about} ${text}`.slice(-600);
}

const send = (p: Presence | null) =>
  void window.tandrix.overlay.setPresence(p).catch(() => undefined);

export function present(p: Presence | null) {
  clearTimeout(clearTimer);
  clearInterval(rotor);
  current = p?.state ?? null;
  send(p);
  if (p && WORKING.has(p.state))
    rotor = setInterval(() => {
      const phrase = nextPhrase(about, recent, { acting: p.state === "doing" });
      recent = [...recent, phrase].slice(-8);
      send({ ...p, label: phrase });
    }, PHRASE_MS);
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
