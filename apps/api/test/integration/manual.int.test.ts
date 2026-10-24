// Manuals (T10) against the local stack: a searched manual is downloaded, stored and shared by
// make and model; an uploaded one stays private to its owner; clients can't reach the bucket or
// the pending uploads directly.
import { Job, JobDetailResponse, ManualResponse, ManualSearchResponse } from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { samplePdf } from "../fixtures";
import { admin, api, config, finder, userFactory, web, type TestUser } from "./helpers";

const users = userFactory();
// A model unique to this run, so shared manuals from earlier runs never answer.
const MODEL = `IT-${users.run}`;
const KEY = `flowset|${MODEL.toLowerCase()}`;
const URL1 = `https://maker.example/${users.run}.pdf`;
let alice: TestUser;
let bob: TestUser;
let aliceJob: Job;
let bobJob: Job;
const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: false },
});

async function jobWithAsset(user: TestUser) {
  const job = Job.parse(
    (
      (await (
        await api("/jobs", user, {
          method: "POST",
          body: JSON.stringify({ title: "Manual test", surface: "phone" }),
        })
      ).json()) as { job: unknown }
    ).job,
  );
  const saved = await api(`/jobs/${job.id}/asset`, user, {
    method: "PUT",
    body: JSON.stringify({
      category: "equipment",
      make: "FlowSet",
      model: MODEL,
      source: "manual",
    }),
  });
  if (saved.status !== 201) throw new Error(`save asset: ${saved.status} ${await saved.text()}`);
  return job;
}

const post = (path: string, user: TestUser, body?: object) =>
  api(path, user, { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });

beforeAll(async () => {
  alice = await users.make("alice");
  bob = await users.make("bob");
  aliceJob = await jobWithAsset(alice);
  bobJob = await jobWithAsset(bob);
});

afterAll(async () => {
  // Shared manuals outlive their users; remove this run's.
  const { data } = await admin.from("manuals").select("storage_key").eq("asset_model_key", KEY);
  if (data?.length) await admin.storage.from("manuals").remove(data.map((r) => r.storage_key));
  await admin.from("manuals").delete().eq("asset_model_key", KEY);
  await users.cleanup();
});

describe("search", () => {
  it("reports unavailable search and asks with the job's equipment", async () => {
    let asked: unknown;
    finder.impl = async (asset) => {
      asked = asset;
      return { status: "unavailable", message: "Search off." };
    };
    const res = await post(`/jobs/${aliceJob.id}/manual/search`, alice);
    expect(ManualSearchResponse.parse(await res.json())).toEqual({
      status: "unavailable",
      message: "Search off.",
    });
    expect(asked).toEqual({ make: "FlowSet", model: MODEL });
  });
});

