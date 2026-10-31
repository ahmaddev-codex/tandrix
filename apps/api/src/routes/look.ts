// Point the camera (L1): POST /look, one frame from the phone's live camera and a question about
// it. The frame goes to the model and is never stored. With a job, its equipment and the step in
// hand are the context, so "where does this go?" is answered for that step.
import { calledLine } from "@tandrix/ai";
import { INLINE_SCREENSHOT_MAX_BYTES, LookRequest, type LookResponse } from "@tandrix/contracts";
import { refusalForRequest } from "@tandrix/core";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import type { Looker } from "../looker";
import { modelLimiter, type RateLimiter } from "../rate-limit";
import type { AssetsRepo } from "../repos/assets";
import type { JobsRepo } from "../repos/jobs";
import type { ProceduresRepo } from "../repos/procedures";

const frameLimit = bodyLimit({
  maxSize: Math.ceil((INLINE_SCREENSHOT_MAX_BYTES * 4) / 3) + 64 * 1024,
  onError: () => {
    throw new HttpError(413 as ContentfulStatusCode, "invalid_request", "That photo is too large.");
  },
});

export function lookRoutes(d: {
  looker: Looker;
  jobs: JobsRepo;
  assets: AssetsRepo;
  procedures: ProceduresRepo;
  limiter?: RateLimiter;
}) {
  const limiter = d.limiter ?? modelLimiter();
  return new Hono<AuthEnv>().post("/", frameLimit, async (c) => {
    const user = c.get("user");
    if (!limiter.allow(user.id)) throw tooMany();
    const parsed = LookRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success)
      throw invalid(parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`));
    const req = parsed.data;
    const reply = (r: LookResponse) => c.json(r);

    // Safety first, without the model: wiring and live work are refused whatever is asked.
    const refusal = refusalForRequest(req.question);
    if (refusal) return reply({ status: "refused", message: refusal.reason });

    const context: string[] = [];
    if (req.jobId) {
      const found = await d.jobs.getForOwner(user.id, req.jobId);
      if (!found) throw notFound("Job");
      const { job, steps } = found;
      const asset = job.assetId ? await d.assets.getForOwner(user.id, job.assetId) : null;
      if (asset) context.push(`Equipment: ${asset.make} ${asset.model}`);
      const jobStep =
        steps.find((s) => s.id === req.stepId) ??
        steps.find((s) => s.id === job.currentStepId) ??
        steps.find((s) => s.status === "in_progress");
      const procedure =
        jobStep && job.procedureId ? await d.procedures.getDetail(user.id, job.procedureId) : null;
      const step = procedure?.steps.find((s) => s.id === jobStep?.procedureStepId);
      if (step) {
        context.push(`Step ${step.order}: ${step.title}`, `Instruction: ${step.instruction}`);
        const parts = procedure?.parts
          .filter((p) => step.partSpecIds.includes(p.id))
          .map((p) => p.name);
        if (parts?.length) context.push(`Parts for this step: ${parts.join(", ")}`);
      }
    }
    if (req.userName) context.push(calledLine(req.userName));

    const r = await d.looker.look({
      photo: { bytes: Buffer.from(req.photo.data, "base64"), mimeType: req.photo.mimeType },
      size: { width: req.width, height: req.height },
      question: req.question,
      context,
    });
    return reply(r);
  });
}
