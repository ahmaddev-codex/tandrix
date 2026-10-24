// Procedure from the manual (T11) against the local stack: the draft is saved with its parts,
// steps and the job's steps in one transaction; the job points at its first step; only the
// owner can read it; and two concurrent requests can't both give a job steps.
import {
  GenerateProcedureResponse,
  Job,
  JobDetailResponse,
  type ProcedureDraft,
} from "@tandrix/contracts";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { samplePdf } from "../fixtures";
import { admin, api, config, generator, userFactory, type TestUser } from "./helpers";

const users = userFactory();
const MODEL = `PROC-${users.run}`;
let alice: TestUser;
let bob: TestUser;

const DRAFT: ProcedureDraft = {
  title: "Assemble the pump",
  parts: [
    { ref: "P1", name: "Impeller", qty: 1 },
    { ref: "P2", name: "Casing bolt", qty: 8, partNumber: "96-55-01" },
  ],
  steps: [
    {
      order: 1,
      surface: "physical",
      title: "Fit the impeller",
      instruction: "Slide the impeller onto the shaft.",
      partRefs: ["P1"],
      hazardTags: [],
      verification: "photo",
      expectedState: "Impeller against the shoulder.",
      citation: { kind: "manual", page: 3, figure: "Fig. 2" },
    },
    {
      order: 2,
      surface: "physical",
      title: "Torque the casing bolts",
      instruction: "Tighten the casing bolts in a cross pattern.",
      partRefs: ["P2"],
      hazardTags: [],
      verification: "measurement",
      measurement: { quantity: "torque", unit: "Nm", target: 25, tolerance: 2 },
      expectedState: "All bolts at 25 Nm.",
      citation: { kind: "manual", page: 4 },
    },
  ],
};

async function jobWithManual(user: TestUser, title: string) {
  const job = Job.parse(
    (
      (await (
        await api("/jobs", user, {
          method: "POST",
          body: JSON.stringify({ title, surface: "phone" }),
        })
      ).json()) as { job: unknown }
    ).job,
  );
  await api(`/jobs/${job.id}/asset`, user, {
    method: "PUT",
    body: JSON.stringify({
      category: "equipment",
      make: "FlowSet",
      model: MODEL,
      source: "manual",
    }),
  });
  const pdf = await samplePdf(5);
  const created = (await (
    await api(`/jobs/${job.id}/manual/upload`, user, {
      method: "POST",
      body: JSON.stringify({ byteSize: pdf.length, title: "Manual" }),
    })
  ).json()) as { uploadId: string; upload: { path: string; token: string } };
  const anon = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: false },
  });
  const up = await anon.storage
    .from("manuals")
    .uploadToSignedUrl(created.upload.path, created.upload.token, pdf, {
      contentType: "application/pdf",
    });
  if (up.error) throw up.error;
  await api(`/jobs/${job.id}/manual/upload/${created.uploadId}/complete`, user, { method: "POST" });
  return job;
}

const generate = (job: Job, user: TestUser) =>
  api(`/jobs/${job.id}/procedure`, user, { method: "POST" });

beforeAll(async () => {
  alice = await users.make("alice");
  bob = await users.make("bob");
});

afterAll(async () => {
  for (const u of [alice, bob]) {
    const { data } = await admin.storage.from("manuals").list(u.id);
    if (data?.length)
      await admin.storage.from("manuals").remove(data.map((f) => `${u.id}/${f.name}`));
  }
  // Users first: their jobs (and job steps, which hold procedure steps) go with them. Procedures
  // outlive their author (author_id set null), so remove this run's afterwards.
  await users.cleanup();
  const { error } = await admin
    .from("procedures")
    .delete()
    .like("asset_model_key", `%${MODEL.toLowerCase()}`);
  if (error) throw error;
});

describe("generate", () => {
  let job: Job;

  it("saves the procedure and starts the job's steps", async () => {
    job = await jobWithManual(alice, "Procedure test");
    let pages: number | undefined;
    generator.impl = async (input) => {
      pages = input.manual?.pages;
      return { status: "drafted", draft: DRAFT };
    };
    const res = await generate(job, alice);
    expect(res.status).toBe(201);
    const body = GenerateProcedureResponse.parse(await res.json());
    if (body.status !== "created") throw new Error(body.status);
    expect(pages).toBe(5);
    expect(body.citedSteps).toBe(2);
    expect(body.detail.parts.map((p) => p.name).sort()).toEqual(["Casing bolt", "Impeller"]);
    const [first, second] = body.detail.steps;
    expect(first!.citation).toMatchObject({ kind: "manual", page: 3, figure: "Fig. 2" });
    expect(second!.measurement).toEqual({
      quantity: "torque",
      unit: "Nm",
      target: 25,
      tolerance: 2,
    });

    const detail = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json());
    expect(detail.job.procedureId).toBe(body.detail.procedure.id);
    expect(detail.steps).toHaveLength(2);
    expect(detail.steps.every((s) => s.status === "todo")).toBe(true);
    const firstJobStep = detail.steps.find((s) => s.procedureStepId === first!.id);
    expect(detail.job.currentStepId).toBe(firstJobStep!.id);

    const { data: event } = await admin
      .from("events")
      .select("payload")
      .eq("job_id", job.id)
      .eq("type", "procedure_generated")
      .single();
    expect(event?.payload).toMatchObject({
      procedure_id: body.detail.procedure.id,
      steps: 2,
      cited_steps: 2,
    });
  });

  it("refuses a second procedure for the same job", async () => {
    expect((await generate(job, alice)).status).toBe(409);
  });

  it("lets the owner's client read it, and nobody else", async () => {
    const detail = JobDetailResponse.parse(await (await api(`/jobs/${job.id}`, alice)).json());
    const procedureId = detail.job.procedureId!;
    const own = await alice.db.from("procedure_steps").select("id").eq("procedure_id", procedureId);
    expect(own.data).toHaveLength(2);
    const other = await bob.db.from("procedure_steps").select("id").eq("procedure_id", procedureId);
    expect(other.data).toEqual([]);
    expect((await api(`/jobs/${job.id}/procedure`, bob, { method: "POST" })).status).toBe(404);
  });

  it("gives one job steps once, even when two requests race", async () => {
    const racing = await jobWithManual(alice, "Race test");
    generator.impl = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { status: "drafted", draft: DRAFT };
    };
    const statuses = (await Promise.all([generate(racing, alice), generate(racing, alice)]))
      .map((r) => r.status)
      .sort();
    expect(statuses).toEqual([201, 409]);
    const detail = JobDetailResponse.parse(await (await api(`/jobs/${racing.id}`, alice)).json());
    expect(detail.steps).toHaveLength(2);
  });
});
