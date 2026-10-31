// A background task, start to finish: the model works on it, asking the Mac to run tools (a
// calendar event, a note, a page in Tandrix's own browser) without touching the screen, mouse or
// keyboard, until it answers. Several run at once, alongside whatever is on the screen.
import type {
  AgentCall,
  AgentStep,
  BackgroundRequest,
  BackgroundResponse,
} from "@tandrix/contracts";

/** How many rounds of tools one task may take before it must answer with what it has. */
export const MAX_ROUNDS = 8;

export type BackgroundResult = Exclude<BackgroundResponse, { status: "call" }>;

export interface BackgroundDeps {
  ask(body: BackgroundRequest): Promise<BackgroundResponse>;
  runTool(call: AgentCall): Promise<string>;
  /** The Mac's local time with its offset, e.g. 2026-10-30T09:05+01:00. */
  now(): string;
  /** A tool is about to run (for the task list). */
  onTool?(call: AgentCall): void;
}

export async function runBackgroundTask(
  task: string,
  d: BackgroundDeps,
): Promise<BackgroundResult> {
  const steps: AgentStep[] = [];
  for (let round = 0; round <= MAX_ROUNDS; round++) {
    const r = await d.ask({ task, tools: true, steps, now: d.now() });
    if (r.status !== "call") return r;
    // One after another: a later call may depend on an earlier one (find a time, then book it).
    for (const call of r.calls) {
      d.onTool?.(call);
      const output = await d.runTool(call).catch((e: Error) => `Couldn't do it: ${e.message}`);
      steps.push({ ...call, output: output.slice(0, 8000) });
    }
  }
  return {
    status: "unavailable",
    message:
      "That took more steps than Tandrix takes in the background. Try asking for less at once.",
  };
}

/** Local time with its UTC offset, minute precision. */
export function localNow(at = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -at.getTimezoneOffset();
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}${off >= 0 ? "+" : "-"}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}
