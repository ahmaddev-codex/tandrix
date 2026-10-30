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
 * The request under its politeness: "Can you add bread?", "I want you to add bread" and
 * "Please add bread" are all the same ask as "add bread". Anything else comes back unchanged.
 */
export function asImperative(text: string): string {
  return text
    .trim()
    .replace(/^(please\s+)?(can|could|would|will)\s+you\s+(please\s+)?/i, "")
    .replace(/^i\s+(want|need|'d like|would like)\s+you\s+to\s+/i, "")
    .replace(/^please\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
}

/** Screen work said as a verb first ("add…", "book…", "turn on…"): the ACTION list's twin. */
const DELEGATED_VERB =
  /^(go( to| into| back to)?|head (to|over to)|grab|get|fetch|pull|take|put|bring|copy|check (my|the|on)|look (at|in|through|for) (my|the)|read (my|the)|find (my|the)|add|book|schedule|create|make|set( up)?|turn (on|off)|switch|change|rename|move|copy|paste|save|export|send|reply|forward|write|fill( in| out)?|sign (up|in)|log in|install|update|delete|remove|clean up|sort|organi[sz]e|archive|close|quit|open|launch|start|download|upload|share|invite|mute|unmute|enable|disable|connect|join|pair|print|resize|crop|convert|merge|format|bookmark|subscribe|unsubscribe|order|buy|pay|transfer|clear|empty|restart|reset|click|type|enter|toggle)\b/i;

/** Work that needs no screen, however it is asked for; "for me" must not drag it to the mouse. */
const BACKGROUND_LEAD =
  /^(research|look up|look into|find out|find me|search|compare|summari[sz]e|explain|draft|write me|come up with|plan|brainstorm|give me|list|recommend|check)\b/i;

/**
 * True when a user explicitly asks Tandrix to perform an action on their computer for them
 * (for example "do it for me", "click Save for me", "open Calendar and add an event for me").
 * The delegation can be wrapped ("can you … for me?", "I want you to …") and the verb can be
 * any screen verb, not just clicking and typing.
 */
export function wantsDesktopExecution(text: string): boolean {
  const q = text.trim();
  if (!q) return false;
  if (
    /\b(do (it|this|that)( for me)?|for me please|take over|take care of (it|this|that))\b/i.test(q)
  )
    return true;
  const core = asImperative(q);
  if (/^(do it:?|do this:?)\s+\S+/i.test(core)) return true;
  if (/^do\s+(the|my|this|that)\b/i.test(core)) return true;
  if (/\bfor me\b/i.test(core)) {
    // No-screen work ("draft a reply for me", "research desks for me") stays background work.
    if (BACKGROUND_LEAD.test(core)) return false;
    if (DELEGATED_VERB.test(core)) return true;
  }
  // "I want you to turn on dark mode" hands the work over even without a "for me".
  if (
    /^i\s+(want|need|'d like|would like)\s+you\s+to\s+/i.test(q) &&
    !BACKGROUND_LEAD.test(core) &&
    DELEGATED_VERB.test(core)
  )
    return true;
  if (/^(open|launch)\s+[a-z0-9 .+-]+(\s+and\s+.+)?$/i.test(core)) return true;
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
