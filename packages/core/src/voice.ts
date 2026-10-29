// Spoken commands on a step. Deterministic: a command is the whole (short) utterance, so a
// question that happens to contain "next" or "skip" goes to the assistant instead.
import type { VoiceCommand } from "@tandrix/contracts";

export type { VoiceCommand };

const FILLER = /\b(hey|ok|okay|please|tandrix|um|uh|so|now|then|just)\b/g;

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(FILLER, " ")
    .replace(/\s+/g, " ")
    .trim();

const exact: Array<[RegExp, VoiceCommand]> = [
  [/^(next|next step|go on|carry on|continue|move on)$/, { kind: "next" }],
  [/^(back|go back|previous|previous step|last step)$/, { kind: "previous" }],
  [/^(repeat|repeat that|say (that|it) again|again|what was that|come again)$/, { kind: "repeat" }],
  [/^(show me|show me again|show (it|them|the parts)( again)?|where is it)$/, { kind: "show" }],
  [/^(stop|stop talking|quiet|be quiet|cancel|never mind)$/, { kind: "stop" }],
  [/^(start|start (the |this )?step|begin|let's (start|go)|i'm starting)$/, { kind: "start" }],
  [
    /^(done|i'm done|finished|i'm finished|i've done (it|that)|that's done|it's done|complete|mark (it |this )?(as )?done)$/,
    { kind: "done" },
  ],
];

export function parseVoiceCommand(text: string): VoiceCommand | null {
  const wake = parseWakePhrase(text);
  const t = normalize(wake.woke ? wake.remainder : text);
  if (!t || t.split(" ").length > 12) return null;
  for (const [pattern, command] of exact) if (pattern.test(t)) return command;

  // "I'm stuck", "I'm stuck on the seal", "help"
  const stuck = /^(i'm stuck|i am stuck|stuck|help|help me|i need help)( (on|with) (.+))?$/.exec(t);
  if (stuck) return stuck[4] ? { kind: "stuck", detail: stuck[4] } : { kind: "stuck" };

  // "skip", "skip this step", "skip it because the bolts are already torqued"
  const skip = /^skip( (it|this|this step|the step|step))?( because (.+))?$/.exec(t);
  if (skip) return skip[4] ? { kind: "skip", reason: skip[4] } : { kind: "skip" };

  return null;
}

/**
 * True when a user explicitly asks Tandrix to perform an action on their computer for them
 * (for example "do it for me", "click Save for me", "open Calendar and add an event for me").
 */
export function wantsDesktopExecution(text: string): boolean {
  const q = text.trim();
  if (!q) return false;
  if (/\b(do (it|this|that)( for me)?|for me please|take over)\b/i.test(q)) return true;
  if (
    /^(please\s+)?(click|double[- ]click|open|launch|switch to|type|enter|fill in|turn on|turn off|enable|disable|toggle)\b.+\bfor me\b/i.test(
      q,
    )
  ) {
    return true;
  }
  if (/^(do it:?|do this:?)\s+\S+/i.test(q)) return true;
  if (/^(please\s+)?(open|launch)\s+[a-z0-9 .+-]+(\s+and\s+.+)?$/i.test(q)) return true;
  return false;
}

/**
 * True when the user asks for a guided lesson on an app or feature ("teach me Photoshop",
 * "show me how to use Google Docs", "walk me through pivot tables"): taught one step at a time
 * with check-ins, not answered all at once. A plain question ("how do I export this?") is not.
 */
export function wantsLesson(text: string): boolean {
  const q = text.trim();
  if (!q) return false;
  if (
    /^(please\s+)?(teach me|show me how|walk me through|guide me through|help me learn|give me a (tour of|lesson in)|train me on|talk me through)\b/i.test(
      q,
    )
  )
    return true;
  if (/\bhow (do|can) i use\b/i.test(q)) return true;
  if (/^how to use\b/i.test(q)) return true;
  return false;
}

const TANDRIX_WORD =
  "(?:tandrix|tandrics|tandrex|tandrik|tandricks|tantrix|tendrix|ten\\s+tricks|tan\\s+tricks|chandrix|sandrix|standrix)";

const WAKE_RE = new RegExp(
  `^\\s*(?:(?:ok|okay|um|uh|well)[\\s,]+)?(?:(?:wake[- ]?up|hey|hi|hello|ok|okay|yo)[\\s,]+${TANDRIX_WORD}|${TANDRIX_WORD}[\\s,]+wake[- ]?up|${TANDRIX_WORD})(?:[\\s,!.:;?—-]+(.*))?$`,
  "i",
);

/**
 * Detects a "Hey Tandrix" / "Wake up Tandrix" wake phrase (including punctuation like
 * "Hey, Tandrix." and common speech-to-text phonetic spellings) and extracts any trailing task or
 * question spoken in the same breath.
 */
export function parseWakePhrase(text: string): { woke: boolean; remainder: string } {
  const m = WAKE_RE.exec(text.trim());
  if (!m) return { woke: false, remainder: text.trim() };
  const rawRemainder = (m[1] ?? "").replace(/^[.!?,;:\s—-]+/, "").trim();
  // If the remainder is only punctuation, treat it as a standalone wake phrase.
  const remainder = /^[.!?,;:\s—-]+$/.test(rawRemainder) ? "" : rawRemainder;
  return { woke: true, remainder };
}
