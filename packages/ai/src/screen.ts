// Show me: one computer-use turn on a screenshot. The model answers in words and proposes actions
// with coordinates in the screenshot's pixels. Nothing here executes anything: callers draw the
// pointer, and only Do it for me (behind the action guard) may act.
import { DesktopAction } from "@tandrix/contracts";
import { outputText, type MetaClient, type ResponseOutputItem } from "./client";
import { text, user, type InputPart } from "./content";
import { prompts } from "./prompts";

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
        user(text(`${context ? `${context}\n\n` : ""}The user asks: ${q.question}`), q.screenshot),
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
  return { reply: outputText(res).trim(), actions, dropped, safetyChecks };
}
