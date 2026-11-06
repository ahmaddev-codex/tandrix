// How Tandrix talks while it helps: what kind of help a request needs, natural acknowledgements
// (never the same line twice in a row, and a light joke now and then when the ask is a big one),
// offering to do the work itself, and what to make of something said while it's already busy.
import { asImperative, wantsDesktopExecution, wantsLesson } from "./voice";

/** Shows, offers to do, does straight away, or works in the background without the screen. */
export type HelpKind = "show" | "offer" | "do" | "background" | "app";

const QUESTION =
  /^(where|what|which|how|why|when|who|is|are|can|could|should|does|do|will|would)\b|\?\s*$/i;

/** Things to do on the computer, said as a plain request ("book my dentist for Thursday"). */
const ACTION =
  /^(please\s+)?(go( to| into| back to)?|head (to|over to)|grab|get|fetch|pull|take|put|bring|copy|check (my|the|on)|look (at|in|through|for) (my|the)|read (my|the)|find (my|the)|add|book|schedule|create|make|set( up)?|turn (on|off)|switch|change|rename|move|copy|paste|save|export|send|reply|forward|write|draft|fill( in| out)?|sign (up|in)|log in|install|update|delete|remove|clean up|sort|organi[sz]e|archive|close|quit|open|launch|start|find and|download|upload|share|invite|mute|unmute|enable|disable|connect|join|pair|print|resize|crop|convert|merge|format|bookmark|subscribe|unsubscribe|order|buy|pay|transfer|clear|empty|restart|reset)\b/i;

/** Work that needs no screen: looking things up, summing up, drafting words to read later. */
const BACKGROUND =
  /^(please\s+)?(research|look up|look into|find out|find me|search (for|the web)|compare|summari[sz]e|explain|draft|write me|come up with|plan|brainstorm|give me|list|recommend|check (the )?(price|weather|news))\b/i;

const WHEN =
  /\b(today|tonight|tomorrow|this (morning|afternoon|evening|week(end)?)|next (week|month|\w+day)|on (mon|tues|wednes|thurs|fri|satur|sun)day|(mon|tues|wednes|thurs|fri|satur|sun)day|at \d{1,2}([:.]\d{2})?|\d{1,2}([:.]\d{2})?\s?(am|pm)|noon|midnight)\b/i;

/**
 * Requests an app command does outright (SP6), with no screen, pointer or keyboard: a calendar
 * event, a reminder, a note, music, a folder, a web page. One step, so they're done straight away.
 */
