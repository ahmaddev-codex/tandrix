// Do it for me: the computer-use loop (Meta's computer-use guide). The model proposes a batch of
// actions for the screen it was shown; the Mac runs them through the action guard, takes a fresh
// screenshot, and sends it back with the call it answers; the turn ends when the model stops
// proposing actions. Turns are chained with previous_response_id, so the model's side of the
// session is stored by the API for the length of the task. Nothing here executes anything.
import { DesktopAction } from "@tandrix/contracts";
import { outputText, type MetaClient, type MetaResponse } from "./client";
import { text, user, type InputPart } from "./content";
import { prompts } from "./prompts";
import { cleanSpokenReply } from "./reply";

export interface SafetyCheck {
  id: string;
  code: string;
  message: string;
}

export interface DoTurn {
  /** The response to continue from. */
  responseId: string;
  /** The call to answer with the next screenshot; null when the task is finished. */
  callId: string | null;
  actions: DesktopAction[];
  /** Proposed actions that didn't match the protocol and were dropped. */
  dropped: number;
  /** Checks the model wants the user to accept before this batch runs. */
  safetyChecks: SafetyCheck[];
  /** What the model said: progress, the final answer, or why it can't. */
  reply: string;
}

const roundXY = (a: unknown): unknown => {
  if (!a || typeof a !== "object") return a;
  const o = { ...(a as Record<string, unknown>) };
  for (const k of ["x", "y"]) if (typeof o[k] === "number") o[k] = Math.round(o[k] as number);
  if (Array.isArray(o.path))
    o.path = o.path.map((p: Record<string, unknown>) => ({
      x: Math.round(Number(p.x)),
      y: Math.round(Number(p.y)),
    }));
  return o;
};

/** Reads the first computer call (the guide handles one per response) and the model's words. */
export function readTurn(res: MetaResponse): DoTurn {
  const call = res.output.find((o) => o.type === "computer_call");
  const actions: DesktopAction[] = [];
  let dropped = 0;
  const raw = call
    ? Array.isArray(call.actions)
      ? (call.actions as unknown[])
      : call.action
        ? [call.action]
        : []
    : [];
  for (const a of raw) {
    const p = DesktopAction.safeParse(roundXY(a));
    if (p.success) actions.push(p.data);
    else dropped++;
  }
  const checks = Array.isArray(call?.pending_safety_checks)
    ? (call.pending_safety_checks as SafetyCheck[]).filter(
        (c) => c && typeof c.id === "string" && typeof c.code === "string",
      )
    : [];
  return {
    responseId: res.id,
    callId: call && typeof call.call_id === "string" ? call.call_id : null,
    actions,
    dropped,
    safetyChecks: checks.map((c) => ({
      id: c.id,
      code: c.code,
      message: String(c.message ?? ""),
    })),
    reply: cleanSpokenReply(outputText(res)),
  };
}

export interface DoStart {
  screenshot: InputPart;
  /** What the user asked Tandrix to do. */
  task: string;
  context?: string[];
  signal?: AbortSignal;
}

export async function startDoing(client: MetaClient, model: string, q: DoStart): Promise<DoTurn> {
  const context = q.context?.filter(Boolean).join("\n");
  const res = await client.respond(
    {
      model,
      store: true,
      instructions: prompts.doItForMe,
      tools: [{ type: "computer" }],
      input: [
        user(
          text(`${context ? `${context}\n\n` : ""}Do this for the user: ${q.task}`),
          q.screenshot,
        ),
      ],
    },
    q.signal,
  );
  return readTurn(res);
}

export interface DoContinue {
  previousResponseId: string;
  callId: string;
  /** The screen after the last batch, as a data URL (PNG or JPEG). */
  screenshotDataUrl: string;
  /** Safety checks the user accepted for the batch just run. */
  acknowledged: SafetyCheck[];
  signal?: AbortSignal;
}

export async function continueDoing(
  client: MetaClient,
  model: string,
  c: DoContinue,
): Promise<DoTurn> {
  const res = await client.respond(
    {
      model,
      store: true,
      previous_response_id: c.previousResponseId,
      tools: [{ type: "computer" }],
      input: [
        {
          type: "computer_call_output",
          call_id: c.callId,
          acknowledged_safety_checks: c.acknowledged,
          output: { type: "computer_screenshot", image_url: c.screenshotDataUrl },
        },
      ],
    },
    c.signal,
  );
  return readTurn(res);
}
