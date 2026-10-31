// The job's manual: search the web (signed candidates) → fetch safely, or upload a PDF, or build
// one from photographed pages. Manuals are cached per make and model.
import {
  CreateManualUploadRequest,
  FetchManualRequest,
  Id,
  ManualFromPhotosRequest,
  type Asset,
} from "@tandrix/contracts";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import type { ManualFinder } from "../manual-finder";
import { modelLimiter, type RateLimiter } from "../rate-limit";
import { imagesToPdf, pdfPageCount } from "../pdf";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import { assetModelKey, projectKey, type ManualsRepo } from "../repos/manuals";
import { FetchRefused, safeFetchPdf, type SafeFetchOptions } from "../safe-fetch";
import { signToken, verifyToken } from "../signed-token";

export const MAX_MANUAL_BYTES = 60 * 1024 * 1024;
const CANDIDATE_TTL_MS = 30 * 60 * 1000;
const READ_URL_TTL_SEC = 300;

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export interface ManualDeps {
  jobs: JobsRepo;
  assets: AssetsRepo;
  evidence: EvidenceRepo;
  evidenceStorage: EvidenceStorage;
  manuals: ManualsRepo;
  manualStorage: EvidenceStorage;
  finder: ManualFinder;
  tokenSecret: string;
  fetchOptions?: Partial<SafeFetchOptions>;
  now?: () => number;
  limiter?: RateLimiter;
}

