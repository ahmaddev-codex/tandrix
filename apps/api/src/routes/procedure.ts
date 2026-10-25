// Generate the job's procedure from its manual (or generic steps, if the user chooses), then
// apply the deterministic rules and save it with the job's steps in one transaction.
import { normalizeDraft } from "@tandrix/core";
import { GenerateProcedureRequest, Id } from "@tandrix/contracts";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound } from "../errors";
import type { ProcedureGenerator } from "../procedure-generator";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import { assetModelKey, type ManualsRepo } from "../repos/manuals";
import type { ProceduresRepo } from "../repos/procedures";

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export interface ProcedureDeps {
  jobs: JobsRepo;
  assets: AssetsRepo;
  manuals: ManualsRepo;
  manualStorage: EvidenceStorage;
  procedures: ProceduresRepo;
  generator: ProcedureGenerator;
  log: (l: Record<string, unknown>) => void;
}

/** Procedures for projects without equipment are keyed by their goal, apart from equipment keys. */
export const projectKey = (task: string) =>
  `project|${task.trim().toLowerCase().replace(/\s+/g, " ")}`.slice(0, 260);

export function procedureRoutes(d: ProcedureDeps) {
  return new Hono<AuthEnv>().post("/", async (c) => {
    const user = c.get("user");
    const jobId = Id.safeParse(c.req.param("id"));
    if (!jobId.success) throw notFound("Job");
    const parsed = GenerateProcedureRequest.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw invalid(issues(parsed.error));

    const found = await d.jobs.getForOwner(user.id, jobId.data);
    if (!found) throw notFound("Job");
    if (found.job.procedureId)
      throw new HttpError(409, "conflict", "This job already has its steps.");
    // Equipment is optional: a project ("assemble a home server rack") works from its goal, and
    // its steps are all Generic because there is no manual to cite.
    const asset = found.job.assetId ? await d.assets.getForOwner(user.id, found.job.assetId) : null;
    const task = parsed.data.task ?? found.job.title;

    const key = asset ? assetModelKey(asset.make, asset.model) : projectKey(task);
    const manual = asset ? await d.manuals.findForModel(user.id, key) : null;
    if (asset && !manual && !parsed.data.allowGeneric) {
      throw new HttpError(
        409,
        "conflict",
        "Add the manual first, or continue with general steps that aren't from the manual.",
      );
    }

    const result = await d.generator.generate({
      asset: asset ? { make: asset.make, model: asset.model } : null,
      task,
      manual: manual
        ? { bytes: await d.manualStorage.download(manual.storageKey), pages: manual.pageCount }
        : null,
    });
    if (result.status === "unavailable") return c.json(result);

    const { draft, fixes, citedSteps } = normalizeDraft(result.draft, {
      manualPages: manual?.pageCount ?? null,
    });
    if (fixes.length) d.log({ level: "info", event: "procedure_fixes", fixes });

    const procedureId = randomUUID();
    const partIds = new Map(draft.parts.map((p) => [p.ref, randomUUID()]));
    await d.procedures.save({
      ownerId: user.id,
      jobId: jobId.data,
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
    const detail = await d.procedures.getDetail(user.id, procedureId);
    if (!detail) throw new Error("saved procedure not readable");
    return c.json({ status: "created" as const, detail, citedSteps }, 201);
  });
}
