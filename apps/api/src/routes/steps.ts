// Step work: highlight the step's parts in a photo, and record the user's verdict on a
// highlight. Everything is scoped to the caller's job.
import {
  CorrectDetectionRequest,
  HIGHLIGHT_CONFIDENT,
  HighlightRequest,
  Id,
  type HighlightTarget,
} from "@tandrix/contracts";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound } from "../errors";
import type { Highlighter } from "../highlighter";
import type { DetectionsRepo } from "../repos/detections";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import type { ProceduresRepo } from "../repos/procedures";

/** The design system highlights at most three parts at once. */
export const MAX_HIGHLIGHTS = 3;

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export interface StepDeps {
  jobs: JobsRepo;
  procedures: ProceduresRepo;
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  detections: DetectionsRepo;
  highlighter: Highlighter;
}

/** The caller's job step with its procedure step and the parts that step names. */
async function stepFor(d: StepDeps, ownerId: string, rawJobId?: string, rawStepId?: string) {
  const jobId = Id.safeParse(rawJobId);
  const stepId = Id.safeParse(rawStepId);
  if (!jobId.success) throw notFound("Job");
  if (!stepId.success) throw notFound("Step");
  const found = await d.jobs.getForOwner(ownerId, jobId.data);
  if (!found) throw notFound("Job");
  const jobStep = found.steps.find((s) => s.id === stepId.data);
  if (!jobStep || !found.job.procedureId) throw notFound("Step");
  const detail = await d.procedures.getDetail(ownerId, found.job.procedureId);
  const step = detail?.steps.find((s) => s.id === jobStep.procedureStepId);
  if (!detail || !step) throw notFound("Step");
  const parts = step.partSpecIds
    .map((id) => detail.parts.find((p) => p.id === id))
    .filter((p) => p !== undefined);
  return { jobId: jobId.data, step, parts };
}

export function stepRoutes(d: StepDeps) {
  return new Hono<AuthEnv>().post("/:stepId/highlight", async (c) => {
    const user = c.get("user");
    const { jobId, step, parts } = await stepFor(
      d,
      user.id,
      c.req.param("id"),
      c.req.param("stepId"),
    );
    const parsed = HighlightRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) throw invalid(issues(parsed.error));

    const ev = await d.evidence.getForOwner(user.id, jobId, parsed.data.evidenceId);
    if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");
    if (!ev.width || !ev.height) {
      throw new HttpError(
        422,
        "invalid_request",
        "This photo has no size recorded. Take it again.",
      );
    }
    if (!parts.length) return c.json({ status: "no_parts" as const });

    const wanted = parts.slice(0, MAX_HIGHLIGHTS);
    const size = { width: ev.width, height: ev.height };
    const result = await d.highlighter.find({
      photo: { bytes: await d.storage.download(ev.storageKey), mimeType: ev.mimeType },
      size,
      instruction: step.instruction,
      parts: wanted.map((p) => ({ id: p.id, name: p.name })),
    });
    if (result.status === "unavailable") return c.json(result);

    // One highlight per part; ignore anything for a part that wasn't asked about.
    const picks = wanted
      .map((p) => ({ part: p, pick: result.picks.find((x) => x.partSpecId === p.id) }))
      .filter((x) => x.pick !== undefined);
    const saved = await d.detections.insertMany(
      picks.map(({ part, pick }) => ({
        evidenceId: ev.id,
        label: part.name,
        partSpecId: part.id,
        box: pick!.box,
        mask: pick!.mask,
        confidence: pick!.confidence,
      })),
    );
    const targets: HighlightTarget[] = saved.map((det) => {
      // Match by part, not position: one detection per part.
      const part = wanted.find((p) => p.id === det.partSpecId)!;
      return {
        surface: "camera",
        evidenceId: ev.id,
        label: part.name,
        confidence: det.confidence,
        geometry: det.mask
          ? { kind: "mask", box: det.box, mask: det.mask }
          : { kind: "box", box: det.box },
        detectionId: det.id,
        partSpecId: part.id,
        ...(part.partNumber ? { partNumber: part.partNumber } : {}),
        possible: det.confidence < HIGHLIGHT_CONFIDENT,
      };
    });
    const found = new Set(targets.map((t) => t.partSpecId));
    return c.json({
      status: "found" as const,
      evidenceId: ev.id,
      size,
      targets,
      missing: wanted
        .filter((p) => !found.has(p.id))
        .map((p) => ({ partSpecId: p.id, name: p.name })),
      ...(result.hint ? { hint: result.hint } : {}),
    });
  });
}

export function detectionRoutes(d: StepDeps) {
  return new Hono<AuthEnv>().patch("/:detectionId", async (c) => {
    const user = c.get("user");
    const jobId = Id.safeParse(c.req.param("id"));
    const detectionId = Id.safeParse(c.req.param("detectionId"));
    if (!jobId.success || !detectionId.success) throw notFound("Highlight");
    const parsed = CorrectDetectionRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) throw invalid(issues(parsed.error));

    const det = await d.detections.get(detectionId.data);
    // The detection's photo must be on the caller's job.
    const ev = det ? await d.evidence.getForOwner(user.id, jobId.data, det.evidenceId) : null;
    if (!det || !ev) throw notFound("Highlight");

    const v = parsed.data;
    if (v.verdict === "other_part") {
      // Only a part of this procedure: look it up through the job.
      const found = await d.jobs.getForOwner(user.id, jobId.data);
      const detail = found?.job.procedureId
        ? await d.procedures.getDetail(user.id, found.job.procedureId)
        : null;
      const part = detail?.parts.find((p) => p.id === v.partSpecId);
      if (!part) throw invalid(["partSpecId: not a part of this job's procedure"]);
      const updated = await d.detections.setVerdict(det.id, {
        confirmedByUser: true,
        correctedLabel: part.name,
        partSpecId: part.id,
      });
      return c.json({ detection: updated });
    }
    const updated = await d.detections.setVerdict(det.id, {
      confirmedByUser: v.verdict === "confirmed",
    });
    return c.json({ detection: updated });
  });
}
