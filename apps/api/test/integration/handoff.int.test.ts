// Handoff (T22) against the local stack: the job moves to the Mac at a step with an event, and
// the owner's other device hears it over Realtime within the 3 s budget; nobody else does.
import {
  GenerateProcedureResponse,
  HandoffResponse,
  Job,
  JobDetailResponse,
  type ProcedureDraft,
} from "@tandrix/contracts";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, api, generator, userFactory, type TestUser } from "./helpers";

const users = userFactory();
let alice: TestUser;
let bob: TestUser;
let job: Job;
let stepIds: string[];

const DRAFT: ProcedureDraft = {
  title: "Commission",
  parts: [],
  steps: [1, 2].map((order) => ({
    order,
    surface: order === 2 ? "desktop" : "physical",
    title: order === 2 ? "Set the ramp time" : "Fit the impeller",
    instruction: "Do it.",
    partRefs: [],
    hazardTags: [],
    verification: order === 2 ? "screen" : "user_confirm",
    expectedState: "Done.",
    citation: { kind: "generic" },
  })),
};

const post = (path: string, body: object, user: TestUser = alice) =>
  api(path, user, { method: "POST", body: JSON.stringify(body) });

/** The first update to the job a client sees over Realtime with the job on the Mac, or null. */
function nextJobUpdate(user: TestUser, timeoutMs: number) {
  let channel: RealtimeChannel | undefined;
  const ready = new Promise<void>((resolve, reject) => {
    channel = user.db
      .channel(`job-${job.id}-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${job.id}` },
        (p) => {
          const row = p.new as Record<string, unknown>;
          // Earlier changes from setting the job up can still arrive; wait for the handoff.
          if (row.active_surface === "desktop") received(row);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") reject(new Error(status));
      });
  });
  let received: (row: Record<string, unknown>) => void = () => {};
  const update = new Promise<Record<string, unknown> | null>((resolve) => {
    received = resolve;
    setTimeout(() => resolve(null), timeoutMs);
  });
  return {
    ready,
    update: update.finally(() => channel && void user.db.removeChannel(channel)),
  };
}

beforeAll(async () => {
  alice = await users.make("alice");
  bob = await users.make("bob");
  job = Job.parse(
    (
      (await (await post("/jobs", { title: "Handoff test", surface: "phone" })).json()) as {
        job: unknown;
      }
    ).job,
  );
  await api(`/jobs/${job.id}/asset`, alice, {
    method: "PUT",
    body: JSON.stringify({ make: "FlowSet", model: `HO-${users.run}`, source: "manual" }),
  });
  generator.impl = async () => ({ status: "drafted", draft: DRAFT });
  const gen = GenerateProcedureResponse.parse(
    await (await post(`/jobs/${job.id}/procedure`, { allowGeneric: true })).json(),
  );
  if (gen.status !== "created") throw new Error(gen.status);
  const detail = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json());
  stepIds = detail.steps.map((s) => s.id);
});
afterAll(() => users.cleanup());

describe("handoff", () => {
  it("moves the job to the Mac at the step, and the owner's devices hear it in time", async () => {
    const mac = nextJobUpdate(alice, 5000);
    const stranger = nextJobUpdate(bob, 5000);
    await Promise.all([mac.ready, stranger.ready]);
    // Realtime reports SUBSCRIBED before its change feed for the channel is live.
    await new Promise((r) => setTimeout(r, 1000));

    const started = Date.now();
    const res = await post(`/jobs/${job.id}/handoff`, { to: "desktop", stepId: stepIds[1] });
    expect(res.status).toBe(200);
    expect(HandoffResponse.parse(await res.json()).job).toMatchObject({
      activeSurface: "desktop",
      currentStepId: stepIds[1],
    });

    const row = await mac.update;
    expect(row).toMatchObject({ active_surface: "desktop", current_step_id: stepIds[1] });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(await stranger.update).toBeNull();

    const { data } = await admin
      .from("events")
      .select("type, surface, payload")
      .eq("job_id", job.id)
      .eq("type", "handoff");
    expect(data).toEqual([
      {
        type: "handoff",
        surface: "phone",
        payload: { from: "phone", to: "desktop", job_step_id: stepIds[1] },
      },
    ]);
  });

  it("refuses a step from another job and another user's job", async () => {
    const other = Job.parse(
      (
        (await (await post("/jobs", { title: "Other", surface: "phone" }, bob)).json()) as {
          job: unknown;
        }
      ).job,
    );
    expect(
      (await post(`/jobs/${job.id}/handoff`, { to: "desktop", stepId: other.id })).status,
    ).toBe(404);
    expect((await post(`/jobs/${other.id}/handoff`, { to: "desktop" })).status).toBe(404);
  });
});
