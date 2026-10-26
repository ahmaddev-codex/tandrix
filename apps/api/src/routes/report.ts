// Job reports: the owner's view (GET /jobs/:id/report), share links (POST, GET and DELETE
// /jobs/:id/share), and the public read-only report behind a link (GET /report/:token).
import { createHash, randomBytes } from "node:crypto";
import {
  CreateShareRequest,
  Id,
  type CreateShareResponse,
  type JobReportResponse,
} from "@tandrix/contracts";
import { Hono, type Context } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import { rateLimiter, type RateLimiter } from "../rate-limit";
import { buildReport, type ReportDeps } from "../report";

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const DAY_MS = 86_400_000;

export const LINK_GONE = "This report link has expired or was turned off. Ask for a new one.";

export interface ReportRouteDeps extends ReportDeps {
  now?: () => number;
  clientKey?: (c: Context) => string;
  limiter?: RateLimiter;
}

/** Mounted at /jobs/:id, behind sign-in. */
export function jobReportRoutes(d: ReportRouteDeps) {
  const now = d.now ?? Date.now;
  const jobId = (c: Context) => {
    const id = Id.safeParse(c.req.param("id"));
    if (!id.success) throw notFound("Job");
    return id.data;
  };
  const owned = async (c: Context<AuthEnv>) => {
    const id = jobId(c);
    if (!(await d.jobs.getForOwner(c.get("user").id, id))) throw notFound("Job");
    return id;
  };
  return new Hono<AuthEnv>()
    .get("/report", async (c) => {
      const report = await buildReport(d, c.get("user").id, jobId(c), new Date(now()));
      if (!report) throw notFound("Job");
      return c.json(report satisfies JobReportResponse);
    })
    .post("/share", async (c) => {
      const id = await owned(c);
      const parsed = CreateShareRequest.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const token = randomBytes(32).toString("base64url");
      const link = await d.reports.createShare(
        id,
        hash(token),
        new Date(now() + parsed.data.days * DAY_MS).toISOString(),
      );
      return c.json({ link, token } satisfies CreateShareResponse, 201);
    })
    .get("/share", async (c) => c.json({ links: await d.reports.listShares(await owned(c)) }))
    .delete("/share/:linkId", async (c) => {
      const id = await owned(c);
      const linkId = Id.safeParse(c.req.param("linkId"));
      if (
        !linkId.success ||
        !(await d.reports.revokeShare(id, linkId.data, new Date(now()).toISOString()))
      )
        throw notFound("Share link");
      return c.body(null, 204);
    });
}

/** GET /report/:token: anyone holding a live link, signed out. Read-only. */
export function publicReportRoutes(d: ReportRouteDeps) {
  const now = d.now ?? Date.now;
  const limiter = d.limiter ?? rateLimiter(60, 60_000);
  const clientKey = d.clientKey ?? (() => "unknown");
  return new Hono().get("/:token", async (c) => {
    if (!limiter.allow(clientKey(c))) throw tooMany();
    const token = c.req.param("token");
    const gone = () => new HttpError(404, "not_found", LINK_GONE);
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw gone();
    const at = new Date(now());
    const share = await d.reports.findShare(hash(token), at.toISOString());
    if (!share) throw gone();
    const report = await buildReport(d, share.ownerId, share.jobId, at);
    if (!report) throw gone();
    // Shared reports must never be cached by browsers or proxies: links can be turned off.
    c.header("Cache-Control", "private, no-store");
    c.header("X-Robots-Tag", "noindex");
    return c.json(report satisfies JobReportResponse);
  });
}
