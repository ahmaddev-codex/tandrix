// When a spoken turn ends, from the microphone level over time, on the phone and the Mac alike.
// Held (the phone's mic button): the turn ends when it's let go. Tapped (the phone's mic, the Mac's
// hotkey, a wake word): it ends after a pause once the user has spoken, or with a second tap.
// A turn with no speech in it is never sent: it would only come back as "didn't catch that".

/** Louder than this (dBFS) counts as speech; quieter is the room. */
export const SPEECH_DB = -42;
/**
 * And it must stand this far above the room itself (the quietest of the last few seconds): a fan,
 * air conditioning or a hum louder than SPEECH_DB would otherwise count as talking, and the turn
 * would never hear the pause that ends it.
 */
export const ABOVE_ROOM_DB = 10;
/** How far back the room's level is judged from. */
const ROOM_WINDOW_MS = 5000;
/** Never set the bar above this: a voice is louder still, however noisy the room. */
const MAX_BAR_DB = -26;
/** A pause this long after speaking ends a tapped turn. */
export const END_PAUSE_MS = 1000;
/** A tapped turn with no speech by now gives up. */
export const NO_SPEECH_MS = 7000;
/**
 * After an answer, how long Tandrix keeps listening for a follow-up said without the wake word:
 * two seconds, so it isn't left listening once the user's done (a later one says the name).
 */
export const FOLLOW_UP_MS = 2000;
/** No turn runs longer than this. */
export const MAX_TURN_MS = 30_000;
/** Less speech than this isn't worth transcribing (a cough, a tap on the case). */
export const MIN_SPEECH_MS = 250;
/** A press shorter than this is a tap: keep listening after it's let go. */
export const TAP_MS = 350;

export interface TurnLevels {
  /** Since recording started. */
  elapsedMs: number;
  /** Total time above SPEECH_DB. */
  speechMs: number;
  /** Time since the level was last above SPEECH_DB; equals elapsedMs before any speech. */
  quietMs: number;
  /** Recent levels (dBFS, newest last) and their spans, to judge the room by. */
  recent?: Array<[number, number]>;
}

/** The room's level: the quietest tenth of the recent window (the gaps between words). */
export function roomDb(recent: Array<[number, number]> | undefined): number | null {
  if (!recent || recent.length < 8) return null;
  const sorted = recent.map(([db]) => db).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.1)]!;
}

export type TurnStep = "listen" | "send" | "nothing_heard";

/** Adds one meter reading taken `dtMs` after the last. */
export function addLevel(t: TurnLevels, db: number | undefined, dtMs: number): TurnLevels {
  const room = roomDb(t.recent);
  const above = Math.min(
    MAX_BAR_DB,
    Math.max(SPEECH_DB, room === null ? SPEECH_DB : room + ABOVE_ROOM_DB),
  );
  const loud = db !== undefined && db > above;
  const recent = [...(t.recent ?? []), [db ?? -160, dtMs] as [number, number]];
  let span = recent.reduce((a, [, ms]) => a + ms, 0);
  while (recent.length > 1 && span - recent[0]![1] >= ROOM_WINDOW_MS) span -= recent.shift()![1];
  return {
    elapsedMs: t.elapsedMs + dtMs,
    speechMs: t.speechMs + (loud ? dtMs : 0),
    quietMs: loud ? 0 : t.quietMs + dtMs,
    recent,
  };
}

export const startLevels = (): TurnLevels => ({ elapsedMs: 0, speechMs: 0, quietMs: 0 });

/** For a tapped turn: keep listening, send, or stop because nothing was said. */
export function tappedTurn(t: TurnLevels, noSpeechMs = NO_SPEECH_MS): TurnStep {
  const spoke = t.speechMs >= MIN_SPEECH_MS;
  if (t.elapsedMs >= MAX_TURN_MS) return spoke ? "send" : "nothing_heard";
  if (spoke && t.quietMs >= END_PAUSE_MS) return "send";
  if (!spoke && t.elapsedMs >= noSpeechMs) return "nothing_heard";
  return "listen";
}

/** When the user ends the turn (lets go, or taps again): send only if they spoke. */
export const endedTurn = (t: TurnLevels): Exclude<TurnStep, "listen"> =>
  t.speechMs >= MIN_SPEECH_MS ? "send" : "nothing_heard";
