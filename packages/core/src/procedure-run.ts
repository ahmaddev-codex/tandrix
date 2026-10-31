// Waiting for steps being written in the background (POST …/procedure/start, GET …/procedure/run):
// the same on the phone and the Mac. Losing the connection doesn't lose the run, so it keeps asking.
import type { GenerateProcedureResponse, ProcedureRunResponse } from "@tandrix/contracts";

/** How often to ask. Steps take from 20 s to a couple of minutes. */
export const RUN_POLL_MS = 2000;
/** Longer than the API lets a run go on before treating it as lost. */
export const RUN_WAIT_MS = 9 * 60_000;

export const RUN_TOO_LONG = "Writing the steps is taking too long. Try again in a minute.";

export async function waitForProcedure(d: {
  start: () => Promise<ProcedureRunResponse>;
  check: () => Promise<ProcedureRunResponse>;
  /** A dropped connection, which is worth waiting out; anything else is thrown. */
  isOffline: (e: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): Promise<GenerateProcedureResponse> {
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = d.now ?? Date.now;
  const deadline = now() + RUN_WAIT_MS;
  let r = await d.start();
  while (r.status === "writing" || r.status === "idle") {
    if (now() >= deadline) return { status: "unavailable", message: RUN_TOO_LONG };
    await sleep(RUN_POLL_MS);
    try {
      r = await d.check();
    } catch (e) {
      if (!d.isOffline(e)) throw e;
    }
  }
  return r;
}