const APP: RegExp[] = [
  // "Add lunch with Sam tomorrow at 1", "Put the dentist in my calendar on Friday".
  /^(add|put|book|schedule|pencil in|block( out)?|set up)\b.*\b(calendar|diary)\b/i,
  /^(remind me|(add|set|create|make) (a |me a )?reminder)\b/i,
  /^((make|take|create|write|add) (a |me a )?(quick )?note|note (that|down))\b/i,
  /^(play|pause|resume|skip( this)?( song| track)?|next (song|track)|previous (song|track)|stop the music)\b/i,
  /^(open|show)( me)? (my )?(home|desktop|documents|downloads|pictures|movies|music|applications) folder\b/i,
  /^(open|go to|visit|pull up) (https:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?( in safari)?[.!]?$/i,
];
const TIMED_ADD = /^(add|put|schedule|pencil in|block( out)?)\b/i;

/** Said about what's on the screen ("play this video", "open the second link"): not an app command. */
const ABOUT_THE_SCREEN =
  /\b(on (my|this|the) screen|this (page|app|window|video|song here|one)|here|that (one|button|link)|click|tap|type|scroll)\b/i;

export function isAppCommand(text: string): boolean {
  const core = asImperative(text.trim());
  if (!core || ABOUT_THE_SCREEN.test(text)) return false;
  if (APP.some((r) => r.test(core))) return true;
  // "Add lunch with Sam tomorrow at 1": something put in a day, with a time to put it at.
  return (
    TIMED_ADD.test(core) && WHEN.test(core) && !/\b(to (the )?(cart|basket|list))\b/i.test(core)
  );
}

/** What a request needs. Screen questions are shown; plain requests are offered; "for me" is done. */
export function helpKind(text: string): HelpKind {
  const q = text.trim();
  if (!q) return "show";
  if (wantsLesson(q)) return "show";
  if (isAppCommand(q)) return "app";
  if (wantsDesktopExecution(q)) return "do";
  if (/\b(in the background|while i work|meanwhile|when you can)\b/i.test(q)) return "background";
  // A polite wrapper ("can you …?", "I want you to …") must not turn a request into a question
  // to be answered with instructions: judge the ask underneath it.
  const core = asImperative(q);
  if (
    BACKGROUND.test(core) &&
    !/\b(on (my|this|the) screen|here|this (page|app|window))\b/i.test(q)
  )
    return "background";
  // Only a question said as a question is shown; a wrapped request falls through to the offer.
  if (core === q && QUESTION.test(q)) return "show";
  if (ACTION.test(core)) return "offer";
  return "show";
}

/** A yes, said any natural way. */
export function isYes(text: string): boolean {
  return /^(yes|yeah|yep|yup|sure|ok(ay)?|go( ahead| for it)?|do it|please( do)?|please go ahead|absolutely|of course|sounds good|let'?s do it|go on|why not|right|correct|alright|fine)\b/i.test(
    text.trim(),
  );
}

/** A no, said any natural way. */
export function isNo(text: string): boolean {
  return /^(no|nope|nah|not now|don'?t|do not|never ?mind|cancel|stop|hold on|wait|just show me|i'?ll do it)\b/i.test(
    text.trim(),
  );
}

/**
 * Something said while a task runs: stop it, steer it ("no, the other Thursday"), or a new task to
 * do next.
 */
export function interjection(text: string): "stop" | "redirect" | "queue" {
  const q = text.trim();
  if (/^(stop|cancel|abort|halt|quit|never ?mind|forget it)\b/i.test(q)) return "stop";
  if (
    /^(no[,.!]?\s|not that|actually|wait|instead|rather|make it|change (it|that)|use|try|i meant|i said|correction|oops|sorry)\b/i.test(
      q,
    ) ||
    /\b(instead|not that one|the other one)\b/i.test(q)
  )
    return "redirect";
  return "queue";
}

/** Words that point at what's on the screen ("this button", "here", "that menu"). */
const ON_SCREEN =
  /\b(on (my|the|this) screen|screen|here|this|that|these|those|it|button|menu|window|tab|field|icon|page|app|click|cursor|toolbar|sidebar|setting|settings|option)\b/i;

/**
 * Something said while a screen task is running. Only work that needs the mouse and keyboard
 * waits its turn; the rest starts now, alongside it:
 * - stop / redirect: about the running task
 * - background: needs no screen (a look-up, a question of fact, a draft): a background agent
 * - look: a question about what's on screen: answered by looking, without taking the mouse
 * - queue: another job on the screen: next, since there's one mouse
 */
export function whileBusy(text: string): "stop" | "redirect" | "background" | "look" | "queue" {
  const how = interjection(text);
  if (how !== "queue") return how;
  const kind = helpKind(text);
  if (kind === "background") return "background";
  // App commands run alongside, out of sight; opening a folder or a page takes the front, so waits.
  if (kind === "app")
    return /^(open|show|go to|visit|pull up)\b/i.test(asImperative(text)) ? "queue" : "background";
  if (kind === "show") return ON_SCREEN.test(text) ? "look" : "background";
  return "queue";
}

/** Long, many-part or multi-app asks: the kind that earns a light joke. */
export function isBigAsk(text: string): boolean {
  const q = text.trim();
  const parts = q.split(/\b(?:and then|then|and also|after that|,\s*and)\b/i).length;
  return q.length > 140 || parts >= 3;
}

const ACKS = [
  "On it.",
  "Sure, give me a second.",
  "Got it. Starting now.",
  "Okay, let's get that done.",
  "Happy to. Working on it.",
  "Right away.",
  "Leave it with me.",
  "Sure thing.",
];

const BIG_ACKS = [
  "That's a full plate. Good thing I don't need coffee. Starting now.",
  "Ambitious. I like it. Let's go one piece at a time.",
  "Big one. Rolling up my sleeves, metaphorically.",
  "Okay, that's a few things. I'll work through them in order.",
  "Challenge accepted. Here we go.",
];

// Only screen jobs queue, so say why: there's one mouse.
const QUEUED = [
  "Got it, that's next. I've only got the one mouse.",
  "Noted. I'll do that right after this one.",
  "Sure, I'll get to that as soon as this is done.",
  "Added. It needs the screen too, so it's up next.",
];

const REDIRECTED = ["Okay, changing course.", "Got it, adjusting.", "Sure, switching to that."];

const BACKGROUND_ACKS = [
  "I'll look into that in the background and let you know.",
  "On it in the background. Keep going, I'll tell you when it's ready.",
  "Sure. I'll work on that quietly and come back to you.",
];

let last = "";
/** A line from the pool, never the one just said. */
function pick(pool: string[], seed = Math.random()): string {
  const options = pool.filter((l) => l !== last);
  const line = options[Math.floor(seed * options.length) % options.length] ?? pool[0]!;
  last = line;
  return line;
}

/** What Tandrix says the moment it starts on a task. */
export function acknowledge(task: string, seed?: number): string {
  // About one big ask in two gets the joke; the rest a plain warm line.
  if (isBigAsk(task) && (seed ?? Math.random()) < 0.5) return pick(BIG_ACKS, seed);
  return pick(ACKS, seed);
}

export const acknowledgeQueued = (seed?: number) => pick(QUEUED, seed);
export const acknowledgeRedirect = (seed?: number) => pick(REDIRECTED, seed);
export const acknowledgeBackground = (seed?: number) => pick(BACKGROUND_ACKS, seed);

/** Offers to do the work, the way a good assistant would. */
export function offerToDo(task: string, seed = Math.random()): string {
  // Said back to the user: their "my" is "your".
  const t = task
    .trim()
    .replace(/[.!?]+$/, "")
    .replace(/\bmyself\b/gi, "yourself")
    .replace(/\bmy\b/gi, "your")
    .replace(/\bmine\b/gi, "yours")
    .replace(/\bme\b/gi, "you");
  const short = t.length <= 60 ? t.charAt(0).toLowerCase() + t.slice(1) : "";
  const lines = short
    ? [
        `I can ${short} for you. Want me to?`,
        `Want me to just do that? I can ${short} now.`,
        `I can take care of that. Shall I go ahead?`,
      ]
    : ["I can take care of that for you. Shall I go ahead?", "Want me to just do it?"];
  return lines[Math.floor(seed * lines.length) % lines.length]!;
}

/** Every fixed line Tandrix says, so its voice can have them ready before they're needed. */
/**
 * Said the moment a question is understood, before Show me's answer is ready (SP7): short, so it's
 * over before the answer comes, and played from audio the Mac already holds.
 */
export const LOOK_ACKS = [
  "One moment.",
  "Let me look.",
  "Just a sec.",
  "Let me see.",
  "Looking now.",
];

/** An acknowledgement that isn't the one said last time; from `ready` when only some are loaded. */
export function lookAck(
  last: string | undefined,
  ready: readonly string[] = LOOK_ACKS,
  seed = Math.random(),
): string | undefined {
  const choices = ready.filter((l) => l !== last);
  return choices.length ? choices[Math.floor(seed * choices.length) % choices.length] : undefined;
}

export const ASSISTANT_LINES = [
  ...LOOK_ACKS,
  ...ACKS,
  ...BIG_ACKS,
  ...QUEUED,
  ...REDIRECTED,
  ...BACKGROUND_ACKS,
  "No problem, I'll show you instead.",
];
