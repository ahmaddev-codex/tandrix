// Generate the job's procedure from its manual (or generic steps, if the user chooses), then
// apply the deterministic rules and save it with the job's steps in one transaction.
import { normalizeDraft } from "@tandrix/core";
import { GenerateProcedureRequest, Id, RecordedProcedureRequest } from "@tandrix/contracts";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import type { ProcedureGenerator } from "../procedure-generator";
import { modelLimiter, type RateLimiter } from "../rate-limit";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import { assetModelKey, projectKey, type ManualsRepo } from "../repos/manuals";

export { projectKey };
import type { ProceduresRepo } from "../repos/procedures";
import {
  RUN_STALE_SECONDS,
  type ProcedureRun,
  type ProcedureRunsRepo,
} from "../repos/procedure-runs";
import type { StepStateRepo } from "../repos/step-state";
import { GENERATE_UNAVAILABLE } from "../procedure-generator";

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export interface ProcedureDeps {
  jobs: JobsRepo;
  assets: AssetsRepo;
  manuals: ManualsRepo;
  manualStorage: EvidenceStorage;
  evidence: EvidenceRepo;
  evidenceStorage: EvidenceStorage;
  procedures: ProceduresRepo;
  generator: ProcedureGenerator;
  /** Background runs of writing the steps; without it only the waiting POST / is there. */
  runs?: ProcedureRunsRepo;
  /** Record mode sets each step's reference photo to the moment it came from. */
  stepState?: StepStateRepo;
  log: (l: Record<string, unknown>) => void;
  limiter?: RateLimiter;
}

/** Still working, not a run lost to a restart. */
const isGoing = (run: ProcedureRun) =>
  run.status === "running" && Date.now() - Date.parse(run.startedAt) < RUN_STALE_SECONDS * 1000;