export function manualRoutes(d: ManualDeps) {
  const now = d.now ?? Date.now;
  const limiter = d.limiter ?? modelLimiter();

  /** The caller's job and its asset; a manual needs the equipment identified first. */
  const jobAsset = async (ownerId: string, rawJobId: string | undefined): Promise<Asset> => {
    const jobId = Id.safeParse(rawJobId);
    if (!jobId.success) throw notFound("Job");
    const found = await d.jobs.getForOwner(ownerId, jobId.data);
    if (!found) throw notFound("Job");
    const asset = found.job.assetId ? await d.assets.getForOwner(ownerId, found.job.assetId) : null;
    if (!asset) throw new HttpError(409, "conflict", "Identify the equipment first.");
    return asset;
  };
  /**
   * The caller's job and the key its manual is filed under: the equipment's make and model, or, for
   * a project without equipment, its goal. Uploaded and photographed manuals work for either.
   */
  const jobKey = async (ownerId: string, rawJobId: string | undefined) => {
    const jobId = Id.safeParse(rawJobId);
    if (!jobId.success) throw notFound("Job");
    const found = await d.jobs.getForOwner(ownerId, jobId.data);
    if (!found) throw notFound("Job");
    const asset = found.job.assetId ? await d.assets.getForOwner(ownerId, found.job.assetId) : null;
    return {
      jobId: jobId.data,
      key: asset ? assetModelKey(asset.make, asset.model) : projectKey(found.job.title),
    };
  };
  const candidateFields = (userId: string, url: string, key: string) => [
    "manual",
    userId,
    key,
    url,
  ];

  return new Hono<AuthEnv>()
    .post("/search", async (c) => {
      const user = c.get("user");
      if (!limiter.allow(user.id)) throw tooMany();
      const asset = await jobAsset(user.id, c.req.param("id"));
      const key = assetModelKey(asset.make, asset.model);
      const cached = await d.manuals.findForModel(user.id, key);
      if (cached) return c.json({ status: "cached" as const, manual: cached });
      const r = await d.finder.find({ make: asset.make, model: asset.model });
      if (r.status === "unavailable") return c.json(r);
      const exp = now() + CANDIDATE_TTL_MS;
      return c.json({
        status: "found" as const,
        candidates: r.candidates.map((cand) => ({
          ...cand,
          token: signToken(d.tokenSecret, candidateFields(user.id, cand.url, key), exp),
        })),
      });
    })

    .post("/fetch", async (c) => {
      const user = c.get("user");
      const asset = await jobAsset(user.id, c.req.param("id"));
      const parsed = FetchManualRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const key = assetModelKey(asset.make, asset.model);
      if (
        !verifyToken(
          d.tokenSecret,
          candidateFields(user.id, parsed.data.url, key),
          parsed.data.token,
          now(),
        )
      ) {
        throw invalid(["token: this link didn't come from a recent search; search again"]);
      }
      let bytes: Uint8Array;
      let finalUrl: string;
      try {
        ({ bytes, finalUrl } = await safeFetchPdf(parsed.data.url, {
          maxBytes: MAX_MANUAL_BYTES,
          timeoutMs: 20_000,
          ...d.fetchOptions,
        }));
      } catch (e) {
        if (e instanceof FetchRefused) throw new HttpError(422, "invalid_request", e.message);
        throw e;
      }
      const pages = await pdfPageCount(bytes);
      if (!pages)
        throw new HttpError(
          422,
          "invalid_request",
          "That file isn't a readable PDF. Upload the manual instead.",
        );
      const storageKey = `shared/${randomUUID()}.pdf`;
      await d.manualStorage.put(storageKey, bytes, "application/pdf");
      const manual = await d.manuals.insert({
        assetModelKey: key,
        title: parsed.data.title,
        sourceType: "search",
        sourceUrl: finalUrl,
        storageKey,
        pageCount: pages,
        ownerId: null, // shared: it came from a public search result
      });
      await d.manuals.recordAttached(Id.parse(c.req.param("id")), manual.id, "search");
      return c.json({ manual }, 201);
    })

    .post("/upload", async (c) => {
      const user = c.get("user");
      await jobKey(user.id, c.req.param("id"));
      const parsed = CreateManualUploadRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const id = randomUUID();
      const storageKey = `${user.id}/${id}.pdf`;
      await d.manuals.createUpload({
        id,
        ownerId: user.id,
        jobId: Id.parse(c.req.param("id")),
        storageKey,
        title: parsed.data.title,
      });
      const upload = await d.manualStorage.createUploadUrl(storageKey);
      return c.json({ uploadId: id, upload: { bucket: "manuals" as const, ...upload } }, 201);
    })

    .post("/upload/:uploadId/complete", async (c) => {
      const user = c.get("user");
      const { key } = await jobKey(user.id, c.req.param("id"));
      const uploadId = Id.safeParse(c.req.param("uploadId"));
      if (!uploadId.success) throw notFound("Upload");
      const up = await d.manuals.getUpload(user.id, Id.parse(c.req.param("id")), uploadId.data);
      if (!up || up.completedAt) throw notFound("Upload");
      // Claim the upload before the slow checks: a concurrent complete loses the race here and
      // sees it as already done instead of inserting a second manual.
      if (!(await d.manuals.completeUpload(up.id))) throw notFound("Upload");
      const obj = await d.manualStorage.stat(up.storageKey);
      if (!obj) {
        await d.manuals.reopenUpload(up.id);
        throw new HttpError(
          409,
          "conflict",
          "The file hasn't arrived yet. Upload it, then try again.",
        );
      }
      const reject = async (msg: string) => {
        await d.manualStorage.remove(up.storageKey);
        await d.manuals.reopenUpload(up.id);
        throw invalid([msg]);
      };
      if (obj.size > MAX_MANUAL_BYTES) await reject("file is larger than 60 MB");
      const pages = await pdfPageCount(await d.manualStorage.download(up.storageKey));
      if (!pages) await reject("file isn't a readable PDF");
      const manual = await d.manuals.insert({
        assetModelKey: key,
        title: up.title,
        sourceType: "upload",
        sourceUrl: null,
        storageKey: up.storageKey,
        pageCount: pages!,
        ownerId: user.id, // private: a customer's manual may be proprietary
      });
      await d.manuals.recordAttached(up.jobId, manual.id, "upload");
      return c.json({ manual }, 201);
    })

    .post("/from-photos", async (c) => {
      const user = c.get("user");
      const { jobId, key } = await jobKey(user.id, c.req.param("id"));
      const parsed = ManualFromPhotosRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const images: Array<{ bytes: Uint8Array; mimeType: string }> = [];
      for (const eid of parsed.data.evidenceIds) {
        const ev = await d.evidence.getForOwner(user.id, jobId, eid);
        if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");
        if (ev.mimeType !== "image/jpeg" && ev.mimeType !== "image/png") {
          throw invalid([`photo ${eid}: only JPEG and PNG pages can be combined`]);
        }
        images.push({
          bytes: await d.evidenceStorage.download(ev.storageKey),
          mimeType: ev.mimeType,
        });
      }
      const pdf = await imagesToPdf(images);
      if (pdf.length > MAX_MANUAL_BYTES)
        throw invalid(["the pages add up to more than 60 MB; use fewer photos"]);
      const storageKey = `${user.id}/${randomUUID()}.pdf`;
      await d.manualStorage.put(storageKey, pdf, "application/pdf");
      const manual = await d.manuals.insert({
        assetModelKey: key,
        title: parsed.data.title,
        sourceType: "upload",
        sourceUrl: null,
        storageKey,
        pageCount: images.length,
        ownerId: user.id,
      });
      await d.manuals.recordAttached(jobId, manual.id, "photos");
      return c.json({ manual }, 201);
    })

    .get("/:manualId/url", async (c) => {
      const user = c.get("user");
      await jobKey(user.id, c.req.param("id"));
      const manualId = Id.safeParse(c.req.param("manualId"));
      if (!manualId.success) throw notFound("Manual");
      const manual = await d.manuals.getForOwner(user.id, manualId.data);
      if (!manual) throw notFound("Manual");
      const urls = await d.manualStorage.signedReadUrls([manual.storageKey], READ_URL_TTL_SEC);
      const url = urls.get(manual.storageKey);
      if (!url) throw notFound("Manual");
      return c.json({ url, urlExpiresAt: new Date(now() + READ_URL_TTL_SEC * 1000).toISOString() });
    });
}
