// Highlights (T12) against the local stack: detections with their mask outline are saved for
// the photo, corrections are stored, and only the owner can read them.
import {
  CreateEvidenceResponse,
  GenerateProcedureResponse,
  HighlightResponse,
  Job,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PNG } from "../fixtures";
import { admin, api, config, generator, highlighter, userFactory, type TestUser } from "./helpers";

const users = userFactory();
const MODEL = `HL-${users.run}`;
let alice: TestUser;
let bob: TestUser;
let job: Job;
let jobStepId: string;
let photoId: string;
let partIds: string[];

const DRAFT: ProcedureDraft = {
  title: "Fit the impeller",
  parts: [
    { ref: "P1", name: "Impeller", qty: 1 },
    { ref: "P2", name: "Shaft key", qty: 1 },
  ],
  steps: [
    {
      order: 1,
      surface: "physical",
      title: "Fit the impeller",
      instruction: "Slide the impeller onto the shaft over the key.",
      partRefs: ["P1", "P2"],
      hazardTags: [],
      verification: "photo",
      expectedState: "Impeller seated.",
      citation: { kind: "generic" },
    },
  ],
};

const post = (path: string, user: TestUser, body?: object) =>
  api(path, user, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });

beforeAll(async () => {
  alice = await users.make("alice");
  bob = await users.make("bob");
  job = Job.parse(
    (
      (await (
        await post("/jobs", alice, { title: "Highlight test", surface: "phone" })
      ).json()) as { job: unknown }
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
    await (await post(`/jobs/${job.id}/procedure`, alice, { allowGeneric: true })).json(),
  );
  if (gen.status !== "created") throw new Error(gen.status);
  partIds = gen.detail.steps[0]!.partSpecIds;
  const detail = (await (await api(`/jobs/${job.id}`, alice)).json()) as {
    steps: Array<{ id: string }>;
  };
  jobStepId = detail.steps[0]!.id;

  const created = CreateEvidenceResponse.parse(
    await (
      await post(`/jobs/${job.id}/evidence`, alice, {
        kind: "photo",
        mimeType: "image/png",
        byteSize: PNG.length,
        surface: "phone",
        width: 1,
        height: 1,
        jobStepId,
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
  await post(`/jobs/${job.id}/evidence/${created.evidence.id}/complete`, alice);
  photoId = created.evidence.id;
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

describe("highlight", () => {
  let detectionId: string;

  it("saves a detection with its mask outline for the photo", async () => {
    highlighter.impl = async (input) => ({
      status: "found",
      picks: [
        {
          partSpecId: input.parts[0]!.id,
          box: { x: 0, y: 0, w: 1, h: 1 },
          mask: { path: "M0 0L40 0L40 40L0 40Z", raster: { width: 40, height: 40 } },
          confidence: 0.88,
        },
      ],
    });
    const res = HighlightResponse.parse(
      await (
        await post(`/jobs/${job.id}/steps/${jobStepId}/highlight`, alice, { evidenceId: photoId })
      ).json(),
    );
    if (res.status !== "found") throw new Error(res.status);
    expect(res.targets[0]!.geometry.kind).toBe("mask");
    expect(res.missing.map((m) => m.name)).toEqual(["Shaft key"]);
    detectionId = res.targets[0]!.detectionId;

    const { data } = await admin.from("detections").select("*").eq("id", detectionId).single();
    expect(data).toMatchObject({
      evidence_id: photoId,
      part_spec_id: partIds[0],
      label: "Impeller",
      confirmed_by_user: null,
    });
    expect(data!.mask.raster).toEqual({ width: 40, height: 40 });
  });

  it("stores the user's correction to another part", async () => {
    const res = await api(`/jobs/${job.id}/detections/${detectionId}`, alice, {
      method: "PATCH",
      body: JSON.stringify({ verdict: "other_part", partSpecId: partIds[1] }),
    });
    expect(res.status).toBe(200);
    const { data } = await admin.from("detections").select("*").eq("id", detectionId).single();
    expect(data).toMatchObject({
      confirmed_by_user: true,
      corrected_label: "Shaft key",
      part_spec_id: partIds[1],
    });
  });

  it("lets only the owner's client read detections, and nobody else change them", async () => {
    const own = await alice.db.from("detections").select("id").eq("id", detectionId);
    expect(own.data).toHaveLength(1);
    const other = await bob.db.from("detections").select("id").eq("id", detectionId);
    expect(other.data).toEqual([]);
    const patch = await api(`/jobs/${job.id}/detections/${detectionId}`, bob, {
      method: "PATCH",
      body: JSON.stringify({ verdict: "wrong" }),
    });
    expect(patch.status).toBe(404);
  });

  it("rejects a mask outline the database can't hold", async () => {
    const { error } = await admin.from("detections").insert({
      evidence_id: photoId,
      label: "x",
      box: { x: 0, y: 0, w: 1, h: 1 },
      confidence: 0.5,
      mask: { path: "M0 0Z", raster: { width: 0, height: 4 } },
    });
    expect(error?.code).toBe("23514");
  });
});
