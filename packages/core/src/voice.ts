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
  const t = normalize(text);
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
