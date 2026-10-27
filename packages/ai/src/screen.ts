// Show me: one computer-use turn on a screenshot. The model answers in words and proposes actions
// with coordinates in the screenshot's pixels. Nothing here executes anything: callers draw the
// pointer, and only Do it for me (behind the action guard) may act.
import { DesktopAction } from "@tandrix/contracts";
import { outputText, type MetaClient, type ResponseOutputItem } from "./client";
import { text, user, type InputPart } from "./content";
import { prompts } from "./prompts";
import { cleanSpokenReply } from "./reply";

export interface ScreenQuestion {
  screenshot: InputPart;
  question: string;
  /** Short context lines: equipment, current step and its instruction. */
  context?: string[];
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
  'Your text reply is read aloud to the user as the instruction. Write it as the instruction itself, in the imperative, naming the control as labelled on screen, for example "Click Export, then choose PDF." Never describe what you are doing, never "I\'ll" or "Got it". Wrong: "I\'ll point to the Apple menu so you can open System Settings." Right: "Click the Apple menu, then System Settings." Plain words only: no code, markup or JSON.';

export async function askScreen(
  client: MetaClient,
  model: string,
  q: ScreenQuestion,
): Promise<ScreenAnswer> {
  const context = q.context?.filter(Boolean).join("\n");
  const res = await client.respond(
    {
      model,
      instructions: prompts.showMe,
      tools: [{ type: "computer" }],
      input: [
        user(
          text(`${context ? `${context}\n\n` : ""}The user asks: ${q.question}\n\n${REPLY_RULE}`),
          q.screenshot,
        ),
      ],
    },
    q.signal,
  );
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
  // What the user hears: never tool-call markup, code or JSON the model let slip, and never
  // narration of what Tandrix is doing.
  let reply = cleanSpokenReply(outputText(res));
  if (narrates(reply)) {
    const at = actions.find((a) => "x" in a && "y" in a) as { x: number; y: number } | undefined;
    reply = await asInstruction(client, model, reply, q, at).catch(() => reply);
  }
  return { reply, actions, dropped, safetyChecks };
}

/** "I'll highlight the storage button so you can…": the model describing itself. */
export const narrates = (reply: string) =>
  /\b(I['’]ll|I will|I['’]m going to|I am going to|let me|I['’]m pointing|I am pointing)\b/i.test(
    reply,
  );

/**
 * Rewrites narration as the instruction itself, with a small text-only call. The computer-use
 * model narrates despite the prompt; the user should hear what to do.
 */
async function asInstruction(
  client: MetaClient,
  model: string,
  reply: string,
  q: ScreenQuestion,
  at?: { x: number; y: number },
): Promise<string> {
  // With the screen, so controls keep their names as labelled there.
  const where = at ? ` The pointer is on the control at (${at.x}, ${at.y}) in the screenshot.` : "";
  const res = await client.respond(
    {
      model,
      instructions: prompts.asInstruction,
      input: [
        user(
          text(`The user asked: ${q.question}\nThe assistant said: ${reply}${where}`),
          q.screenshot,
        ),
      ],
      reasoning: { effort: "low" },
    },
    q.signal,
  );
  const out = cleanSpokenReply(outputText(res));
  return out && !narrates(out) ? out : reply;
}
