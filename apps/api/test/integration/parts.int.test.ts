// Parts check (T16) against the local stack: the check, its detections and the blocks it places
// are saved together; a correction lifts only the parts blocks; skipping a blocked step clears why
// it was blocked.
import {
  CorrectPartResponse,
  CreateEvidenceResponse,
  GenerateProcedureResponse,
  Job,
  JobDetailResponse,
  PartsCheckResponse,
  StepActionResponse,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PNG } from "../fixtures";
import { admin, api, config, generator, partsChecker, userFactory, type TestUser } from "./helpers";

const users = userFactory();
const MODEL = `PRT-${users.run}`;
let alice: TestUser;
let job: Job;
let steps: Array<{ id: string }>;

const step = (
  order: number,
  title: string,
  partRefs: string[],
): ProcedureDraft["steps"][number] => ({
  order,
  surface: "physical",
  title,
  instruction: title,
  partRefs,
  hazardTags: [],
  verification: "user_confirm",
  expectedState: "Done.",
  citation: { kind: "generic" },
});
const DRAFT: ProcedureDraft = {
  title: "Assemble",
  parts: [
    { ref: "P1", name: "Impeller", qty: 1 },
    { ref: "P2", name: "O-ring", qty: 1 },
  ],
  steps: [
    step(1, "Fit the impeller", ["P1"]),
    step(2, "Seat the O-ring", ["P2"]),
    step(3, "Close up", ["P2"]),
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
        width: 100,
        height: 80,
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

const detail = async () =>
  JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json());

beforeAll(async () => {
  alice = await users.make("alice");
  job = Job.parse(
    (
      (await (await post("/jobs", { title: "Parts test", surface: "phone" })).json()) as {
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
  steps = (await detail()).steps;
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

describe("parts check", () => {
  let checkId: string;
  let oring: string;

  it("saves the check and its detections, and blocks the steps missing a part", async () => {
    partsChecker.impl = async ({ parts }) => ({
      status: "checked",
      results: [
        {
          partSpecId: parts[0]!.id,
          status: "found",
          boxes: [{ box: { x: 10, y: 10, w: 30, h: 20 }, confidence: 0.9 }],
        },
        { partSpecId: parts[1]!.id, status: "missing", boxes: [] },
      ],
    });
    const r = PartsCheckResponse.parse(
      await (await post(`/jobs/${job.id}/parts-check`, { evidenceId: await uploadPhoto() })).json(),
    );
    if (r.status !== "checked") throw new Error(r.status);
    checkId = r.partsCheck.id;
    oring = r.partsCheck.results[1]!.partSpecId;
    expect(r.detections).toHaveLength(1);

    const d = await detail();
    expect(d.partsCheck?.id).toBe(checkId);
    expect(d.steps.map((s) => [s.status, s.blockedBy ?? null, s.note ?? null])).toEqual([
      ["todo", null, null],
      ["blocked", "parts", "Missing part: O-ring"],
      ["blocked", "parts", "Missing part: O-ring"],
    ]);
    const { data: dets } = await admin
      .from("detections")
      .select("label")
      .in("id", r.partsCheck.results[0]!.detectionIds);
    expect(dets).toEqual([{ label: "Impeller" }]);
  });

  it("skipping a blocked step clears why it was blocked", async () => {
    const r = StepActionResponse.parse(
      await (
        await post(`/jobs/${job.id}/steps/${steps[2]!.id}/actions`, {
          action: "skip",
          reason: "Closing later",
        })
      ).json(),
    );
    expect(r).toMatchObject({ status: "applied", step: { status: "skipped" } });
    const { data } = await admin
      .from("job_steps")
      .select("blocked_by")
      .eq("id", steps[2]!.id)
      .single();
    expect(data!.blocked_by).toBeNull();
  });

  it("a correction lifts the parts block", async () => {
    const res = await api(`/jobs/${job.id}/parts-check/${checkId}/parts/${oring}`, alice, {
      method: "PATCH",
      body: JSON.stringify({ status: "found" }),
    });
    const r = CorrectPartResponse.parse(await res.json());
    expect(r.steps.find((s) => s.id === steps[1]!.id)).toMatchObject({ status: "todo" });
    const { data: events } = await admin
      .from("events")
      .select("type")
      .eq("job_id", job.id)
      .eq("type", "parts_checked");
    expect(events).toHaveLength(1);
  });
});
