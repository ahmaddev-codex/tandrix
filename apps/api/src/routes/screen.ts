// POST /jobs/:id/screen/ask: Show me on the Mac. The screenshot is the job's evidence; the answer
// is words plus where to point. Proposed actions are returned for drawing, never executed here.
import {
  DO_MAX_TURNS,
  DoContinueRequest,
  DoStartRequest,
  Id,
  INLINE_SCREENSHOT_MAX_BYTES,
  ScreenAskInlineRequest,
  type DoTurnResponse,
  ScreenAskRequest,
  type DesktopAction,
  type PointerTarget,
  type ScreenAskResponse,
} from "@tandrix/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import { rateLimiter, type RateLimiter } from "../rate-limit";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import type { ProceduresRepo } from "../repos/procedures";
import type { ScreenGuide, ScreenGuideOutcome } from "../screen-guide";
import { noModelScreenDoer, type DoOutcome, type ScreenDoer } from "../screen-doer";
import { signToken, verifyToken } from "../signed-token";

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
  evidenceId: string | null,
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

    return reply(answered(outcome, ev.id, size));
  });
}

/** The answer to send: the model's words (or a plain fallback), where to point, what it proposed. */
function answered(
  outcome: Extract<ScreenGuideOutcome, { status: "answered" }>,
  evidenceId: string | null,
  size: { width: number; height: number },
): ScreenAskResponse {
  const target = pointerFor(outcome.actions, evidenceId, size);
  return {
    status: "answered",
    reply: (outcome.reply || (target ? `${target.label}.` : CANT_POINT)).slice(0, 600),
    target,
    proposed: outcome.actions.slice(0, 16),
  };
}

/** Earlier turns as context lines, so a follow-up ("and then?") makes sense. */
export const historyContext = (history: Array<{ question: string; reply: string }>) =>
  history.map((t) => `Earlier the user asked: "${t.question}" You answered: "${t.reply}"`);

const screenshotLimit = bodyLimit({
  maxSize: Math.ceil((INLINE_SCREENSHOT_MAX_BYTES * 4) / 3) + 64 * 1024,
  onError: () => {
    throw new HttpError(
      413 as ContentfulStatusCode,
      "invalid_request",
      "That screenshot is too large.",
    );
  },
});

/** The inline screenshot's bytes, checked. */
function shotBytes(shot: { data: string }) {
  const bytes = Uint8Array.from(Buffer.from(shot.data, "base64"));
  if (bytes.length === 0 || bytes.length > INLINE_SCREENSHOT_MAX_BYTES)
    throw invalid(["screenshot: Empty or too large"]);
  return bytes;
}

/** A Do it for me task stays usable this long between turns. */
export const DO_SESSION_MS = 15 * 60 * 1000;

/**
 * The session a Mac continues a task with: the model's response and call, the turn number, and a
 * signature binding them to the user, so no one else can continue it or skip the turn limit.
 */
export function doSession(
  secret: string,
  userId: string,
  responseId: string,
  callId: string,
  turn: number,
  now: number,
) {
  const token = signToken(
    secret,
    ["do", userId, responseId, callId, String(turn)],
    now + DO_SESSION_MS,
  );
  return [responseId, callId, String(turn), token].join("~");
}

export function readDoSession(secret: string, userId: string, session: string, now: number) {
  const [responseId, callId, turn, token] = session.split("~");
  if (!responseId || !callId || !turn || !token || !/^\d+$/.test(turn)) return null;
  if (!verifyToken(secret, ["do", userId, responseId, callId, turn], token, now)) return null;
  return { responseId, callId, turn: Number(turn) };
}

/**
 * The screen outside any job: POST /screen/ask, a question ("teach me Photoshop"), and
 * POST /screen/do and /screen/do/continue, Do it for me. Screenshots come inline, go to the model
 * and are never stored here.
 */
