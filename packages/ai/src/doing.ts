// Do it for me: the computer-use loop (Meta's computer-use guide). The model proposes a batch of
// actions for the screen it was shown; the Mac runs them through the action guard, takes a fresh
// screenshot, and sends it back with the call it answers; the turn ends when the model stops
// proposing actions. Turns are chained with previous_response_id, so the model's side of the
// session is stored by the API for the length of the task. Nothing here executes anything.
import { DesktopAction, TaskPlan } from "@tandrix/contracts";
import { z } from "zod";
import type { Models } from "./pipelines";
import { generateStructured } from "./structured";
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

/** How hard each turn thinks: low plans multi-app tasks right (task-bench 3 of 3). */
const TURN_EFFORT = "low";
/**
 * A turn slower than this is asked again, and the first answer used. (Turns are stored so the next
 * can continue them, and the API won't stream a stored computer-use call, so the hedge is on the
 * whole answer, not its first byte as Show me's is.)
 */
const TURN_HEDGE_MS = 10_000;

/** A control the Mac read from the front app (SP5): role, name, where in the screenshot. */
export interface NamedControl {
  role: string;
  name: string;
  enabled: boolean;
  box: { x: number; y: number; w: number; h: number };
}

/**
 * The front window's controls as one context block for the model: so it can find its target by
 * name and aim at the middle of it. Unnamed controls and duplicates are left out; at most 80.
 */
export function controlsLine(controls: NamedControl[]): string | null {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const c of controls) {
    const name = c.name.replace(/["\n]/g, " ").replace(/\s+/g, " ").trim();
    if (!name && !/Text(Field|Area)|SearchField/.test(c.role)) continue;
    const key = `${c.role}|${name}|${c.box.x}|${c.box.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mid = `${c.box.x + Math.floor(c.box.w / 2)},${c.box.y + Math.floor(c.box.h / 2)}`;
    lines.push(
      `- ${c.role}${name ? ` "${name}"` : ""} centre ${mid}, ${c.box.w}x${c.box.h}${c.enabled ? "" : " (dimmed)"}`,
    );
    if (lines.length >= 80) break;
  }
  return lines.length
    ? `Controls in the front window, from the app itself (screenshot pixels). Aim at a control's centre:\n${lines.join("\n")}`
    : null;
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
  const res = await client.respondHedged(
    {
      model,
      store: true,
      instructions: prompts.doItForMe,
      tools: [{ type: "computer" }],
      reasoning: { effort: TURN_EFFORT },
      input: [
        user(
          text(`${context ? `${context}\n\n` : ""}Do this for the user: ${q.task}`),
          q.screenshot,
        ),
      ],
    },
    q.signal,
    TURN_HEDGE_MS,
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
  const res = await client.respondHedged(
    {
      model,
      store: true,
      previous_response_id: c.previousResponseId,
      tools: [{ type: "computer" }],
      reasoning: { effort: TURN_EFFORT },
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
    TURN_HEDGE_MS,
  );
  return readTurn(res);
}

/**
 * Before the first step: which app the task needs. Opening it directly is quicker and steadier
 * than finding it on screen. Null when the app in front will do.
 */
const ScreenNote = z.object({ note: z.string().max(1200).nullable() });

/** Writes down what a screen holds that the task needs, before the task leaves it. */
export function noteScreen(
  client: MetaClient,
  models: Models,
  q: { task: string; screenshot: InputPart; signal?: AbortSignal },
) {
  return generateStructured(client, {
    model: models.reasoning,
    name: "screen_note",
    schema: ScreenNote,
    instructions: prompts.noteScreen,
    input: [user(text(`Task: ${q.task}`), q.screenshot)],
    effort: "low",
    ...(q.signal ? { signal: q.signal } : {}),
  });
}

export function planTask(
  client: MetaClient,
  models: Models,
  q: { task: string; frontApp?: string; apps: string[]; signal?: AbortSignal },
) {
  return generateStructured(client, {
    model: models.reasoning,
    name: "task_plan",
    schema: TaskPlan,
    instructions: prompts.planTask,
    input: [
      user(
        text(
          `Task: ${q.task}\nApp in front: ${q.frontApp ?? "unknown"}\nInstalled apps:\n${q.apps.join("\n")}`,
        ),
      ),
    ],
    effort: "low",
    ...(q.signal ? { signal: q.signal } : {}),
  });
}
