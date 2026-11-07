// Show me: one computer-use turn on a screenshot. The model answers in words and proposes actions
// with coordinates in the screenshot's pixels. Nothing here executes anything: callers draw the
// pointer, and only Do it for me (behind the action guard) may act.
import { DesktopAction, MarkKind } from "@tandrix/contracts";
import { z } from "zod";
import { generateStructured } from "./structured";
import { outputText, type MetaClient, type MetaResponse, type ResponseOutputItem } from "./client";
import { text, user, type InputPart } from "./content";
import { prompts } from "./prompts";
import { cleanSpokenReply } from "./reply";

export interface ScreenQuestion {
  screenshot: InputPart;
  question: string;
  /** Short context lines: equipment, current step and its instruction. */
  context?: string[];
  /** A guided lesson: one step at a time with check-ins. */
  lesson?: boolean;
  /** Explain what's on screen (an equation, an error, a chart) rather than point at a control. */
  explain?: boolean;
  /** The screenshot's size, so an outline of nearly all of it can be told from a part. */
  size?: { width: number; height: number };
  /** How hard the model thinks before answering; less is faster. */
  effort?: "none" | "minimal" | "low" | "medium";
  signal?: AbortSignal;
}

export interface ScreenAnswer {
  /** The model's words; empty when it only acted. */
  reply: string;
  /** Actions that match the computer-use protocol, in the order proposed. */
  actions: DesktopAction[];
  /** Proposed actions that didn't match the protocol and were dropped. */
  dropped: number;
  /** Safety checks the model attached; Show me never acknowledges them. */
  safetyChecks: number;
  /** Written beside the annotation, when writing helps (an equation's working, line by line). */
  note?: string;
  /** What the annotation frames, in a few words ("Equation"). */
  label?: string;
  /** Each part marked up: its outline in screenshot pixels, its name and what it does. */
  regions?: ScreenRegion[];
  /** Said before going through the parts one by one. */
  intro?: string;
}

export interface ScreenRegion {
  label: string;
  detail?: string;
  /** Said while this part is marked, in a tour of the parts. */
  say?: string;
  /** A spot clearly on the part, in screenshot pixels: where the pen touches it. */
  point?: { x: number; y: number };
  /** How to mark it. */
  /** For words, code or a formula: the exact text on screen. */
  quote?: string;
  mark?: MarkKind;
  box: { x: number; y: number; w: number; h: number };
}

/**
 * The outlines (drags) and the lines naming them, paired in order: "Skull — protects the brain".
 * An outline that's most of the screen frames nothing, so it's left out.
 */
const Marked = z.object({
  regions: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        detail: z.string().max(160).nullable(),
        say: z.string().max(400).nullable().optional(),
        mark: MarkKind.nullable().optional(),
        quote: z.string().max(400).nullable().optional(),
        point: z
          .object({ x: z.number().min(0).max(1000), y: z.number().min(0).max(1000) })
          .nullable()
          .optional(),
        box: z.object({
          x1: z.number().min(0).max(1000),
          y1: z.number().min(0).max(1000),
          x2: z.number().min(0).max(1000),
          y2: z.number().min(0).max(1000),
        }),
      }),
    )
    .max(8),
  intro: z.string().max(300).nullable().optional(),
});

/** The parts the model marked up, in screenshot pixels; a box over most of the screen frames nothing. */
export function regionsIn(
  marked: z.infer<typeof Marked>,
  size: { width: number; height: number },
): ScreenRegion[] {
  const out: ScreenRegion[] = [];
  for (const r of marked.regions) {
    const x = (Math.min(r.box.x1, r.box.x2) / 1000) * size.width;
    const y = (Math.min(r.box.y1, r.box.y2) / 1000) * size.height;
    const w = (Math.abs(r.box.x2 - r.box.x1) / 1000) * size.width;
    const h = (Math.abs(r.box.y2 - r.box.y1) / 1000) * size.height;
    if (w < 12 || h < 12 || w * h > 0.6 * size.width * size.height) continue;
    const detail = r.detail?.trim();
    const say = r.say?.trim();
    out.push({
      label: r.label.trim(),
      ...(detail ? { detail } : {}),
      ...(say ? { say: cleanSpokenReply(say) } : {}),
      ...(r.mark ? { mark: r.mark } : {}),
      ...(r.quote?.trim() ? { quote: r.quote.trim() } : {}),
      ...(r.point
        ? {
            point: {
              x: Math.round((r.point.x / 1000) * size.width),
              y: Math.round((r.point.y / 1000) * size.height),
            },
          }
        : {}),
      box: { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
    });
  }
  return out.slice(0, 8);
}

export function regionsFrom(
  actions: DesktopAction[],
  named: string,
  size?: { width: number; height: number },
): ScreenRegion[] {
  const lines = named
    .split(/\n+/)
    .map((l) => l.replace(/^[\s*•\d.)-]+/, "").trim())
    .filter(Boolean);
  const drags = actions.filter((a) => a.type === "drag" && a.path.length >= 2);
  const out: ScreenRegion[] = [];
  drags.forEach((d, i) => {
    if (d.type !== "drag") return;
    const p0 = d.path[0]!;
    const p1 = d.path[d.path.length - 1]!;
    const box = {
      x: Math.min(p0.x, p1.x),
      y: Math.min(p0.y, p1.y),
      w: Math.abs(p1.x - p0.x),
      h: Math.abs(p1.y - p0.y),
    };
    if (box.w < 12 || box.h < 12) return;
    if (size && box.w * box.h > 0.6 * size.width * size.height) return;
    const [name, ...what] = (lines[i] ?? "").split(/\s+[—–-]\s+/);
    const label = (name ?? "")
      .replace(/[.:]+$/, "")
      .trim()
      .slice(0, 60);
    const detail = what.join(" — ").trim().slice(0, 160);
    out.push({ label: label || `Part ${i + 1}`, ...(detail ? { detail } : {}), box });
  });
  return out.slice(0, 6);
}

