// Your own words (VO5): names Tandrix should always hear right (people, apps, products), kept on
// this Mac and given to speech recognition with every question.
const KEY = "tandrix.words";
/** At most this many words, each at most this long. */
export const MAX_WORDS = 40;
const MAX_LENGTH = 40;

/** "Niamh, Pixelmator,  Kubernetes" → the words, trimmed, without repeats or empties. */
export function parseWords(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,\n]/)) {
    const w = raw.replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
    if (!w || seen.has(w.toLowerCase())) continue;
    seen.add(w.toLowerCase());
    out.push(w);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

export function loadWords(): string[] {
  try {
    return parseWords(localStorage.getItem(KEY) ?? "");
  } catch {
    return [];
  }
}

export function saveWords(words: string[]) {
  try {
    localStorage.setItem(KEY, words.join(", "));
  } catch {
    // Without storage they last until Tandrix quits.
  }
}