export function inlineScreenRoutes(d: {
  guide: ScreenGuide;
  doer?: ScreenDoer;
  tokenSecret: string;
  limiter?: RateLimiter;
  /** Do it for me turns: up to two a second while a task runs. */
  doLimiter?: RateLimiter;
  now?: () => number;
  log?: (l: Record<string, unknown>) => void;
}) {
  const limiter = d.limiter ?? rateLimiter(30, 60_000);
  const doLimiter = d.doLimiter ?? rateLimiter(120, 60_000);
  const doer = d.doer ?? noModelScreenDoer;
  const now = d.now ?? Date.now;

  /** A model turn as the Mac sees it: actions to run with a session to continue, or done. */
  const turnResponse = (userId: string, outcome: DoOutcome, turn: number): DoTurnResponse => {
    if (outcome.status === "unavailable") return outcome;
    const t = outcome.turn;
    // What happened each turn (never the screen or the words): enough to see where tasks stall.
    d.log?.({
      event: "do_turn",
      turn,
      actions: t.actions.map((a) => a.type).join(","),
      checks: t.safetyChecks.map((c) => c.code).join(","),
      finished: !t.callId,
    });
    if (!t.callId || turn > DO_MAX_TURNS)
      return {
        status: "done",
        reply:
          (t.callId
            ? "That took more steps than Tandrix takes at once. You have control back."
            : t.reply) || "Done.",
      };
    return {
      status: "act",
      session: doSession(d.tokenSecret, userId, t.responseId, t.callId, turn, now()),
      turn,
      actions: t.actions.slice(0, 16),
      safetyChecks: t.safetyChecks.slice(0, 10),
      reply: t.reply.slice(0, 600),
    };
  };

  return new Hono<AuthEnv>()
    .post("/ask", screenshotLimit, async (c) => {
      if (!limiter.allow(c.get("user").id)) throw tooMany();
      const parsed = ScreenAskInlineRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const req = parsed.data;
      const bytes = shotBytes(req.screenshot);
      const size = { width: req.geometry.imageWidth, height: req.geometry.imageHeight };
      const outcome = await d.guide.ask({
        screenshot: { bytes, mimeType: req.screenshot.mimeType, ...size },
        question: req.transcript,
        context: historyContext(req.history),
      });
      if (outcome.status === "unavailable") return c.json(outcome satisfies ScreenAskResponse);
      return c.json(answered(outcome, null, size));
    })
    .post("/do", screenshotLimit, async (c) => {
      const user = c.get("user");
      if (!doLimiter.allow(user.id)) throw tooMany();
      const parsed = DoStartRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      // First, the app the task needs, if it isn't the one in front: the Mac opens it and asks
      // again. Only an app from the Mac's own list is ever named.
      if (!parsed.data.planned) {
        const wanted = await doer.plan({
          task: parsed.data.task,
          apps: parsed.data.apps,
          ...(parsed.data.frontApp ? { frontApp: parsed.data.frontApp } : {}),
        });
        const app = parsed.data.apps.find((a) => a.toLowerCase() === wanted?.toLowerCase());
        if (app && app.toLowerCase() !== parsed.data.frontApp?.toLowerCase())
          return c.json({ status: "open_app", app } satisfies DoTurnResponse);
      }
      const outcome = await doer.start({
        screenshot: {
          bytes: shotBytes(parsed.data.screenshot),
          mimeType: parsed.data.screenshot.mimeType,
        },
        task: parsed.data.task,
      });
      return c.json(turnResponse(user.id, outcome, 1));
    })
    .post("/do/continue", screenshotLimit, async (c) => {
      const user = c.get("user");
      if (!doLimiter.allow(user.id)) throw tooMany();
      const parsed = DoContinueRequest.safeParse(await c.req.json().catch(() => undefined));
      if (!parsed.success) throw invalid(issues(parsed.error));
      const session = readDoSession(d.tokenSecret, user.id, parsed.data.session, now());
      if (!session)
        throw invalid([
          "session: this task has ended or isn't yours; ask again to start a new one",
        ]);
      const outcome = await doer.continue({
        previousResponseId: session.responseId,
        callId: session.callId,
        screenshot: {
          bytes: shotBytes(parsed.data.screenshot),
          mimeType: parsed.data.screenshot.mimeType,
        },
        acknowledged: parsed.data.acknowledged,
      });
      return c.json(turnResponse(user.id, outcome, session.turn + 1));
    });
}
