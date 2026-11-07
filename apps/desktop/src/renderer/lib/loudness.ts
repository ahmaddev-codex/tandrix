// Quiet and night modes (VO7): how loud Tandrix speaks. Quiet mode is for shared or quiet rooms;
// quieter at night turns it down by itself from 10 pm to 7 am. Kept on this Mac.
const QUIET = "tandrix.quietMode";
const NIGHT = "tandrix.quietAtNight";

export const QUIET_VOLUME = 0.4;
export const NIGHT_VOLUME = 0.55;

const flag = (key: string, fallback: boolean) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
};
const setFlag = (key: string, on: boolean) => {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // Without storage it lasts until Tandrix quits.
  }
};

export const quietMode = () => flag(QUIET, false);
export const setQuietMode = (on: boolean) => setFlag(QUIET, on);
export const quietAtNight = () => flag(NIGHT, true);
export const setQuietAtNight = (on: boolean) => setFlag(NIGHT, on);

export const isNight = (at: Date) => at.getHours() >= 22 || at.getHours() < 7;

/** How loud to speak now, 0.1 to 1: the quieter of the two modes that apply. */
export function voiceVolume(
  at = new Date(),
  modes = { quiet: quietMode(), night: quietAtNight() },
): number {
  let v = 1;
  if (modes.quiet) v = Math.min(v, QUIET_VOLUME);
  if (modes.night && isNight(at)) v = Math.min(v, NIGHT_VOLUME);
  return v;
}
