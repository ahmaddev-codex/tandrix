// Runs against the local Supabase stack: `pnpm test:integration` (needs `pnpm setup:local`).
// Covers T6 acceptance: users create and list only their own jobs, and no one can read or write
// another user's data, through the API or directly against the database.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Job } from "@tandrix/contracts";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { supabaseVerifier } from "../../src/auth";
import { loadApiConfig } from "../../src/config";
import { supabaseJobsRepo } from "../../src/repos/jobs";

const config = loadApiConfig();
if (config.env !== "local") throw new Error("Integration tests only run against the local stack.");

const admin = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const app = createApp({
  verifyToken: supabaseVerifier(admin),
  jobs: supabaseJobsRepo(admin),
  corsOrigins: [],
  log: () => {},
});

interface TestUser {
  id: string;
  token: string;
  /** Talks to the database directly as this user, the way a client app could. */
  db: SupabaseClient;
}

const run = randomUUID().slice(0, 8);
const users: TestUser[] = [];

async function makeUser(name: string): Promise<TestUser> {
  const email = `it-${run}-${name}@tandrix.local`;
  const password = randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  const u = { id: created.data.user.id, token: signed.data.session.access_token, db: client };
  users.push(u);
  return u;
}

const api = (path: string, user: TestUser | null, init: RequestInit = {}) =>
  app.request(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(user ? { authorization: `Bearer ${user.token}` } : {}),
    },
  });

let alice: TestUser;
let bob: TestUser;
let aliceJob: Job;

beforeAll(async () => {
  alice = await makeUser("alice");
  bob = await makeUser("bob");
});

afterAll(async () => {
  for (const u of users) await admin.auth.admin.deleteUser(u.id);
});

describe("API", () => {
  it("creates a job for the signed-in user and records the event", async () => {
    const res = await api("/jobs", alice, {
      method: "POST",
      body: JSON.stringify({ title: "Pump P-100 assembly", surface: "phone" }),
    });
    expect(res.status).toBe(201);
    aliceJob = Job.parse(((await res.json()) as { job: unknown }).job);
    expect(aliceJob).toMatchObject({ ownerId: alice.id, controlMode: "show", status: "active" });

    const events = await admin.from("events").select("type, surface").eq("job_id", aliceJob.id);
    expect(events.data).toEqual([{ type: "job_created", surface: "phone" }]);
  });

  it("lists only the caller's jobs", async () => {
    const a = (await (await api("/jobs", alice)).json()) as { jobs: Job[] };
    expect(a.jobs.map((j) => j.id)).toEqual([aliceJob.id]);
    const b = (await (await api("/jobs", bob)).json()) as { jobs: Job[] };
    expect(b.jobs).toEqual([]);
  });

  it("returns the job to its owner and 404 to anyone else", async () => {
    expect((await api(`/jobs/${aliceJob.id}`, alice)).status).toBe(200);
    expect((await api(`/jobs/${aliceJob.id}`, bob)).status).toBe(404);
  });

  it("rejects requests without a valid token", async () => {
    expect((await api("/jobs", null)).status).toBe(401);
    const forged = { ...alice, token: alice.token.slice(0, -4) + "AAAA" };
    expect((await api("/jobs", forged)).status).toBe(401);
  });

  it("rejects an asset that belongs to someone else", async () => {
    const asset = await admin
      .from("assets")
      .insert({ owner_id: alice.id, category: "equipment", make: "FlowSet", model: "CR 3-10" })
      .select("id")
      .single();
    expect(asset.error).toBeNull();
    const res = await api("/jobs", bob, {
      method: "POST",
      body: JSON.stringify({ title: "Borrowed", surface: "phone", assetId: asset.data!.id }),
    });
    expect(res.status).toBe(404);
  });
});

describe("Direct database access (row-level security)", () => {
  it("a user reads their own job but not someone else's", async () => {
    const own = await alice.db.from("jobs").select("id").eq("id", aliceJob.id);
    expect(own.data).toHaveLength(1);
    const other = await bob.db.from("jobs").select("id").eq("id", aliceJob.id);
    expect(other.data).toEqual([]);
    const events = await bob.db.from("events").select("id").eq("job_id", aliceJob.id);
    expect(events.data).toEqual([]);
  });

  it("clients can't insert, update or delete jobs directly", async () => {
    const ins = await alice.db
      .from("jobs")
      .insert({ owner_id: alice.id, title: "Sneaky", active_surface: "phone" });
    expect(ins.error?.code).toBe("42501");
    await alice.db.from("jobs").update({ title: "Changed" }).eq("id", aliceJob.id);
    await alice.db.from("jobs").delete().eq("id", aliceJob.id);
    const after = await admin.from("jobs").select("title").eq("id", aliceJob.id).single();
    expect(after.data?.title).toBe("Pump P-100 assembly");
  });

  it("clients can't write job steps, so they can't mark a step verified", async () => {
    const ins = await alice.db.from("job_steps").insert({
      job_id: aliceJob.id,
      procedure_step_id: randomUUID(),
      status: "verified",
      updated_by_surface: "phone",
    });
    expect(ins.error?.code).toBe("42501");
  });

  it("clients can't call the server's write function", async () => {
    const r = await alice.db.rpc("create_job", {
      p_owner_id: bob.id,
      p_title: "Planted",
      p_asset_id: null,
      p_language: "en",
      p_surface: "phone",
    });
    expect(r.error).not.toBeNull();
    const bobs = await admin.from("jobs").select("id").eq("owner_id", bob.id);
    expect(bobs.data).toEqual([]);
  });

  it("signed-out requests read nothing", async () => {
    const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false },
    });
    const r = await anon.from("jobs").select("id");
    expect(r.data ?? []).toEqual([]);
  });

  it("the database refuses a verified step without evidence, whoever writes it", async () => {
    const proc = await admin
      .from("procedures")
      .insert({ asset_model_key: `it-${run}`, source_type: "generic", title: "Test procedure" })
      .select("id")
      .single();
    const step = await admin
      .from("procedure_steps")
      .insert({
        procedure_id: proc.data!.id,
        order: 1,
        surface: "physical",
        title: "Fit the impeller",
        instruction: "Slide it on.",
        verification: "photo",
        expected_state: "Seated.",
        citation: { kind: "generic" },
      })
      .select("id")
      .single();
    const bad = await admin.from("job_steps").insert({
      job_id: aliceJob.id,
      procedure_step_id: step.data!.id,
      status: "verified",
      updated_by_surface: "phone",
    });
    expect(bad.error?.code).toBe("23514");
    await admin.from("procedures").delete().eq("id", proc.data!.id);
  });
});
