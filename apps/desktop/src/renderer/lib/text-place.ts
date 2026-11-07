// Where words are on the screen, exactly: the text the model quoted (a line of code, a step of an
// equation, a term), found among the lines the Mac read off the screenshot (native/text), down to
// the characters. The model's own box round text is loose; this is the text's own box.

/** A line read off the screenshot: its text, box, and where each character starts and its width. */
export interface ReadLine {
  text: string;
  box: [number, number, number, number];
  chars: Array<[number, number]>;
}

export interface TextBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Text as compared: case, spaces and look-alike characters set aside. */
function fold(c: string): string {
  const k = c.toLowerCase();
  if (/\s/.test(k)) return "";
  if ("−–—‐".includes(k)) return "-";
  if ("×✕".includes(k)) return "x";
  if ("‘’`´".includes(k)) return "'";
  if ("“”".includes(k)) return '"';
  return k;
}

/** A string folded, with each folded character's index in the original. */
function folded(s: string): { text: string; at: number[] } {
  let text = "";
  const at: number[] = [];
  [...s].forEach((c, i) => {
    const f = fold(c);
    for (const ch of f) {
      text += ch;
      at.push(i);
    }
  });
  return { text, at };
}

/** How alike two strings are, 0 to 1 (edit distance against the longer). */
function alike(a: string, b: string): number {
  if (!a.length || !b.length) return 0;
  const prev = new Array<number>(b.length + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return 1 - prev[b.length]! / Math.max(a.length, b.length);
}

/** The box of characters [from, to) of a line. */
function span(line: ReadLine, from: number, to: number): TextBox {
  const [x, y, w, h] = line.box;
  const first = line.chars[from];
  const last = line.chars[Math.max(from, to - 1)];
  if (!first || !last || (!first[1] && !last[1])) return { x, y, w, h };
  const left = first[0];
  const right = last[0] + last[1];
  return { x: left, y, w: Math.max(4, right - left), h };
}

/** One quoted line on the screen: where it's written exactly, else the line most like it. */
function placeLine(lines: ReadLine[], quote: string): { box: TextBox; score: number } | null {
  const q = folded(quote).text;
  if (q.length < 2) return null;
  let best: { box: TextBox; score: number } | null = null;
  for (const line of lines) {
    const f = folded(line.text);
    const at = f.text.indexOf(q);
    if (at >= 0) {
      const box = span(line, f.at[at]!, f.at[at + q.length - 1]! + 1);
      // Written exactly; a shorter line holding it is a closer match.
      const score = 1 + q.length / f.text.length;
      if (!best || score > best.score) best = { box, score };
      continue;
    }
    const score = alike(q, f.text);
    if (score >= 0.72 && (!best || score > best.score)) {
      const [x, y, w, h] = line.box;
      best = { box: { x, y, w, h }, score };
    }
  }
  return best;
}

/**
 * Where a quote is on the screen: each of its lines found, and the box round all of them (the
 * first and last lines of a block are enough). Null when it isn't there to be found.
 */
export function placeQuote(lines: ReadLine[], quote: string): TextBox | null {
  const parts = quote
    .split(/\n|\s*\.\.\.\s*|\s*…\s*/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
  const found = parts.map((p) => placeLine(lines, p)).filter((f) => f !== null);
  if (!found.length || found.length < Math.ceil(parts.length / 2)) return null;
  const x = Math.min(...found.map((f) => f.box.x));
  const y = Math.min(...found.map((f) => f.box.y));
  const r = Math.max(...found.map((f) => f.box.x + f.box.w));
  const b = Math.max(...found.map((f) => f.box.y + f.box.h));
  return { x, y, w: r - x, h: b - y };
}