export function procedureRoutes(d: ProcedureDeps) {
  const limiter = d.limiter ?? modelLimiter();

  /** Everything that can be refused straight away; the returned work does the slow part. */
  const prepare = async (
    ownerId: string,
    jobId: string,
    body: z.output<typeof GenerateProcedureRequest>,
  ) => {
    const found = await d.jobs.getForOwner(ownerId, jobId);
    if (!found) throw notFound("Job");
    if (found.job.procedureId)
      throw new HttpError(409, "conflict", "This job already has its steps.");
    // Equipment is optional: a project ("assemble a home server rack") works from its goal, and
    // its steps are all Generic because there is no manual to cite.
    const asset = found.job.assetId ? await d.assets.getForOwner(ownerId, found.job.assetId) : null;
    const task = body.task ?? found.job.title;

    const key = asset ? assetModelKey(asset.make, asset.model) : projectKey(task);
    // The manual attached to this job wins (a project's own PDF or pages); else the model's.
    const manual =
      (await d.manuals.forJob(ownerId, jobId)) ??
      (asset ? await d.manuals.findForModel(ownerId, key) : null);
    // Photos of where the work stands, owned by this job and uploaded. Looked up and
    // downloaded in parallel, validated in order so the first bad photo is the one named.
    const photoEvs = await Promise.all(
      body.contextEvidenceIds.map((id) => d.evidence.getForOwner(ownerId, jobId, id)),
    );
    const keys: string[] = [];
    for (const ev of photoEvs) {
      if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");
      keys.push(ev.storageKey);
    }
    if (asset && !manual && !body.allowGeneric) {
      throw new HttpError(
        409,
        "conflict",
        "Add the manual first, or continue with general steps that aren't from the manual.",
      );
    }

    return async () => {
      const blobs = await Promise.all(keys.map((k) => d.evidenceStorage.download(k)));
      const photos = blobs.map((bytes, i) => ({ bytes, mimeType: photoEvs[i]!.mimeType }));
      const result = await d.generator.generate({
        asset: asset ? { make: asset.make, model: asset.model } : null,
        task,
        manual: manual
          ? { bytes: await d.manualStorage.download(manual.storageKey), pages: manual.pageCount }
          : null,
        ...(body.notes ? { notes: body.notes } : {}),
        ...(photos.length ? { photos } : {}),
      });
      if (result.status === "unavailable") return result;

      const { draft, fixes, citedSteps } = normalizeDraft(result.draft, {
        manualPages: manual?.pageCount ?? null,
      });
      if (fixes.length) d.log({ level: "info", event: "procedure_fixes", fixes });

      const procedureId = randomUUID();
      const partIds = new Map(draft.parts.map((p) => [p.ref, randomUUID()]));
      await d.procedures.save({
        ownerId,
        jobId,
        procedureId,
        assetModelKey: key,
        manualId: manual?.id ?? null,
        draft,
        partIds,
        stepIds: draft.steps.map(() => randomUUID()),
        surface: "phone",
        event: {
          steps: draft.steps.length,
          cited_steps: citedSteps,
          fixes: fixes.map((f) => f.kind),
        },
      });
      const detail = await d.procedures.getDetail(ownerId, procedureId);
      if (!detail) throw new Error("saved procedure not readable");
      return { status: "created" as const, detail, citedSteps };
    };
  };

  /** The answer for a job that has its steps, however they got there. */
  const written = async (ownerId: string, procedureId: string, citedSteps?: number | null) => {
    const detail = await d.procedures.getDetail(ownerId, procedureId);
    if (!detail) throw new Error("saved procedure not readable");
    return {
      status: "created" as const,
      detail,
      citedSteps: citedSteps ?? detail.steps.filter((s) => s.citation.kind !== "generic").length,
    };
  };

  return new Hono<AuthEnv>()
    .post("/", async (c) => {
      const user = c.get("user");
      if (!limiter.allow(user.id)) throw tooMany();
      const jobId = Id.safeParse(c.req.param("id"));
      if (!jobId.success) throw notFound("Job");
      const parsed = GenerateProcedureRequest.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const work = await prepare(user.id, jobId.data, parsed.data);
      const result = await work();
      return result.status === "created" ? c.json(result, 201) : c.json(result);
    })
    .post("/start", async (c) => {
      // Writes the steps in the background. Asking again finds the same run, so a dropped
      // connection or a reopened app carries on rather than paying for another.
      if (!d.runs) throw notFound("Run");
      const runs = d.runs;
      const user = c.get("user");
      const jobId = Id.safeParse(c.req.param("id"));
      if (!jobId.success) throw notFound("Job");
      const parsed = GenerateProcedureRequest.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const found = await d.jobs.getForOwner(user.id, jobId.data);
      if (!found) throw notFound("Job");
      if (found.job.procedureId) {
        const run = await runs.get(jobId.data);
        return c.json(await written(user.id, found.job.procedureId, run?.citedSteps));
      }
      const writing = { status: "writing" as const };
      const run = await runs.get(jobId.data);
      if (run && isGoing(run)) return c.json(writing, 202);

      if (!limiter.allow(user.id)) throw tooMany();
      const work = await prepare(user.id, jobId.data, parsed.data);
      if (!(await runs.claim(jobId.data))) return c.json(writing, 202);
      void work()
        .then((r) =>
          runs.finish(
            jobId.data,
            r.status === "created"
              ? { status: "done", citedSteps: r.citedSteps }
              : { status: "failed", message: r.message },
          ),
        )
        .catch(async (e: unknown) => {
          d.log({ level: "error", event: "procedure_run_failed", error: String(e) });
          await runs
            .finish(jobId.data, { status: "failed", message: GENERATE_UNAVAILABLE })
            .catch((f: unknown) =>
              d.log({ level: "error", event: "procedure_run_finish_failed", error: String(f) }),
            );
        });
      return c.json(writing, 202);
    })
    .get("/run", async (c) => {
      if (!d.runs) throw notFound("Run");
      const user = c.get("user");
      const jobId = Id.safeParse(c.req.param("id"));
      if (!jobId.success) throw notFound("Job");
      const found = await d.jobs.getForOwner(user.id, jobId.data);
      if (!found) throw notFound("Job");
      const run = await d.runs.get(jobId.data);
      if (found.job.procedureId)
        return c.json(await written(user.id, found.job.procedureId, run?.citedSteps));
      if (!run) return c.json({ status: "idle" as const });
      if (isGoing(run)) return c.json({ status: "writing" as const });
      return c.json({
        status: "unavailable" as const,
        message: run.message ?? GENERATE_UNAVAILABLE,
      });
    })
    .post("/recorded", async (c) => {
      // Record mode (T28): someone did the job and said what they did, moment by moment.
      const user = c.get("user");
      if (!limiter.allow(user.id)) throw tooMany();
      const jobId = Id.safeParse(c.req.param("id"));
      if (!jobId.success) throw notFound("Job");
      const parsed = RecordedProcedureRequest.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const found = await d.jobs.getForOwner(user.id, jobId.data);
      if (!found) throw notFound("Job");
      if (found.job.procedureId)
        throw new HttpError(409, "conflict", "This job already has its steps.");
      if (!d.generator.fromRecording)
        return c.json({ status: "unavailable" as const, message: GENERATE_UNAVAILABLE });

      const moments = [...parsed.data.moments].sort((a, b) => a.atSec - b.atSec);
      const evs = await Promise.all(
        moments.map((m) => d.evidence.getForOwner(user.id, jobId.data, m.evidenceId)),
      );
      for (const ev of evs)
        if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");
      const photos = await Promise.all(evs.map((ev) => d.evidenceStorage.download(ev!.storageKey)));
      const asset = found.job.assetId
        ? await d.assets.getForOwner(user.id, found.job.assetId)
        : null;
      const task = parsed.data.task ?? found.job.title;

      const result = await d.generator.fromRecording({
        asset: asset ? { make: asset.make, model: asset.model } : null,
        task,
        moments: moments.map((m, i) => ({
          atSec: m.atSec,
          said: m.said,
          photo: { bytes: photos[i]!, mimeType: evs[i]!.mimeType },
        })),
      });
      if (result.status === "unavailable") return c.json(result);

      const { draft, fixes, citedSteps } = normalizeDraft(result.draft, {
        manualPages: null,
        recordingSec: Math.ceil(moments.at(-1)!.atSec),
      });
      if (fixes.length) d.log({ level: "info", event: "procedure_fixes", fixes });
      // The moment each step came from: its citation points at it, and its photo is the reference.
      const stepMoments = draft.steps.map((s) => {
        if (s.citation.kind !== "expert_recording") return null;
        const t = s.citation.timestampSec;
        return moments.reduce((best, m) =>
          Math.abs(m.atSec - t) < Math.abs(best.atSec - t) ? m : best,
        );
      });
      const procedureId = randomUUID();
      const stepIds = draft.steps.map(() => randomUUID());
      await d.procedures.save({
        ownerId: user.id,
        jobId: jobId.data,
        procedureId,
        assetModelKey: asset ? assetModelKey(asset.make, asset.model) : projectKey(task),
        manualId: null,
        draft,
        partIds: new Map(draft.parts.map((p) => [p.ref, randomUUID()])),
        stepIds,
        surface: "phone",
        fromRecording: true,
        stepMoments: stepMoments.map((m) => m?.evidenceId ?? null),
        event: { steps: draft.steps.length, cited_steps: citedSteps, moments: moments.length },
      });

      if (d.stepState) {
        const after = await d.jobs.getForOwner(user.id, jobId.data);
        await Promise.all(
          stepMoments.map(async (m, i) => {
            const jobStep = after?.steps.find((js) => js.procedureStepId === stepIds[i]);
            if (m && jobStep) await d.stepState!.setReference(jobStep.id, m.evidenceId, "phone");
          }),
        );
      }
      const detail = await d.procedures.getDetail(user.id, procedureId);
      if (!detail) throw new Error("saved procedure not readable");
      return c.json({ status: "created" as const, detail, citedSteps }, 201);
    });
}
