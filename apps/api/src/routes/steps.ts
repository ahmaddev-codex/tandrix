// Step work: highlight the step's parts in a photo, and record the user's verdict on a
// highlight. Everything is scoped to the caller's job.
import {
  parseVoiceCommand,
  refusalFor,
  refusalForRequest,
  requiredGates,
  transitionStep,
  type StepEvent,
} from "@tandrix/core";
import {
  AskStepRequest,
  CheckStepRequest,
  type CheckStepResponse,
  CorrectDetectionRequest,
  StepActionRequest,
  type AskStepResponse,
  type StepActionResponse,
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
import type { StepStateRepo } from "../repos/step-state";
import type { AssetsRepo } from "../repos/assets";
import type { StepAnswerer } from "../voice";
import type { StepChecker } from "../step-checker";

/** Offline actions may be replayed up to a day later. */
export const MAX_ACTION_AGE_MS = 24 * 60 * 60 * 1000;

/** The action's time: the client's, when plausible (not future, under a day old), else now. */
export function actionTime(occurredAt: string | undefined, nowMs: number): string {
  const t = occurredAt ? Date.parse(occurredAt) : NaN;
  return new Date(
    Number.isFinite(t) && t <= nowMs && nowMs - t <= MAX_ACTION_AGE_MS ? t : nowMs,
  ).toISOString();
}

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
  stepState: StepStateRepo;
  answerer: StepAnswerer;
  checker: StepChecker;
  assets: AssetsRepo;
  now?: () => number;
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
  return { jobId: jobId.data, job: found.job, jobStep, step, parts };
}