describe("private upload", () => {
  let manualId: string;

  it("uploads a PDF straight to storage, then the API checks and saves it", async () => {
    const pdf = await samplePdf(3);
    const created = (await (
      await post(`/jobs/${aliceJob.id}/manual/upload`, alice, {
        byteSize: pdf.length,
        title: "Alice's copy",
      })
    ).json()) as { uploadId: string; upload: { path: string; token: string } };
    const up = await anon.storage
      .from("manuals")
      .uploadToSignedUrl(created.upload.path, created.upload.token, pdf, {
        contentType: "application/pdf",
      });
    expect(up.error).toBeNull();
    const done = await post(
      `/jobs/${aliceJob.id}/manual/upload/${created.uploadId}/complete`,
      alice,
    );
    expect(done.status).toBe(201);
    const { manual } = ManualResponse.parse(await done.json());
    expect(manual).toMatchObject({ pageCount: 3, sourceType: "upload", title: "Alice's copy" });
    manualId = manual.id;

    const { data: event } = await admin
      .from("events")
      .select("payload")
      .eq("job_id", aliceJob.id)
      .eq("type", "manual_attached")
      .single();
    expect(event?.payload).toEqual({ manualId, how: "upload" });
  });

  it("shows on Alice's job and opens through a signed URL", async () => {
    const detail = JobDetailResponse.parse(await (await api(`/jobs/${aliceJob.id}`, alice)).json());
    expect(detail.manual?.id).toBe(manualId);
    const { url } = (await (
      await api(`/jobs/${aliceJob.id}/manual/${manualId}/url`, alice)
    ).json()) as {
      url: string;
    };
    const file = await fetch(url);
    expect(file.status).toBe(200);
    expect(
      Buffer.from(await file.arrayBuffer())
        .subarray(0, 5)
        .toString(),
    ).toBe("%PDF-");
  });

  it("stays private: Bob's job, Bob's client and the bucket don't reveal it", async () => {
    const bobDetail = JobDetailResponse.parse(await (await api(`/jobs/${bobJob.id}`, bob)).json());
    expect(bobDetail.manual).toBeNull();
    expect((await api(`/jobs/${bobJob.id}/manual/${manualId}/url`, bob)).status).toBe(404);
    const { data } = await bob.db.from("manuals").select("id").eq("id", manualId);
    expect(data).toEqual([]);
  });

  it("gives clients no direct access to pending uploads or the bucket", async () => {
    const pending = await alice.db.from("manual_uploads").select("id");
    expect(pending.error?.code).toBe("42501");
    const { data: row } = await admin
      .from("manuals")
      .select("storage_key")
      .eq("id", manualId)
      .single();
    const direct = await alice.db.storage.from("manuals").download(row!.storage_key);
    expect(direct.data).toBeNull();
  });
});

describe("searched manual", () => {
  it("downloads a candidate into shared storage, and other users get it from the cache", async () => {
    const pdf = await samplePdf(5);
    finder.impl = async () => ({
      status: "found",
      candidates: [
        {
          url: URL1,
          title: "FlowSet manual",
          official: true,
          documentType: "installation_manual",
          confidence: 0.9,
        },
      ],
    });
    web.transport.impl = async (url) =>
      url.toString() === URL1 ? { status: 200, body: pdf } : { status: 404 };

    // Bob has no private copy, so he searches and fetches.
    const found = ManualSearchResponse.parse(
      await (await post(`/jobs/${bobJob.id}/manual/search`, bob)).json(),
    );
    if (found.status !== "found") throw new Error(found.status);
    const res = await post(`/jobs/${bobJob.id}/manual/fetch`, bob, {
      url: URL1,
      title: "FlowSet manual",
      token: found.candidates[0]!.token,
    });
    expect(res.status).toBe(201);
    const { manual } = ManualResponse.parse(await res.json());
    expect(manual).toMatchObject({ pageCount: 5, sourceType: "search", sourceUrl: URL1 });

    const stored = await admin.storage.from("manuals").download(manual.storageKey);
    expect(Buffer.from(await stored.data!.arrayBuffer())).toEqual(Buffer.from(pdf));

    // A third user's job with the same model gets the shared manual without searching.
    const carol = await users.make("carol");
    const carolJob = await jobWithAsset(carol);
    finder.impl = async () => {
      throw new Error("should not search");
    };
    const cached = ManualSearchResponse.parse(
      await (await post(`/jobs/${carolJob.id}/manual/search`, carol)).json(),
    );
    expect(cached).toEqual({ status: "cached", manual });

    // Alice keeps seeing her own copy first.
    const aliceDetail = JobDetailResponse.parse(
      await (await api(`/jobs/${aliceJob.id}`, alice)).json(),
    );
    expect(aliceDetail.manual?.sourceType).toBe("upload");
  });

  it("refuses a URL that didn't come from the search", async () => {
    let connected = false;
    web.transport.impl = async () => {
      connected = true;
      return { status: 404 };
    };
    const res = await post(`/jobs/${bobJob.id}/manual/fetch`, bob, {
      url: "https://evil.example/x.pdf",
      title: "x",
      token: `${Date.now() + 60_000}.forged`,
    });
    expect(res.status).toBe(400);
    expect(connected).toBe(false);
  });
});
