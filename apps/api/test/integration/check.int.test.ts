// Step check by photo (T15) against the local stack: the check and the step's new status are
// saved together with their events, and verified always points at the photo that passed.
import {
  CheckStepResponse,
  CreateEvidenceResponse,
  GenerateProcedureResponse,
  Job,
  JobDetailResponse,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PNG } from "../fixtures";
import { admin, api, config, generator, stepChecker, userFactory, type TestUser } from "./helpers";

const users = userFactory();
const MODEL = `CHK-${users.run}`;
let alice: TestUser;
let job: Job;
let stepId: string;

const DRAFT: ProcedureDraft = {
  title: "Fit",
  parts: [],
  steps: [
    {
      order: 1,
      surface: "physical",
      title: "Fit the impeller",
      instruction: "Slide it on.",
      partRefs: [],
      hazardTags: [],
      verification: "photo",
      expectedState: "Seated.",
      citation: { kind: "generic" },
    },
  ],
};

const post = (path: string, body: object) =>
  api(path, alice, { method: "POST", body: JSON.stringify(body) });

async function uploadPhoto() {
  const created = CreateEvidenceResponse.parse(
    await (
      await post(`/jobs/${job.id}/evidence`, {
        kind: "photo",
        mimeType: "image/png",
        byteSize: PNG.length,
        surface: "phone",
        width: 1,
        height: 1,
        jobStepId: stepId,
        capturedAt: new Date().toISOString(),
      })
    ).json(),
  );
  const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false },
  });
  const up = await anon.storage
    .from("evidence")
    .uploadToSignedUrl(created.upload.path, created.upload.token, PNG, {
      contentType: "image/png",
    });
  if (up.error) throw up.error;
  await post(`/jobs/${job.id}/evidence/${created.evidence.id}/complete`, {});
  return created.evidence.id;
}

beforeAll(async () => {
  alice = await users.make("alice");
  job = Job.parse(
    (
      (await (await post("/jobs", { title: "Check test", surface: "phone" })).json()) as {
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
  stepId = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json()).steps[0]!.id;
  await post(`/jobs/${job.id}/steps/${stepId}/actions`, { action: "start" });
});

afterAll(async () => {
  const { data } = await admin.storage.from("evidence").list(`${alice.id}/${job.id}`);
  if (data?.length)
    await admin.storage.from("evidence").remove(data.map((f) => `${alice.id}/${job.id}/${f.name}`));
  await users.cleanup();
  const { error } = await admin
    .from("procedures")
    .delete()
    .like("asset_model_key", `%${MODEL.toLowerCase()}`);
  if (error) throw error;
});

describe("check", () => {
  it("records a failed check, then a pass that verifies the step on its photo", async () => {
    stepChecker.impl = async () => ({
      status: "judged",
      result: "fail",
      reason: "Gap at the shoulder.",
    });
    const fail = CheckStepResponse.parse(
      await (
        await post(`/jobs/${job.id}/steps/${stepId}/check`, { evidenceId: await uploadPhoto() })
      ).json(),
    );
    expect(fail).toMatchObject({ status: "checked", step: { status: "needs_attention" } });

    stepChecker.impl = async () => ({ status: "judged", result: "pass", reason: "Seated." });
    const photo = await uploadPhoto();
    const pass = CheckStepResponse.parse(
      await (await post(`/jobs/${job.id}/steps/${stepId}/check`, { evidenceId: photo })).json(),
    );
    expect(pass).toMatchObject({
      status: "checked",
      step: { status: "verified", statusEvidenceId: photo },
    });

    const { data: checks } = await admin
      .from("checks")
      .select("result")
      .eq("job_step_id", stepId)
      .order("created_at");
    expect(checks!.map((c) => c.result)).toEqual(["fail", "pass"]);
    const { data: events } = await admin
      .from("events")
      .select("type")
      .eq("job_id", job.id)
      .in("type", ["check_recorded", "step_status_changed"])
      .order("created_at");
    // start, then each check: a status change and its check record.
    expect(events!.map((e) => e.type)).toEqual([
      "step_status_changed",
      "step_status_changed",
      "check_recorded",
      "step_status_changed",
      "check_recorded",
    ]);
  });
});
