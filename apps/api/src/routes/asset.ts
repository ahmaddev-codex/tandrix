// Identify the job's equipment from a nameplate photo, then save what the user confirmed.
import { Id, IdentifyAssetRequest, SaveAssetRequest } from "@tandrix/contracts";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { invalid, notFound, tooMany } from "../errors";
import type { NameplateReader } from "../nameplate";
import { modelLimiter, type RateLimiter } from "../rate-limit";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export function assetRoutes(deps: {
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  assets: AssetsRepo;
  reader: NameplateReader;
  limiter?: RateLimiter;
}) {
  const limiter = deps.limiter ?? modelLimiter();
  const jobIdParam = (raw: string | undefined) => {
    const id = Id.safeParse(raw);
    if (!id.success) throw notFound("Job");
    return id.data;
  };

  /** The nameplate photo must be an uploaded photo on this job, owned by the caller. */
  const nameplatePhoto = async (ownerId: string, jobId: string, evidenceId: string) => {
    const ev = await deps.evidence.getForOwner(ownerId, jobId, evidenceId);
    if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");
    return ev;
  };

  return new Hono<AuthEnv>()
    .post("/identify", async (c) => {
      const user = c.get("user");
      if (!limiter.allow(user.id)) throw tooMany();
      const jobId = jobIdParam(c.req.param("id"));
      const parsed = IdentifyAssetRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      if (!(await deps.evidence.ownsJob(user.id, jobId))) throw notFound("Job");
      const ev = await nameplatePhoto(user.id, jobId, parsed.data.evidenceId);
      const bytes = await deps.storage.download(ev.storageKey);
      return c.json(await deps.reader.read({ bytes, mimeType: ev.mimeType }));
    })

    .put("/", async (c) => {
      const user = c.get("user");
      const jobId = jobIdParam(c.req.param("id"));
      const parsed = SaveAssetRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      if (!(await deps.evidence.ownsJob(user.id, jobId))) throw notFound("Job");
      const req = parsed.data;
      if (req.nameplateEvidenceId) await nameplatePhoto(user.id, jobId, req.nameplateEvidenceId);
      const asset = await deps.assets.saveForJob({
        ownerId: user.id,
        jobId,
        category: req.category,
        make: req.make,
        model: req.model,
        ...(req.serial ? { serial: req.serial } : {}),
        ...(req.nameplateEvidenceId ? { nameplateEvidenceId: req.nameplateEvidenceId } : {}),
        source: req.source,
        ...(req.confidence !== undefined ? { confidence: req.confidence } : {}),
      });
      return c.json({ asset }, 201);
    });
}
