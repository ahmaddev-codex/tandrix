// Step actions (T13) against the local stack: gates are stored once, a hazardous step starts only
// after them, the job follows the active step, every change is an event, clients can't write
// confirmations themselves, and two devices acting at once can't both win.
import {
  GenerateProcedureResponse,
  Job,
  JobDetailResponse,
  StepActionResponse,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, api, generator, userFactory, type TestUser } from "./helpers";

const users = userFactory();
const MODEL = `ACT-${users.run}`;
let alice: TestUser;
let job: Job;
let steps: Array<{ id: string }>;

const base = {
  surface: "physical" as const,
  partRefs: [],
  expectedState: "Done.",
  citation: { kind: "generic" as const },
};
const DRAFT: ProcedureDraft = {
  title: "Service",
  parts: [],
  steps: [
    {
      ...base,
      order: 1,
      title: "Open the casing",
      instruction: "Remove the casing bolts.",
      hazardTags: ["electrical_isolation"],
      verification: "user_confirm",
    },
    {
      ...base,
      order: 2,
      title: "Rewire the motor",
      instruction: "Connect the motor leads to the supply.",
      hazardTags: ["live_electrical"],
      verification: "user_confirm",
    },
    {
      ...base,
      order: 3,
      title: "Clean up",
      instruction: "Clear the area.",
      hazardTags: [],
      verification: "user_confirm",
    },
  ],
};

const post = (path: string, body: object) =>
  api(path, alice, { method: "POST", body: JSON.stringify(body) });
const act = async (i: number, body: object) =>
  StepActionResponse.parse(
    await (await post(`/jobs/${job.id}/steps/${steps[i]!.id}/actions`, body)).json(),
  );

beforeAll(async () => {
  alice = await users.make("alice");
  job = Job.parse(
    (
      (await (await post("/jobs", { title: "Actions test", surface: "phone" })).json()) as {
        job: unknown;
      }
    ).job,
  );
  await api(`/jobs/${job.id}/asset`, alice, {
    method: "PUT",
    body: JSON.stringify({
      category: "equipment",
      make: "FlowSet",
      model: MODEL,
      source: "manual",
    }),
  });
  generator.impl = async () => ({ status: "drafted", draft: DRAFT });
  const gen = GenerateProcedureResponse.parse(
    await (await post(`/jobs/${job.id}/procedure`, { allowGeneric: true })).json(),
  );
  if (gen.status !== "created") throw new Error(gen.status);
  steps = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json()).steps;
});

afterAll(async () => {
  await users.cleanup();
  const { error } = await admin
    .from("procedures")
    .delete()
    .like("asset_model_key", `%${MODEL.toLowerCase()}`);
  if (error) throw error;
});

describe("step actions", () => {
  it("starts a hazardous step only after its gate, and the job follows it", async () => {
    expect(await act(0, { action: "start" })).toMatchObject({
      code: "safety_gate_required",
      gates: ["isolate_power"],
    });
    expect(await act(0, { action: "confirm_safety", gate: "isolate_power" })).toMatchObject({
      status: "applied",
    });
    expect(await act(0, { action: "confirm_safety", gate: "isolate_power" })).toMatchObject({
      status: "applied",
    });
    expect(await act(0, { action: "start" })).toMatchObject({
      status: "applied",
      step: { status: "in_progress" },
    });

    const detail = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json());
    expect(detail.job.currentStepId).toBe(steps[0]!.id);
    expect(detail.safetyConfirmations.map((c) => c.gate)).toEqual(["isolate_power"]);

    const { data: events } = await admin
      .from("events")
      .select("type, payload")
      .eq("job_id", job.id)
      .in("type", ["safety_confirmed", "step_status_changed"])
      .order("created_at");
    expect(events!.map((e) => e.type)).toEqual(["safety_confirmed", "step_status_changed"]);
    expect(events![1]!.payload).toMatchObject({ from: "todo", to: "in_progress", action: "start" });
  });

  it("refuses live electrical work", async () => {
    const r = await act(1, { action: "start" });
    expect(r).toMatchObject({ status: "rejected", code: "refused" });
  });

  it("lets only the API write confirmations", async () => {
    const { error } = await alice.db.from("safety_confirmations").insert({
      job_step_id: steps[2]!.id,
      gate: "isolate_power",
      confirmed_by: alice.id,
      surface: "phone",
    });
    expect(error?.code).toBe("42501");
  });

  it("lets one of two simultaneous starts win", async () => {
    const [a, b] = await Promise.all([
      post(`/jobs/${job.id}/steps/${steps[2]!.id}/actions`, { action: "start" }),
      post(`/jobs/${job.id}/steps/${steps[2]!.id}/actions`, { action: "start" }),
    ]);
    const outcomes = await Promise.all(
      [a, b].map(async (r) =>
        r.status === 409 ? "conflict" : StepActionResponse.parse(await r.json()).status,
      ),
    );
    // Either the second request saw the step already started (rejected) or lost the write (409).
    expect(outcomes.filter((o) => o === "applied")).toHaveLength(1);
    const { data } = await admin
      .from("events")
      .select("id")
      .eq("job_id", job.id)
      .eq("type", "step_status_changed")
      .contains("payload", { job_step_id: steps[2]!.id });
    expect(data).toHaveLength(1);
  });
});
