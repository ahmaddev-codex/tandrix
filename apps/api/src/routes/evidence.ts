// Evidence uploads: create (row + signed upload URL) → client uploads → complete (verified).
import { CreateEvidenceRequest, Id, uploadLimits, type Evidence } from "@tandrix/contracts";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound } from "../errors";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";

const READ_URL_TTL_SEC = 300;

const extension: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "application/pdf": "pdf",
};

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

/** Storage key: owner/job/evidence.ext. The owner prefix keeps one user's files together. */
export const storageKeyFor = (ownerId: string, jobId: string, id: string, mime: string) =>
  `${ownerId}/${jobId}/${id}.${extension[mime] ?? "bin"}`;

export function evidenceRoutes(
  repo: EvidenceRepo,
  storage: EvidenceStorage,
  now = () => new Date(),
) {
  const jobIdParam = (raw: string | undefined) => {
    const id = Id.safeParse(raw);
    if (!id.success) throw notFound("Job");
    return id.data;
  };

  return new Hono<AuthEnv>()
    .post("/", async (c) => {
      const user = c.get("user");
      const jobId = jobIdParam(c.req.param("id"));
      const parsed = CreateEvidenceRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      if (!(await repo.ownsJob(user.id, jobId))) throw notFound("Job");
      const req = parsed.data;
      if (req.jobStepId && !(await repo.stepInJob(jobId, req.jobStepId))) throw notFound("Step");

      const id = randomUUID();
      const storageKey = storageKeyFor(user.id, jobId, id, req.mimeType);
      const evidence = await repo.createPending({
        id,
        jobId,
        jobStepId: req.jobStepId ?? null,
        kind: req.kind,
        surface: req.surface,
        storageKey,
        mimeType: req.mimeType,
        byteSize: req.byteSize,
        ...(req.width ? { width: req.width } : {}),
        ...(req.height ? { height: req.height } : {}),
        capturedAt: req.capturedAt ?? now().toISOString(),
      });
      const upload = await storage.createUploadUrl(storageKey);
      return c.json({ evidence, upload: { bucket: "evidence" as const, ...upload } }, 201);
    })

    .post("/:evidenceId/complete", async (c) => {
      const user = c.get("user");
      const jobId = jobIdParam(c.req.param("id"));
      const evidenceId = Id.safeParse(c.req.param("evidenceId"));
      if (!evidenceId.success) throw notFound("Evidence");
      const ev = await repo.getForOwner(user.id, jobId, evidenceId.data);
      if (!ev) throw notFound("Evidence");
      if (ev.uploadedAt) return c.json({ evidence: ev }); // already confirmed: idempotent

      const obj = await storage.stat(ev.storageKey);
      if (!obj)
        throw new HttpError(
          409,
          "conflict",
          "The file hasn't arrived yet. Upload it, then try again.",
        );

      // Trust what storage holds, not what the client declared.
      const limit = uploadLimits[ev.kind];
      const typeOk =
        obj.contentType !== null && (limit.mime as readonly string[]).includes(obj.contentType);
      if (obj.size < 1 || obj.size > limit.maxBytes || !typeOk) {
        await storage.remove(ev.storageKey);
        throw invalid([
          !typeOk
            ? `file type ${obj.contentType} isn't allowed for ${ev.kind}`
            : `file size ${obj.size} bytes is outside the limit for ${ev.kind}`,
        ]);
      }
      return c.json({ evidence: await repo.markUploaded(ev.id, obj.size) });
    })

    .get("/", async (c) => {
      const user = c.get("user");
      const jobId = jobIdParam(c.req.param("id"));
      if (!(await repo.ownsJob(user.id, jobId))) throw notFound("Job");
      const items = await repo.listUploaded(jobId);
      const urls = await storage.signedReadUrls(
        items.map((e) => e.storageKey),
        READ_URL_TTL_SEC,
      );
      const expires = new Date(now().getTime() + READ_URL_TTL_SEC * 1000).toISOString();
      const out: Array<{ evidence: Evidence; url: string; urlExpiresAt: string }> = [];
      for (const evidence of items) {
        const url = urls.get(evidence.storageKey);
        if (url) out.push({ evidence, url, urlExpiresAt: expires });
      }
      return c.json({ items: out });
    });
}
