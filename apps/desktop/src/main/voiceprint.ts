// "Only answer my voice": the user's voiceprint, kept on this Mac only. The wake helper computes
// prints (native/wake/voiceprint.swift); this decides whether a wake phrase sounds like the user.
// The print is 24 numbers that describe how a voice sounds, not a recording; no audio is kept.
// It tells the user from the TV or other people. It is not a lock, so nothing sensitive hangs on it.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PRINT_LENGTH = 24;

/**
 * How much each number of the print varies from one person to the next, measured across eleven
 * voices. Distances are in these units, so the microphone's own colouring (the same in the setup
 * and in every wake phrase) cancels out.
 */
const SCALE = [
  1.288, 3.152, 4.864, 3.462, 2.22, 2.463, 3.284, 2.943, 3.632, 1.308, 2.234, 1.646, 1.574, 0.619,
  1.189, 1.351, 0.537, 1.178, 0.868, 0.816, 0.606, 0.526, 0.807, 0.662,
];

/**
 * At or under this distance, it's the user. Measured on 33 phrases from the voice that set up
 * against 330 from ten others: about one phrase in ten from the user is missed (say it again) and
 * about one in a hundred from someone else gets through.
 */
export const SAME_VOICE = 0.9;
/** A setup phrase further than this from the others was probably a different voice or noise. */
const SETUP_AGREE = 1.1;
export const SETUP_PHRASES = 3;

export interface Voiceprint {
  version: 1;
  print: number[];
  /** Answer only this voice; off keeps the print but answers anyone. */
  onlyMine: boolean;
  createdAt: string;
}

export const isPrint = (v: unknown): v is number[] =>
  Array.isArray(v) &&
  v.length === PRINT_LENGTH &&
  v.every((n) => typeof n === "number" && Number.isFinite(n));

export function distance(a: number[], b: number[]) {
  let sum = 0;
  for (let i = 0; i < PRINT_LENGTH; i++) sum += ((a[i]! - b[i]!) / SCALE[i]!) ** 2;
  return Math.sqrt(sum / PRINT_LENGTH);
}

export const meanPrint = (prints: number[][]) =>
  Array.from(
    { length: PRINT_LENGTH },
    (_, i) => prints.reduce((s, p) => s + p[i]!, 0) / prints.length,
  );

/** Whether to answer a wake phrase: always, unless only-my-voice is on and it's clearly someone else. */
export function shouldAnswer(vp: Voiceprint | null, heard: number[] | undefined) {
  if (!vp?.onlyMine) return true;
  // Too little voice to tell (a whisper, a short "Tandrix"): answer rather than ignore the user.
  if (!heard) return true;
  return distance(vp.print, heard) <= SAME_VOICE;
}

/**
 * The print from the setup phrases, or which phrase to say again: each must sound like the rest.
 */
export function fromSetup(prints: number[][]): { print: number[] } | { redo: number } {
  // One odd phrase pulls the others' average too, so redo the one that stands out most.
  const apart = prints.map((p, i) => distance(p, meanPrint(prints.filter((_, j) => j !== i))));
  const worst = apart.indexOf(Math.max(...apart));
  return apart[worst]! > SETUP_AGREE ? { redo: worst } : { print: meanPrint(prints) };
}

export function voiceprintStore(dir: string) {
  const file = join(dir, "voiceprint.json");
  return {
    load(): Voiceprint | null {
      if (!existsSync(file)) return null;
      try {
        const v = JSON.parse(readFileSync(file, "utf8")) as Partial<Voiceprint>;
        return v.version === 1 && isPrint(v.print) && typeof v.onlyMine === "boolean"
          ? (v as Voiceprint)
          : null;
      } catch {
        return null;
      }
    },
    save(v: Voiceprint) {
      writeFileSync(file, JSON.stringify(v), { mode: 0o600 });
    },
    remove() {
      rmSync(file, { force: true });
    },
  };
}