/** Coordinates may come back fractional; the protocol means whole screenshot pixels. */
function roundCoordinates(a: unknown): unknown {
  if (!a || typeof a !== "object") return a;
  const r = (v: unknown) => (typeof v === "number" ? Math.round(v) : v);
  const o = { ...(a as Record<string, unknown>) };
  for (const k of ["x", "y"]) if (k in o) o[k] = r(o[k]);
  if (Array.isArray(o.path))
    o.path = o.path.map((p: unknown) =>
      p && typeof p === "object"
        ? { ...p, x: r((p as { x?: unknown }).x), y: r((p as { y?: unknown }).y) }
        : p,
    );
  return o;
}

function computerCalls(output: ResponseOutputItem[]) {
  return output.filter((o) => o.type === "computer_call");
}

/** Restated next to the question: the model otherwise narrates ("I'll point to…"). */
export const REPLY_RULE =
  'Your text reply is read aloud to the user as the instruction. You may open with two warm words at most ("Got it.", "Sure thing."), then give the instruction itself, in the imperative, naming the control as labelled on screen, for example "Got it. Click Export, then choose PDF." Never describe what you are doing beyond that opener: never "I\'ll point", "let me highlight" or "I will click". Wrong: "I\'ll point to the Apple menu so you can open System Settings." Right: "Click the Apple menu, then System Settings." Plain words only: no code, markup or JSON.';

/** The lesson version: one step, then the check-in. */
export const TEACH_REPLY_RULE =
  'Your text reply is read aloud as the lesson. Give only the single next step: one short explaining sentence at most, then the instruction in the imperative, naming controls as labelled on screen, for example "Docs saves as you type, so there is nothing to do there. Click File, then New. Say next when that is done." End every step with the check-in. You may open with two warm words at most ("Got it.", "Let\'s learn it."). Never describe pointing: no "I\'ll point" or "let me highlight". Plain words only: no code, markup or JSON.';

/** The explanation version: teach what's on screen, in words that sound right aloud. */
export const EXPLAIN_REPLY_RULE =
  'Your text reply is read aloud. Explain it the way an expert tutor in this subject would, pitched to the person (plain words and an analogy for a beginner, precise terms for someone advanced): what it is, what each part means, and, for a problem, equation or piece of code, how to work it out or what it does, step by step. Four to eight short sentences, no more, stating each step plainly (never "I am sure" or "I think"). Then, only when writing helps the user follow (the working of an equation, a formula, a short list of steps), add a new line starting "WRITE:" with what to show on screen beside it: at most six short lines, one step per line, written the way a person writes it ("3(x − 2) + 4 = 2x + 9", "x = 11"). Otherwise leave WRITE out. Say symbols as words ("x squared", "divided by", "the square root of"). Start with the explanation itself, no opener. Never describe pointing. Plain words only: no code, markup, LaTeX or JSON.';

/**
 * Show me's answer usually starts within 2–4 s of asking and is complete about a second later; one
 * that hasn't started by 4.5 s is asked again, and whichever starts first is used.
 */
export const SHOW_FIRST_BYTE_MS = 4500;

/** The parts of an explanation, asked again when the first call hasn't answered by then. */
export const REGIONS_HEDGE_MS = 16_000;

