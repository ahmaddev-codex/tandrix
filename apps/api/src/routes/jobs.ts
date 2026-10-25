import { CreateJobRequest, HandoffRequest, Id, type HandoffResponse } from "@tandrix/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../auth";
import { invalid, notFound } from "../errors";
import type { AssetsRepo } from "../repos/assets";
import type { JobsRepo } from "../repos/jobs";
import { assetModelKey, type ManualsRepo } from "../repos/manuals";
import type { ProceduresRepo } from "../repos/procedures";
import type { StepStateRepo } from "../repos/step-state";
import type { PartsChecksRepo } from "../repos/parts-checks";
import { clientSurface, SURFACE_HEADER } from "./steps";

const ListQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export function jobsRoutes(
  repo: JobsRepo,
  assets: AssetsRepo,
  manuals: ManualsRepo,
  procedures: ProceduresRepo,
  stepState: StepStateRepo,
  partsChecks: PartsChecksRepo,
) {
  return new Hono<AuthEnv>()
    .post("/", async (c) => {
      const body = await c.req.json().catch(() => undefined);
      const parsed = CreateJobRequest.safeParse(body);
      if (!parsed.success) throw invalid(issues(parsed.error));
      const user = c.get("user");
      if (parsed.data.assetId && !(await repo.ownsAsset(user.id, parsed.data.assetId))) {
        throw notFound("Asset");
      }
      const job = await repo.create({
        ownerId: user.id,
        title: parsed.data.title,
        ...(parsed.data.assetId ? { assetId: parsed.data.assetId } : {}),
        language: parsed.data.language,
        surface: parsed.data.surface,
      });
      return c.json({ job }, 201);
    })
    .post("/:id/handoff", async (c) => {
      const id = Id.safeParse(c.req.param("id"));
      if (!id.success) throw notFound("Job");
      const parsed = HandoffRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const job = await repo.handOff({
        ownerId: c.get("user").id,
        jobId: id.data,
        to: parsed.data.to,
        ...(parsed.data.stepId ? { jobStepId: parsed.data.stepId } : {}),
        by: clientSurface(c.req.header(SURFACE_HEADER)),
      });
      return c.json({ job } satisfies HandoffResponse);
    })
    .get("/", async (c) => {
      const q = ListQuery.safeParse(c.req.query());
      if (!q.success) throw invalid(issues(q.error));
      const jobs = await repo.listForOwner(c.get("user").id, q.data.limit);
      return c.json({ jobs });
    })
    .get("/:id", async (c) => {
      const id = Id.safeParse(c.req.param("id"));
      if (!id.success) throw notFound("Job");
      const user = c.get("user");
      const found = await repo.getForOwner(user.id, id.data);
      if (!found) throw notFound("Job");
      const asset = found.job.assetId ? await assets.getForOwner(user.id, found.job.assetId) : null;
      const manual = asset
        ? await manuals.findForModel(user.id, assetModelKey(asset.make, asset.model))
        : null;
      const procedure = found.job.procedureId
        ? await procedures.getDetail(user.id, found.job.procedureId)
        : null;
      const safetyConfirmations = procedure ? await stepState.confirmations(found.job.id) : [];
      const partsCheck = procedure ? await partsChecks.latest(found.job.id) : null;
      return c.json({ ...found, asset, manual, procedure, safetyConfirmations, partsCheck });
    });
}
