// Identify the equipment (T9) against the local stack: the uploaded nameplate photo reaches the
// reader byte for byte, the confirmed asset is linked to the job with an audit event, and
// nobody else can identify or save on the job.
import { CreateEvidenceResponse, Job, JobDetailResponse } from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, api, config, reader, userFactory, type TestUser } from "./helpers";

const users = userFactory();
let alice: TestUser;
let bob: TestUser;
let job: Job;
let photoId: string;
const PHOTO = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

beforeAll(async () => {
  alice = await users.make("alice");
  bob = await users.make("bob");
  job = Job.parse(
    (
      (await (
        await api("/jobs", alice, {
          method: "POST",
          body: JSON.stringify({ title: "Asset test", surface: "phone" }),
        })
      ).json()) as { job: unknown }
    ).job,
  );
  const created = CreateEvidenceResponse.parse(
    await (
      await api(`/jobs/${job.id}/evidence`, alice, {
        method: "POST",
        body: JSON.stringify({
          kind: "photo",
          mimeType: "image/jpeg",
          byteSize: PHOTO.length,
          surface: "phone",
        }),
      })
    ).json(),
  );
  const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false },
  });
  const up = await anon.storage
    .from("evidence")
    .uploadToSignedUrl(created.upload.path, created.upload.token, PHOTO, {
      contentType: "image/jpeg",
    });
  if (up.error) throw up.error;
  await api(`/jobs/${job.id}/evidence/${created.evidence.id}/complete`, alice, { method: "POST" });
  photoId = created.evidence.id;
});

afterAll(async () => {
  const { data } = await admin.storage.from("evidence").list(`${alice.id}/${job.id}`);
  if (data?.length)
    await admin.storage.from("evidence").remove(data.map((f) => `${alice.id}/${job.id}/${f.name}`));
  await users.cleanup();
});

describe("identify", () => {
  it("sends the stored photo's exact bytes to the reader and returns its answer", async () => {
    let seen: Uint8Array | undefined;
    reader.impl = async ({ bytes }) => {
      seen = bytes;
      return {
        status: "read",
        reading: {
          unreadable: false,
          make: "FlowSet",
          model: "CR 3-10",
          ratings: [],
          confidence: 0.62,
        },
      };
    };
    const res = await api(`/jobs/${job.id}/asset/identify`, alice, {
      method: "POST",
      body: JSON.stringify({ evidenceId: photoId }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: "read",
      reading: { make: "FlowSet", confidence: 0.62 },
    });
    expect(Buffer.compare(Buffer.from(seen!), Buffer.from(PHOTO))).toBe(0);
  });

  it("another user can't identify on the job", async () => {
    const res = await api(`/jobs/${job.id}/asset/identify`, bob, {
      method: "POST",
      body: JSON.stringify({ evidenceId: photoId }),
    });
    expect(res.status).toBe(404);
  });
});

describe("save", () => {
  it("links the asset to the job, records how it was produced, and returns it with the job", async () => {
    const res = await api(`/jobs/${job.id}/asset`, alice, {
      method: "PUT",
      body: JSON.stringify({
        make: "FlowSet",
        model: "CR 3-10 A-A-A-E",
        serial: "4521-0098",
        nameplateEvidenceId: photoId,
        source: "model_edited",
        confidence: 0.62,
      }),
    });
    expect(res.status).toBe(201);

    const detail = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json());
    expect(detail.asset).toMatchObject({
      make: "FlowSet",
      model: "CR 3-10 A-A-A-E",
      serial: "4521-0098",
      nameplateEvidenceId: photoId,
    });
    expect(detail.job.assetId).toBe(detail.asset!.id);

    const events = await admin
      .from("events")
      .select("type, payload")
      .eq("job_id", job.id)
      .eq("type", "asset_identified");
    expect(events.data?.[0]?.payload).toMatchObject({
      source: "model_edited",
      asset_id: detail.asset!.id,
    });
  });

  it("the owner can read the asset directly; another user can't", async () => {
    const own = await alice.db.from("assets").select("make").eq("owner_id", alice.id);
    expect(own.data?.map((a) => a.make)).toContain("FlowSet");
    const other = await bob.db.from("assets").select("id").eq("owner_id", alice.id);
    expect(other.data).toEqual([]);
  });

  it("another user can't save on the job, and clients can't call the save function", async () => {
    const res = await api(`/jobs/${job.id}/asset`, bob, {
      method: "PUT",
      body: JSON.stringify({ make: "X", model: "Y", source: "manual" }),
    });
    expect(res.status).toBe(404);
    const rpc = await alice.db.rpc("set_job_asset", {
      p_owner_id: alice.id,
      p_job_id: job.id,
      p_category: "equipment",
      p_make: "Direct",
      p_model: "Call",
      p_serial: null,
      p_nameplate_evidence_id: null,
      p_source: "manual",
      p_confidence: null,
    });
    // Two layers stop this: no execute grant for clients, and no client write policies on the
    // tables the function touches. Check the outcome, which must hold whichever layer stops it.
    expect(rpc.error).not.toBeNull();
    const planted = await admin
      .from("assets")
      .select("id")
      .eq("owner_id", alice.id)
      .eq("make", "Direct");
    expect(planted.data).toEqual([]);
  });
});
