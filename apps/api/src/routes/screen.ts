// POST /jobs/:id/screen/ask: Show me on the Mac. The screenshot is the job's evidence; the answer
// is words plus where to point. Proposed actions are returned for drawing, never executed here.
import {
  Id,
  ScreenAskRequest,
  type DesktopAction,
  type PointerTarget,
  type ScreenAskResponse,
} from "@tandrix/contracts";
import { Hono } from "hono";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { invalid, notFound } from "../errors";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import type { ProceduresRepo } from "../repos/procedures";
import type { ScreenGuide } from "../screen-guide";

export interface ScreenDeps {
  jobs: JobsRepo;
  assets: AssetsRepo;
  procedures: ProceduresRepo;
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  guide: ScreenGuide;
}

const verbs: Partial<Record<DesktopAction["type"], string>> = {
  click: "Click here",
  double_click: "Double-click here",
  scroll: "Scroll here",
  drag: "Drag from here",
  move: "Look here",
};

/** The first proposed action with a place on screen, as a pointer target inside the screenshot. */
export function pointerFor(
  actions: DesktopAction[],
  evidenceId: string,
  size: { width: number; height: number },
): PointerTarget | null {
  for (const a of actions) {
    const at = a.type === "drag" ? a.path[0] : "x" in a ? { x: a.x, y: a.y } : undefined;
    if (!at) continue;
    if (at.x >= size.width || at.y >= size.height) return null;
    return {
      surface: "screen",
      evidenceId,
      label: verbs[a.type] ?? "Look here",
      geometry: { kind: "point", point: at },
    };
  }
  return null;
}

const issues = (e: z.ZodError) =>
  e.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`);

export const CANT_POINT = "I can't see how to do that on this screen. Try asking another way.";

export function screenRoutes(d: ScreenDeps) {
  return new Hono<AuthEnv>().post("/ask", async (c) => {
    const user = c.get("user");
    const jobId = Id.safeParse(c.req.param("id"));
    if (!jobId.success) throw notFound("Job");
    const found = await d.jobs.getForOwner(user.id, jobId.data);
    if (!found) throw notFound("Job");
    const parsed = ScreenAskRequest.safeParse(await c.req.json().catch(() => undefined));
    if (!parsed.success) throw invalid(issues(parsed.error));
    const req = parsed.data;
    const reply = (r: ScreenAskResponse) => c.json(r);

    const ev = await d.evidence.getForOwner(user.id, jobId.data, req.evidenceId);
    if (!ev || !ev.uploadedAt || ev.kind !== "screenshot") throw notFound("Screenshot");

    // Context: the equipment and the step in hand (the current one, else the one in progress).
    const { job, steps } = found;
    const jobStep =
      steps.find((s) => s.id === job.currentStepId) ??
      steps.find((s) => s.status === "in_progress");
    const [asset, procedure] = await Promise.all([
      job.assetId ? d.assets.getForOwner(user.id, job.assetId) : null,
      jobStep && job.procedureId ? d.procedures.getDetail(user.id, job.procedureId) : null,
    ]);
    const step = procedure?.steps.find((s) => s.id === jobStep?.procedureStepId);
    const context = [
      asset ? `Equipment: ${asset.make} ${asset.model}` : "",
      step ? `Step: ${step.title}` : "",
      step ? `Instruction: ${step.instruction}` : "",
    ].filter(Boolean);

    const size = { width: req.geometry.imageWidth, height: req.geometry.imageHeight };
    const outcome = await d.guide.ask({
      screenshot: {
        bytes: await d.storage.download(ev.storageKey),
        mimeType: ev.mimeType,
        ...size,
      },
      question: req.transcript,
      context,
    });
    if (outcome.status === "unavailable") return reply(outcome);

    const target = pointerFor(outcome.actions, ev.id, size);
    return reply({
      status: "answered",
      reply: (outcome.reply || (target ? `${target.label}.` : CANT_POINT)).slice(0, 600),
      target,
      proposed: outcome.actions.slice(0, 16),
    });
  });
}
