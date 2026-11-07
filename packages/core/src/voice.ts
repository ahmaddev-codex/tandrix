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
    /^(please\s+)?(teach m[ew]|tech me|teach us|show me how|walk me through|guide me through|help me learn|give me a (tour of|lesson (in|on))|train me on|talk me through|show me around|i want to learn|i'?d like to learn|get me started with)\b/i.test(
      q,
    )
  )
    return true;
  if (/\bhow (do|can) i use\b/i.test(q)) return true;
  if (/^how to use\b/i.test(q)) return true;
  if (/\b(learn (to use|how to use)|get started with|tutorial)\b/i.test(q)) return true;
  // A subject, not only an app: "teach me about photosynthesis", "help me learn recursion".
  if (
    /^(please\s+)?(teach me about|explain to me how|help me learn about|i want to understand)\b/i.test(
      q,
    )
  )
    return true;
  return false;
}

/**
 * Carrying on with a lesson or explanation just given ("next", "go on", "okay, what's next?"):
 * on its own it says nothing about the screen, so it continues the teaching rather than being
 * answered as where to click.
 */
export function continuesLesson(text: string): boolean {
  const q = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, "");
  if (!q || q.length > 60) return false;
  return /^(?:(?:ok(?:ay)?|alright|right|yes|yeah|sure|got it|done|i'?m done|i did( that| it)?|cool|great|good)[\s,]*)*(?:next( one| step| part| bit)?|continue|carry on|go on|keep going|and then|then what|what'?s next|what now|move on|more|tell me more|go ahead)?$/.test(
    q,
  );
}

/** Asking to see the last answer again ("show me again", "go over that again"). */
export function wantsReplay(text: string): boolean {
  return /^(?:(?:can you|could you|please)\s+)?(?:show me (?:that |it )?again|go over (?:that|it) again|do (?:that|it) again|run through (?:that|it) again|replay (?:that|it)|again|one more time|show (?:that|it) again)\b/i.test(
    text.trim(),
  );
}

/**
 * An ask to understand what's on screen (VO: "I have this equation on my screen and I don't
 * understand it"): explained like a tutor, not answered with where to click.
 */
/** Parts of an app, which are clicked, not taught. */
const CONTROLS =
  /\b(buttons?|menus?|settings?|options?|tabs?|icons?|toolbars?|sidebars?|windows?|files?|folders?|fields?|links?|shortcuts?|preferences|features?|steps to|how to)\b/i;

/**
 * Going through what's on screen, not an app: "walk me through these functional groups", "show
 * me the bones", "point out the bonds", "go through this", "what are the groups here".
 */
function aboutContent(q: string): boolean {
  if (CONTROLS.test(q)) return false;
  // "Walk me through setting up Gmail" is a lesson in an app; "…through this" is the content.
  if (
    /\b(walk|take|talk|go|run) (me |us )?(through|over) (this|these|those|that|it|what|the|each|all|every|my)\b/i.test(
      q,
    )
  )
    return !/\b(through|over) (\w+ing|how)\b/i.test(q);
  if (
    /\b(show|point out|point to|highlight|mark|circle|find|label|identify|outline|trace|draw|underline|teach) (me |us )?(all |each of |every )?(the|these|those|this|its|their|each|every|my|all)\b/i.test(
      q,
    ) &&
    /\b\w{3,}s\b|\b(curve|wave|graph|equation|formula|structure|diagram|molecule|cell|skeleton|map|code|function|proof|sentence|chart|group|bond|atom|ring)\b/i.test(
      q,
    )
  )
    return true;
  return /\bwhat (are|is) (the|these|those|this|that|each|all the) [\w\s-]{2,40}(here|on (my|the|this) screen|in (this|the) (picture|image|diagram|page|molecule|structure|graph|code))\b/i.test(
    q,
  );
}

export function wantsExplanation(text: string): boolean {
  const q = text.trim();
  if (!q) return false;
  if (aboutContent(q)) return true;
  return /\b(i (don'?t|do not|can'?t|cannot) (understand|get|follow|figure out|work out)|help me (understand|make sense of|solve|work out)|explain|what does (this|that|it) mean|what (does|do) (this|these) (equation|formula|error|message|chart|graph|code|line|symbol)s?|what('s| is) (this|that) (equation|formula|error|message|chart|graph|code|symbol|word|term)|what am i looking at|make sense of|(the )?(parts|bones|organs|components|sections|layers|elements) of|what (does|do) (this|these|that) (code|function|method|class|query|regex|script|loop|line|program|component|command)s? do|how does (this|that|it) (code |function |query )?work|why (is|does|did|do|won'?t|doesn'?t|isn'?t) (this|that|it|my|the)( code| function| query| script| test| build| program| app)? (fail|break|crash|error|not work|work|give|run|compile)|review (this|my) (code|function|query)|(find|spot) the bug|debug (this|it)|translate (this|it)|what('s| is) the (answer|solution|meaning)|label (the|this|these|each)|identify (the|this|these|each)|which (part|bone|organ|one) is|name (the|each) (part|bone)|what (are|is) (these|those|the) (parts|bones|labels)|break (this|it) down|solve (this|it)|how (do|did) (they|you|i) get|what('s| is) going on (here|with this))\b/i.test(
    q,
  );
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

/** The longest piece voiced after the first: long enough to sound natural, short to make. */
const LATER_PIECE = 160;

/**
 * A reply in the pieces it's voiced in (SP4): the first sentence alone, so the first sound comes
 * as soon as it's made ("Got it." is ready at once), then the rest a sentence or two at a time,
 * each made while the one before plays.
 */
export function speechPieces(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  // Sentence ends, not the dots in "e.g." or "3.5" (a full stop followed by a space and a capital,
  // a digit or a quote).
  const sentences = clean.split(/(?<=[.!?])\s+(?=["'“‘(]?[A-Z0-9])/);
  const [first, ...rest] = sentences;
  const pieces = [first!];
  let piece = "";
  for (const s of rest) {
    if (piece && piece.length + s.length + 1 > LATER_PIECE) {
      pieces.push(piece);
      piece = s;
    } else piece = piece ? `${piece} ${s}` : s;
  }
  if (piece) pieces.push(piece);
  return pieces;
}
