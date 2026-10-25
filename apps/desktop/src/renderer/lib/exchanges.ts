import type { VoiceTurn } from "@tandrix/ui/web";

/** The last answered questions, oldest first, for follow-ups. */
export function recentExchanges(turns: VoiceTurn[], max = 4) {
  const out: Array<{ question: string; reply: string }> = [];
  for (let i = 0; i + 1 < turns.length; i++) {
    const q = turns[i]!;
    const a = turns[i + 1]!;
    if (q.speaker === "you" && a.speaker === "tandrix")
      out.push({ question: q.text, reply: a.text });
  }
  return out.slice(-max);
}
