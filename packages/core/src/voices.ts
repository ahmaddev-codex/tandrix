// Choosing a device voice for when Tandrix's own voice (Kokoro, from the API) can't be reached:
// only Apple's Premium or Enhanced voices, which sound like a person. The compact defaults and
// the novelty voices sound robotic and are never used; without a natural voice Tandrix shows its
// reply as text only. Users download Premium and Enhanced voices in Settings > Accessibility >
// Spoken Content > Voices (System Settings on the Mac).

export interface DeviceVoice {
  /** iOS: AVSpeechSynthesisVoice identifier; macOS (Web Speech): voiceURI. */
  id: string;
  name: string;
  /** BCP 47, e.g. "en-US". */
  lang: string;
  /** What the platform says about quality, when it says ("Enhanced", "Default"). */
  quality?: string;
}

/** The most natural Premium and Enhanced voices, best first. */
const preferred = [
  "ava",
  "zoe",
  "evan",
  "nathan",
  "noelle",
  "allison",
  "samantha",
  "serena",
  "daniel",
  "karen",
  "moira",
  "tom",
];
const novelty = new Set([
  // Eloquence voices: compact and robotic. macOS lists them by name only.
  "eddy",
  "flo",
  "grandma",
  "grandpa",
  "reed",
  "rocko",
  "sandy",
  "shelley",
  // Novelty voices.
  "albert",
  "bad news",
  "bahh",
  "bells",
  "boing",
  "bubbles",
  "cellos",
  "deranged",
  "good news",
  "jester",
  "organ",
  "superstar",
  "trinoids",
  "whisper",
  "wobble",
  "zarvox",
  "fred",
  "junior",
  "kathy",
  "ralph",
  "hysterical",
  "pipe organ",
]);

const base = (name: string) =>
  name
    .replace(/\s*\(.*\)\s*$/, "")
    .trim()
    .toLowerCase();

/** Higher is better; below zero means don't use it. */
export function voiceScore(v: DeviceVoice, language: string): number {
  const lang = v.lang.replace("_", "-").toLowerCase();
  const want = language.toLowerCase();
  const sameLanguage = lang.split("-")[0] === want.split("-")[0];
  if (!sameLanguage || novelty.has(base(v.name))) return -1;
  // Eloquence voices (Eddy, Flo, Grandma…) are compact and robotic too.
  if (/eloquence/i.test(v.id)) return -1;
  const id = v.id.toLowerCase();
  const label = `${v.name} ${v.quality ?? ""}`.toLowerCase();
  let score: number;
  if (id.includes(".premium.") || label.includes("premium")) score = 300;
  else if (id.includes(".enhanced.") || label.includes("enhanced")) score = 200;
  // Anything else is a compact voice: robotic, so never chosen.
  else return -1;
  const rank = preferred.indexOf(base(v.name));
  if (rank >= 0) score += 50 - rank;
  // The user's own variant of the language (en-GB for en-GB) beats another one.
  if (lang === want) score += 20;
  return score;
}

/** The best natural voice for the language, or null when the device has none (text only). */
export function pickVoice<V extends DeviceVoice>(voices: readonly V[], language: string): V | null {
  let best: V | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = voiceScore(v, language);
    if (s > bestScore) [best, bestScore] = [v, s];
  }
  return best;
}