export function stepRoutes(d: StepDeps) {
  const now = d.now ?? Date.now;
  return new Hono<AuthEnv>()
    .post("/:stepId/check", async (c) => {
      const user = c.get("user");
      const { jobId, jobStep, step } = await stepFor(
        d,
        user.id,
        c.req.param("id"),
        c.req.param("stepId"),
      );
      const parsed = CheckStepRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const reply = (r: CheckStepResponse) => c.json(r);

      const ev = await d.evidence.getForOwner(user.id, jobId, parsed.data.evidenceId);
      if (!ev || !ev.uploadedAt || ev.kind !== "photo") throw notFound("Photo");

      const at = new Date(now()).toISOString();
      const state = {
        status: jobStep.status,
        startedAt: jobStep.startedAt,
        statusEvidenceId: jobStep.statusEvidenceId,
        lastCheck: null,
        ...(jobStep.note ? { note: jobStep.note } : {}),
      };
      const ctx = {
        verification: step.verification,
        hazardTags: step.hazardTags,
        confirmedGates: [],
        ...(step.measurement ? { measurement: step.measurement } : {}),
      };
      // Apply the rules before spending a model call: wrong step state or an old photo fail here.
      const precheck = transitionStep(
        state,
        {
          type: "check",
          result: "not_verifiable",
          evidenceId: ev.id,
          evidenceCapturedAt: ev.capturedAt,
          at,
        },
        ctx,
      );
      if (!precheck.ok)
        return reply({ status: "rejected", code: precheck.code, message: precheck.message });

      const outcome = await d.checker.check({
        jobStepId: jobStep.id,
        photo: { bytes: await d.storage.download(ev.storageKey), mimeType: ev.mimeType },
        instruction: step.instruction,
        expectedState: step.expectedState,
      });
      if (outcome.status === "unavailable") return reply(outcome);

      const result = transitionStep(
        state,
        {
          type: "check",
          result: outcome.result,
          evidenceId: ev.id,
          evidenceCapturedAt: ev.capturedAt,
          at,
        },
        ctx,
      );
      if (!result.ok)
        return reply({ status: "rejected", code: result.code, message: result.message });
      const saved = await d.stepState.recordCheck({
        transition: {
          ownerId: user.id,
          jobStepId: jobStep.id,
          fromStatus: jobStep.status,
          to: {
            status: result.state.status,
            startedAt: result.state.startedAt,
            statusEvidenceId: result.state.statusEvidenceId,
            ...(result.state.note ? { note: result.state.note } : {}),
          },
          surface: "phone",
          event: {},
        },
        evidenceId: ev.id,
        result: outcome.result,
        reason: outcome.reason,
        ...(outcome.whatToShowNext ? { whatToShowNext: outcome.whatToShowNext } : {}),
      });
      return reply({ status: "checked", check: saved.check, step: saved.step });
    })
    .post("/:stepId/ask", async (c) => {
      const user = c.get("user");
      const { job, step, parts } = await stepFor(
        d,
        user.id,
        c.req.param("id"),
        c.req.param("stepId"),
      );
      const parsed = AskStepRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const reply = (r: AskStepResponse) => c.json(r);
      const { text, stuck } = parsed.data;

      // Safety first, without the model: wiring and live work are refused whatever is asked.
      const refusal = refusalForRequest(text);
      if (refusal) return reply({ status: "refused", message: refusal.reason });

      const command = stuck ? null : parseVoiceCommand(text);
      if (command && command.kind !== "stuck") return reply({ status: "command", command });

      const asset = job.assetId ? await d.assets.getForOwner(user.id, job.assetId) : null;
      const r = await d.answerer.answer({
        step: {
          title: step.title,
          instruction: step.instruction,
          ...(step.reason ? { reason: step.reason } : {}),
          ...(step.caution ? { caution: step.caution } : {}),
          parts: parts.map((p) => p.name),
          hazards: step.hazardTags,
        },
        ...(asset ? { equipment: `${asset.make} ${asset.model}` } : {}),
        question:
          command?.kind === "stuck" && command.detail ? `I'm stuck on ${command.detail}` : text,
        stuck: stuck || command?.kind === "stuck",
      });
      return reply(r);
    })
    .post("/:stepId/actions", async (c) => {
      const user = c.get("user");
      const { jobId, jobStep, step } = await stepFor(
        d,
        user.id,
        c.req.param("id"),
        c.req.param("stepId"),
      );
      const parsed = StepActionRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const action = parsed.data;
      const reply = (r: StepActionResponse) => c.json(r);
      const forStep = async () =>
        (await d.stepState.confirmations(jobId)).filter((x) => x.jobStepId === jobStep.id);

      if (action.action === "confirm_safety") {
        // A refused step has nothing to confirm: Tandrix doesn't guide it at all.
        const refusal = refusalFor(step.hazardTags);
        if (refusal) return reply({ status: "rejected", code: "refused", message: refusal.reason });
        if (!requiredGates(step.hazardTags).includes(action.gate)) {
          throw invalid([`gate: this step doesn't need ${action.gate}`]);
        }
        await d.stepState.confirmGate(user.id, jobStep.id, action.gate, "phone");
        return reply({ status: "applied", step: jobStep, confirmations: await forStep() });
      }

      const confirmations = await forStep();
      // An action replayed from the offline queue keeps when it happened, within limits.
      const at = actionTime(action.occurredAt, now());
      const event: StepEvent =
        action.action === "start"
          ? { type: "start", at }
          : action.action === "confirm_done"
            ? {
                type: "confirm_done",
                at,
                ...(action.measuredValue !== undefined
                  ? { measuredValue: action.measuredValue }
                  : {}),
              }
            : action.action === "skip"
              ? { type: "skip", reason: action.reason, at }
              : { type: "reopen", at };
      const result = transitionStep(
        {
          status: jobStep.status,
          startedAt: jobStep.startedAt,
          statusEvidenceId: jobStep.statusEvidenceId,
          lastCheck: jobStep.startedAt
            ? await d.stepState.lastCheckSince(jobStep.id, jobStep.startedAt)
            : null,
          ...(jobStep.note ? { note: jobStep.note } : {}),
        },
        event,
        {
          verification: step.verification,
          hazardTags: step.hazardTags,
          confirmedGates: confirmations.map((x) => x.gate),
          ...(step.measurement ? { measurement: step.measurement } : {}),
        },
      );
      if (!result.ok) {
        return reply({
          status: "rejected",
          code: result.code,
          message: result.message,
          ...(result.gates ? { gates: result.gates } : {}),
        });
      }
      const saved = await d.stepState.applyTransition({
        ownerId: user.id,
        jobStepId: jobStep.id,
        fromStatus: jobStep.status,
        to: {
          status: result.state.status,
          startedAt: result.state.startedAt,
          statusEvidenceId: result.state.statusEvidenceId,
          ...(result.state.note ? { note: result.state.note } : {}),
        },
        surface: "phone",
        event: {
          action: action.action,
          ...(action.action === "confirm_done" && action.measuredValue !== undefined
            ? { measured_value: action.measuredValue }
            : {}),
          ...(action.action === "skip" ? { reason: action.reason } : {}),
        },
      });
      return reply({ status: "applied", step: saved, confirmations });
    })
    .post("/:stepId/highlight", async (c) => {
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
