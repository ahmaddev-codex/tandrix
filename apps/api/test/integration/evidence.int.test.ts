// Evidence uploads against real local storage (T8): create → upload to the signed URL →
// confirm → read back, plus the ways it must refuse.
import { CreateEvidenceResponse, EvidenceWithUrl, Job } from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, api, config, userFactory, type TestUser } from "./helpers";

const users = userFactory();
let alice: TestUser;
let bob: TestUser;
let job: Job;

// A real 1x1 JPEG, so the bytes read back can be compared exactly.
const JPEG = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "base64",
  ),
);

async function createEvidence(user: TestUser, body: object = {}) {
  const res = await api(`/jobs/${job.id}/evidence`, user, {
    method: "POST",
    body: JSON.stringify({
      kind: "photo",
      mimeType: "image/jpeg",
      byteSize: JPEG.length,
      surface: "phone",
      ...body,
    }),
  });
  expect(res.status).toBe(201);
  return CreateEvidenceResponse.parse(await res.json());
}

/** Uploads the way the phone does: straight to storage with the signed upload token. */
async function upload(
  created: Awaited<ReturnType<typeof createEvidence>>,
  bytes: Uint8Array,
  contentType: string,
) {
  const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false },
  });
  return anon.storage
    .from("evidence")
    .uploadToSignedUrl(created.upload.path, created.upload.token, bytes, { contentType });
}

const complete = (user: TestUser, id: string) =>
  api(`/jobs/${job.id}/evidence/${id}/complete`, user, { method: "POST" });

beforeAll(async () => {
  alice = await users.make("alice");
  bob = await users.make("bob");
  const res = await api("/jobs", alice, {
    method: "POST",
    body: JSON.stringify({ title: "Evidence test", surface: "phone" }),
  });
  job = Job.parse(((await res.json()) as { job: unknown }).job);
});

afterAll(async () => {
  const { data } = await admin.storage.from("evidence").list(`${alice.id}/${job.id}`);
  if (data?.length)
    await admin.storage.from("evidence").remove(data.map((f) => `${alice.id}/${job.id}/${f.name}`));
  await users.cleanup();
});

describe("happy path", () => {
  it("uploads, confirms and reads back the exact bytes", async () => {
    const created = await createEvidence(alice);
    expect((await complete(alice, created.evidence.id)).status).toBe(409); // not uploaded yet

    const up = await upload(created, JPEG, "image/jpeg");
    expect(up.error).toBeNull();

    const done = await complete(alice, created.evidence.id);
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({
      evidence: { byteSize: JPEG.length, uploadedAt: expect.any(String) },
    });

    const list = (await (await api(`/jobs/${job.id}/evidence`, alice)).json()) as {
      items: unknown[];
    };
    const item = EvidenceWithUrl.parse(
      list.items.find(
        (i) => (i as { evidence: { id: string } }).evidence.id === created.evidence.id,
      ),
    );
    const fetched = new Uint8Array(await (await fetch(item.url)).arrayBuffer());
    expect(Buffer.compare(Buffer.from(fetched), Buffer.from(JPEG))).toBe(0);
  });
});

describe("refusals", () => {
  it("another user can't create, confirm or list evidence on the job", async () => {
    const res = await api(`/jobs/${job.id}/evidence`, bob, {
      method: "POST",
      body: JSON.stringify({
        kind: "photo",
        mimeType: "image/jpeg",
        byteSize: 10,
        surface: "phone",
      }),
    });
    expect(res.status).toBe(404);
    const created = await createEvidence(alice);
    expect((await complete(bob, created.evidence.id)).status).toBe(404);
    expect((await api(`/jobs/${job.id}/evidence`, bob)).status).toBe(404);
  });

  it("storage refuses a file type the bucket doesn't allow", async () => {
    const created = await createEvidence(alice);
    const up = await upload(
      created,
      new TextEncoder().encode("<script>alert(1)</script>"),
      "text/html",
    );
    expect(up.error).not.toBeNull();
    expect((await complete(alice, created.evidence.id)).status).toBe(409);
  });

  it("a signed upload URL only writes its own path", async () => {
    const created = await createEvidence(alice);
    const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false },
    });
    const elsewhere = await anon.storage
      .from("evidence")
      .uploadToSignedUrl(`${bob.id}/planted.jpg`, created.upload.token, JPEG, {
        contentType: "image/jpeg",
      });
    expect(elsewhere.error).not.toBeNull();
  });

  it("clients can't list, read or write the bucket directly, even their own files", async () => {
    const created = await createEvidence(alice);
    await upload(created, JPEG, "image/jpeg");
    await complete(alice, created.evidence.id);

    const listed = await alice.db.storage.from("evidence").list(`${alice.id}/${job.id}`);
    expect(listed.data ?? []).toEqual([]);
    const read = await alice.db.storage.from("evidence").download(created.evidence.storageKey);
    expect(read.data).toBeNull();
    const write = await alice.db.storage
      .from("evidence")
      .upload(`${alice.id}/direct.jpg`, JPEG, { contentType: "image/jpeg" });
    expect(write.error).not.toBeNull();
  });

  it("clients don't see evidence rows until the upload is confirmed", async () => {
    const created = await createEvidence(alice);
    const pending = await alice.db.from("evidence").select("id").eq("id", created.evidence.id);
    expect(pending.data).toEqual([]);
    await upload(created, JPEG, "image/jpeg");
    await complete(alice, created.evidence.id);
    const confirmed = await alice.db.from("evidence").select("id").eq("id", created.evidence.id);
    expect(confirmed.data).toHaveLength(1);
    const other = await bob.db.from("evidence").select("id").eq("id", created.evidence.id);
    expect(other.data).toEqual([]);
  });
});