export async function askScreen(
  client: MetaClient,
  model: string,
  q: ScreenQuestion,
): Promise<ScreenAnswer> {
  const context = q.context?.filter(Boolean).join("\n");
  const rule = q.explain ? EXPLAIN_REPLY_RULE : q.lesson ? TEACH_REPLY_RULE : REPLY_RULE;
  const asked = text(`${context ? `${context}\n\n` : ""}The user asks: ${q.question}\n\n${rule}`);
  // Given the computer tool, the model treats a lesson or an explanation as the start of a job: it
  // points, says what it's about to do ("I'll walk you through it step by step") and stops,
  // waiting for a turn that never comes. So the words come from a call without the tool, which
  // has to answer in full; a lesson still points, from a computer-use call alongside.
  const words =
    q.explain || q.lesson
      ? client.respondStreamed(
          {
            model,
            instructions: q.explain ? prompts.explainScreen : prompts.teachMeWords,
            // Working through an equation needs a little thought; minimal gets the maths wrong.
            reasoning: { effort: q.explain ? "low" : "minimal" },
            input: [user(asked, q.screenshot)],
          },
          q.signal,
          SHOW_FIRST_BYTE_MS,
        )
      : null;
  // An explanation marks up what it's about: each part framed and named. (Asked of the computer
  // tool, the model wanted a screenshot first and outlined nothing, so the boxes are asked for as
  // data, as the phone's camera answers are.)
  const marking =
    q.explain && q.size
      ? generateStructured(client, {
          model,
          name: "screen_regions",
          schema: Marked,
          instructions: prompts.outlineScreen,
          input: [user(text(`The user asks: ${q.question}`), q.screenshot)],
          // Which parts, and roughly where: each is then clicked and drawn from the screenshot's own
          // pixels, so no thinking time goes on placing them exactly.
          effort: "minimal",
          // It usually answers in 10–14 s; one stuck call (76 s on the marking bench) is asked
          // again rather than waited out.
          hedgeMs: REGIONS_HEDGE_MS,
          ...(q.signal ? { signal: q.signal } : {}),
        })
          .catch(() => null)
          // Each part is clicked afterwards (refine.ts, POST /screen/locate), while Tandrix is
          // already speaking: the answer doesn't wait for it.
          .then((m) =>
            m?.ok && q.size
              ? { intro: m.data.intro ?? null, regions: regionsIn(m.data, q.size) }
              : null,
          )
      : null;
  const pointing: Promise<MetaResponse> | null = q.explain
    ? null
    : client.respondStreamed(
        {
          model,
          instructions: q.lesson ? prompts.teachMe : prompts.showMe,
          tools: [{ type: "computer" }],
          // Minimal is as accurate on the pointing bench (fixtures/screens) and seconds faster.
          reasoning: { effort: q.effort ?? "minimal" },
          input: [user(asked, q.screenshot)],
        },
        q.signal,
        SHOW_FIRST_BYTE_MS,
      );
  // The pointer or marks are a bonus for a lesson or an explanation: if they fail, the words help.
  const [said, res, marked] = await Promise.all([
    words,
    pointing && words ? pointing.catch(() => null) : pointing,
    marking,
  ]);
  if (said) {
    const actions = res ? pointsIn(res).actions : [];
    const { spoken, written } = splitWritten(outputText(said));
    const regions = marked?.regions ?? [];
    const label = regions[0]?.label ?? "";
    return {
      reply: cleanSpokenReply(spoken),
      actions,
      dropped: 0,
      safetyChecks: 0,
      ...(written ? { note: written } : {}),
      ...(label && label.split(/\s+/).length <= 4 ? { label } : {}),
      ...(regions.length ? { regions } : {}),
      ...(marked?.intro ? { intro: cleanSpokenReply(marked.intro) } : {}),
    };
  }
  return finishAnswer(client, model, q, res!);
}

/**
 * An explanation's words, and what it wrote to show beside the annotation ("WRITE:"): the
 * written lines stay lines, without markup.
 */
