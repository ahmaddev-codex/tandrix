// VO1: ways to tell the wake phrase from what a recogniser heard. Shared by the spike's scorer and,
// once chosen, by the wake helper's tests.

/** Today's rule (native/wake/main.swift): a list of spellings, with or without "hey"/"wake up". */
const CURRENT =
  /\b(?:(?:hey|hi|ok|okay|wake\s*up)[\s,]+)?(?:tandrix|tandrics|tandrex|tandrik|tantrix|tendrix|ten\s+tricks|tan\s+tricks|tan\s*drix|sandrix|hendrix|handrix|trendix|candrix|tandreks)\b/i;
export const currentRule = (heard: string) => CURRENT.test(heard);

/** Spelling folded to sound: "Tandriggs", "Tandrix" and "Tandricks" all become "tandriks". */
export function soundOf(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/^ch/, "t")
    .replace(/(ggs|gs|cks|cs|x|ks)$/, "ks")
    .replace(/ck/g, "k");
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length]![b.length]!;
}

const NAME = soundOf("Tandrix");

/** Whether a word (or two run together, "Tan drix") sounds like Tandrix, within `slack` letters. */
export function soundsLikeName(word: string, slack = 1): boolean {
  const s = soundOf(word);
  return s.length >= 5 && distance(s, NAME) <= slack;
}

/**
 * The sound-alike rule (native/wake/continuous.swift WakeRule is the same): "hey" or "wake up" (or
 * "hi", "okay"), then a word that sounds like Tandrix, or two that do together; or "Tandrix"
 * itself, heard right, to open a sentence. Otherwise a name alone isn't enough.
 */
/** Consonants after the first letter, spelling folded to sound (WakeRule.skeleton). */
export function skeleton(text: string): string {
  let s = text.toLowerCase().replace(/[^a-z]/g, "");
  for (const [from, to] of [
    ["ck", "k"],
    ["x", "ks"],
    ["ph", "f"],
    ["ch", "t"],
    ["c", "k"],
  ] as const)
    s = s.split(from).join(to);
  return s ? s[0] + s.slice(1).replace(/[aeiouy]/g, "") : "";
}
const PHRASES = ["hey", "wakeup"].map((lead) => skeleton(lead) + skeleton("btandrix").slice(1));

const NUMBERS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
  "10": "ten",
  "11": "eleven",
  "12": "twelve",
  "20": "twenty",
  "100": "hundred",
};
/** Numbers as words: recognisers write the "Tan" of Tandrix as "10" ("Wake up 10 breaks"). */
export const spelledOut = (text: string) => text.replace(/\b\d+\b/g, (n) => NUMBERS[n] ?? n);

export function soundAlikeRule(heard: string, slack = 2): boolean {
  const words =
    spelledOut(heard)
      .toLowerCase()
      .match(/[a-z']+/g) ?? [];
  // The name on its own, anywhere, heard nearly right ("Tandrix", "Tendrix"; not "Hendrix").
  if (words.some((w) => soundsLikeName(w, 1))) return true;
  for (let i = 0; i < words.length; i++) {
    let joined = "";
    for (let j = i; j < Math.min(words.length, i + 4); j++) {
      joined += words[j];
      const k = skeleton(joined);
      if (
        j > i &&
        PHRASES.some((t) => k.length >= t.length - 1 && distance(k, t) <= (t.length >= 9 ? 2 : 1))
      )
        return true;
    }
  }
  for (let i = 0; i < words.length; i++) {
    const lead =
      words[i] === "wake" && words[i + 1] === "up"
        ? 2
        : /^(hey|he|hi|ok|okay)$/.test(words[i]!)
          ? 1
          : 0;
    if (!lead) continue;
    const a = words[i + lead];
    const b = words[i + lead + 1];
    if (a && (soundsLikeName(a, slack) || (b && soundsLikeName(a + b, slack)))) return true;
  }
  return false;
}
