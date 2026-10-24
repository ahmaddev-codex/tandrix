import { CreateJobRequest, Id } from "@tandrix/contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthEnv } from "../auth";
import { invalid, notFound } from "../errors";
import type { AssetsRepo } from "../repos/assets";
import type { JobsRepo } from "../repos/jobs";
import { assetModelKey, type ManualsRepo } from "../repos/manuals";

const ListQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export function jobsRoutes(repo: JobsRepo, assets: AssetsRepo, manuals: ManualsRepo) {
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
      return c.json({ ...found, asset, manual });
    });
}
