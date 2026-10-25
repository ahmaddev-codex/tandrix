// The parts check: one photo of the laid-out parts against the procedure's parts list. Missing
// parts block the steps that need them; finding them later (a new check or a correction) lifts
// those blocks only (@tandrix/core applyPartsCheck).
import { applyPartsCheck, missingPartsNote } from "@tandrix/core";
import {
  CorrectPartRequest,
  Id,
  PartsCheckRequest,
  type JobStep,
  type PartsCheck,
  type PartsCheckResponse,
  type ProcedureDetail,
} from "@tandrix/contracts";
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound } from "../errors";
import type { PartsChecker } from "../parts-checker";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import type { BlockChanges, PartsChecksRepo } from "../repos/parts-checks";
import type { ProceduresRepo } from "../repos/procedures";

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export interface PartsDeps {
  jobs: JobsRepo;
  procedures: ProceduresRepo;
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  partsChecks: PartsChecksRepo;
  checker: PartsChecker;
}

/** Which steps the results block or unblock, with the note each blocked step shows. */
function blockChanges(
  detail: ProcedureDetail,
  steps: JobStep[],
  results: PartsCheck["results"],
): BlockChanges {
  const decision = applyPartsCheck(
    steps.map((s) => ({
      stepId: s.id,
      status: s.status,
      partSpecIds: detail.steps.find((p) => p.id === s.procedureStepId)?.partSpecIds ?? [],
      ...(s.blockedBy ? { blockedBy: s.blockedBy } : {}),
    })),
    results,
  );
  const name = (id: string) => detail.parts.find((p) => p.id === id)?.name ?? "a part";
  return {
    block: decision.block.map((b) => ({
      jobStepId: b.stepId,
      fromStatus: steps.find((s) => s.id === b.stepId)!.status,
      note: missingPartsNote(b.missingPartSpecIds.map(name)),
    })),
    unblock: decision.unblock,
  };
}

export function partsRoutes(d: PartsDeps) {
  /** The caller's job with its procedure; a parts check needs the steps first. */
  const jobProcedure = async (ownerId: string, rawJobId: string | undefined) => {
    const jobId = Id.safeParse(rawJobId);
    if (!jobId.success) throw notFound("Job");
    const found = await d.jobs.getForOwner(ownerId, jobId.data);
    if (!found) throw notFound("Job");
    const detail = found.job.procedureId
      ? await d.procedures.getDetail(ownerId, found.job.procedureId)
      : null;
    if (!detail)
      throw new HttpError(
        409,
        "conflict",
        "Write the steps first: the parts list comes with them.",
      );
    return { jobId: jobId.data, steps: found.steps, detail };
  };

  return new Hono<AuthEnv>()
    .post("/", async (c) => {
      const user = c.get("user");
      const { jobId, steps, detail } = await jobProcedure(user.id, c.req.param("id"));
      const parsed = PartsCheckRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const reply = (r: PartsCheckResponse) => c.json(r);
      if (!detail.parts.length) return reply({ status: "no_parts" });

      const ev = await d.evidence.getForOwner(user.id, jobId, parsed.data.evidenceId);
      if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");
      if (!ev.width || !ev.height) {
        throw new HttpError(
          422,
          "invalid_request",
          "This photo has no size recorded. Take it again.",
        );
      }

      const outcome = await d.checker.check({
        photo: { bytes: await d.storage.download(ev.storageKey), mimeType: ev.mimeType },
        size: { width: ev.width, height: ev.height },
        parts: detail.parts.map((p) => ({ id: p.id, name: p.name, qty: p.qty })),
      });
      if (outcome.status === "unavailable") return reply(outcome);

      // Every listed part exactly once, whatever the checker returned.
      const detections: Array<{
        id: string;
        label: string;
        partSpecId: string;
        box: { x: number; y: number; w: number; h: number };
        confidence: number;
      }> = [];
      const results: PartsCheck["results"] = detail.parts.map((part) => {
        const r = outcome.results.find((x) => x.partSpecId === part.id);
        const status = r?.status ?? "missing";
        const ids = (status === "missing" ? [] : (r?.boxes ?? [])).map((b) => {
          const id = randomUUID();
          detections.push({
            id,
            label: part.name,
            partSpecId: part.id,
            box: b.box,
            confidence: b.confidence,
          });
          return id;
        });
        return { partSpecId: part.id, status, detectionIds: ids };
      });

      const partsCheck = await d.partsChecks.save({
        ownerId: user.id,
        jobId,
        evidenceId: ev.id,
        detections,
        results,
        ...blockChanges(detail, steps, results),
      });
      const after = await d.jobs.getForOwner(user.id, jobId);
      return reply({
        status: "checked",
        partsCheck,
        detections: detections.map((x) => ({
          id: x.id,
          evidenceId: ev.id,
          label: x.label,
          partSpecId: x.partSpecId,
          box: x.box,
          mask: null,
          confidence: x.confidence,
          confirmedByUser: null,
        })),
        steps: after?.steps ?? steps,
      });
    })
    .patch("/:partsCheckId/parts/:partSpecId", async (c) => {
      const user = c.get("user");
      const { jobId, steps, detail } = await jobProcedure(user.id, c.req.param("id"));
      const checkId = Id.safeParse(c.req.param("partsCheckId"));
      if (!checkId.success) throw notFound("Parts check");
      const parsed = CorrectPartRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const current = await d.partsChecks.getForJob(jobId, checkId.data);
      if (!current) throw notFound("Parts check");
      const partSpecId = c.req.param("partSpecId");
      if (!current.results.some((r) => r.partSpecId === partSpecId)) throw notFound("Part");

      const results = current.results.map((r) =>
        r.partSpecId === partSpecId ? { ...r, status: parsed.data.status } : r,
      );
      const partsCheck = await d.partsChecks.correct({
        ownerId: user.id,
        partsCheckId: current.id,
        results,
        ...blockChanges(detail, steps, results),
      });
      const after = await d.jobs.getForOwner(user.id, jobId);
      return c.json({ partsCheck, steps: after?.steps ?? steps });
    });
}