export function splitWritten(raw: string): { spoken: string; written: string | null } {
  const m = /^([\s\S]*?)\n?\s*WRITE:\s*([\s\S]*)$/i.exec(raw);
  if (!m) return { spoken: raw, written: null };
  const written = m[2]!
    .split("\n")
    .map((l) => l.replace(/^[\s*•-]+|[`$]/g, "").trim())
    .filter(Boolean)
    .slice(0, 6)
    .join("\n")
    .slice(0, 600);
  return { spoken: m[1]!.trim(), written: written || null };
}

/** The pointing actions a computer-use response proposed, kept to those in the protocol. */
function pointsIn(res: MetaResponse): {
  actions: DesktopAction[];
  dropped: number;
  safetyChecks: number;
} {
  const actions: DesktopAction[] = [];
  let dropped = 0;
  let safetyChecks = 0;
  for (const call of computerCalls(res.output)) {
    const raw = Array.isArray(call.actions) ? call.actions : call.action ? [call.action] : [];
    for (const a of raw) {
      const parsed = DesktopAction.safeParse(roundCoordinates(a));
      if (parsed.success) actions.push(parsed.data);
      else dropped++;
    }
    if (Array.isArray(call.pending_safety_checks))
      safetyChecks += call.pending_safety_checks.length;
  }
  return { actions, dropped, safetyChecks };
}

/** A plain Show me answer: the instruction, rewritten when the model narrates instead. */
async function finishAnswer(
  client: MetaClient,
  model: string,
  q: ScreenQuestion,
  res: MetaResponse,
): Promise<ScreenAnswer> {
  const { actions, dropped, safetyChecks } = pointsIn(res);
  // What the user hears: never tool-call markup, code or JSON the model let slip, and never
  // narration of what Tandrix is doing.
  let reply = cleanSpokenReply(outputText(res));
  // Asked where to click, the model said it would teach ("I'll drag the functional group part to
  // walk you through what you're seeing"): the user wanted it understood, not clicked. Explain it.
  if (!q.lesson && !q.explain && wantsTeaching(reply))
    return askScreen(client, model, { ...q, explain: true });
  // Only a plain Show me answer is an instruction to rewrite: a lesson or an explanation says more,
  // and a mechanical rewrite of it came out as "Click that to walk you through the step".
  if (!q.lesson && !q.explain && narrates(reply)) {
    // Most narration has one shape, rewritten here in no time; the rest takes a small call.
    reply =
      unnarrate(reply, actions[0]) ??
      (await asInstruction(client, model, reply, q).catch(() => reply));
  }
  return { reply, actions, dropped, safetyChecks };
}

/** The pointing model announcing a lesson or explanation instead of giving a control. */
export const wantsTeaching = (reply: string) =>
  /\b(walk (you|them) through|go through (it|this|them|these|each)|explain|break (it|this) down|teach you|help you understand|what you'?re (seeing|looking at))\b/i.test(
    reply,
  );

/** "I'll highlight the storage button so you can…": the model describing itself. */
export const narrates = (reply: string) =>
  /\b(I['’]ll|I will|I['’]m going to|I am going to|let me|I['’]m pointing|I am pointing)\b/i.test(
    reply,
  );

const NARRATION =
  /^(?:I['’]ll|I will|let me|I['’]m going to|I am going to|I['’]m|I am)\s+(?:point(?:ing)? (?:you )?(?:to|at|out|toward|towards)|point(?:ing)? out|highlight(?:ing)?|show(?:ing)? you(?: where)?|direct(?:ing)? you to|guid(?:e|ing) you to|tak(?:e|ing) you to|indicat(?:e|ing)|mov(?:e|ing) (?:the|my) pointer (?:to|over)|click(?:ing)?(?: on)?|select(?:ing)?|press(?:ing)?)\s+(.+?)(?:\s+(?:is|are))?(?:\s+for you)?(?:\s+(?:so (?:that )?you can|so you could|for you to|to help you)\s+(.+?))?[.!]?$/i;

const VERB: Partial<Record<DesktopAction["type"], string>> = {
  double_click: "Double-click",
  drag: "Drag",
  scroll: "Scroll",
};

/**
 * "I'll point to the Archive button so you can file this email." → "Click the Archive button to
 * file this email." One sentence in that shape only; null for anything else.
 */
export function unnarrate(reply: string, action?: DesktopAction): string | null {
  const said = reply.trim().replace(/^(?:got it|sure thing|sure|okay|ok)[.!,]?\s+/i, "");
  // The narrating sentence comes first; what follows it is kept when it's plain instruction.
  const [first, ...rest] = said.split(/(?<=[.!?])\s+(?=\S)/);
  const m = NARRATION.exec(first ?? "");
  const after = rest.join(" ");
  if (!m || narrates(after)) return null;
  const verb = (action && VERB[action.type]) ?? "Click";
  const control = m[1]!.replace(/[,;]$/, "").replace(/^(?:where\s+)/i, "");
  // "that", "this", "it" name no control: the user would hear "Click that".
  if (/^(?:that|this|it|here|there|them|those|these|you|out)\b/i.test(control)) return null;
  const why = m[2]?.replace(/[.!]$/, "");
  return `${verb} ${control}${why ? ` to ${why}` : ""}.${after ? ` ${after}` : ""}`;
}

/**
 * Rewrites narration as the instruction itself, with a small text-only call: the narration names
 * the control already. The computer-use model narrates despite the prompt; the user should hear
 * what to do.
 */
async function asInstruction(
  client: MetaClient,
  model: string,
  reply: string,
  q: ScreenQuestion,
): Promise<string> {
  const res = await client.respond(
    {
      model,
      instructions: prompts.asInstruction,
      input: [user(text(`The user asked: ${q.question}\nThe assistant said: ${reply}`))],
      reasoning: { effort: "minimal" },
    },
    q.signal,
  );
  const out = cleanSpokenReply(outputText(res));
  return out && !narrates(out) ? out : reply;
}
