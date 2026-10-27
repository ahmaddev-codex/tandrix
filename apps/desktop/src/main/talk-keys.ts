// Hold Option+Command to talk, let go to send. A held chord counts once both keys have been down
// for HOLD_MS with nothing else pressed, so ⌥⌘ shortcuts (⌥⌘T, ⌥⌘Tab…) never start a question.
// Another key while talking cancels it: the user was reaching for a shortcut after all. Only
// whether a key is Option, Command or "something else" is ever looked at; keys aren't kept.

export const HOLD_MS = 220;

export type TalkKey = "option" | "command" | "other";

export interface TalkKeyEvents {
  start(): void;
  end(): void;
  cancel(): void;
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export function talkKeys(on: TalkKeyEvents, timers: Timers = realTimers) {
  let option = false;
  let command = false;
  /** Something else was pressed with the chord: it's a shortcut, not talking, until let go. */
  let spoiled = false;
  let talking = false;
  let pending: unknown;

  const clearPending = () => {
    if (pending !== undefined) timers.clear(pending);
    pending = undefined;
  };

  return {
    down(key: TalkKey) {
      if (key === "other") {
        clearPending();
        if (talking) {
          talking = false;
          on.cancel();
        }
        if (option || command) spoiled = true;
        return;
      }
      if (key === "option") option = true;
      else command = true;
      if (option && command && !spoiled && !talking && pending === undefined) {
        pending = timers.set(() => {
          pending = undefined;
          talking = true;
          on.start();
        }, HOLD_MS);
      }
    },
    up(key: TalkKey) {
      if (key === "other") return;
      if (key === "option") option = false;
      else command = false;
      clearPending();
      if (talking) {
        talking = false;
        on.end();
      }
      if (!option && !command) spoiled = false;
    },
  };
}
