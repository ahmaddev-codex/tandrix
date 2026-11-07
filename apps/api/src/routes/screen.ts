// POST /jobs/:id/screen/ask: Show me on the Mac. The screenshot is the job's evidence; the answer
// is words plus where to point. Proposed actions are returned for drawing, never executed here.
import { calledLine, finishedTurn } from "@tandrix/ai";
import {
  DO_MAX_TURNS,
  BackgroundRequest,
  BackgroundResponse,
  DoContinueRequest,
  DoNotesRequest,
  DoNotesResponse,
  DoStartRequest,
  Id,
  INLINE_SCREENSHOT_MAX_BYTES,
  ScreenAskInlineRequest,
  ScreenLocateRequest,
  type ScreenLocated,
  type DoTurnResponse,
  ScreenAskRequest,
  type DesktopAction,
  type PointerTarget,
  type ScreenAskResponse,
} from "@tandrix/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { stream } from "hono/streaming";
import { cacheKey, ttlCache, type TtlCache } from "../answer-cache";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { z } from "zod";
import type { AuthEnv } from "../auth";
import { HttpError, invalid, notFound, tooMany } from "../errors";
import { modelLimiter, rateLimiter, type RateLimiter } from "../rate-limit";
import type { AssetsRepo } from "../repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "../repos/evidence";
import type { JobsRepo } from "../repos/jobs";
import type { ProceduresRepo } from "../repos/procedures";
import { noModelScreenGuide, type ScreenGuide, type ScreenGuideOutcome } from "../screen-guide";
import {
  BACKGROUND_UNAVAILABLE,
  DO_UNAVAILABLE,
  noModelScreenDoer,
  type DoOutcome,
  type ScreenDoer,
} from "../screen-doer";
import { signToken, verifyToken } from "../signed-token";

export interface ScreenDeps {
  jobs: JobsRepo;
  assets: AssetsRepo;
  procedures: ProceduresRepo;
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  guide: ScreenGuide;
  limiter?: RateLimiter;
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
    if (at.x < 0 || at.y < 0 || at.x >= size.width || at.y >= size.height) return null;
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
  const limiter = d.limiter ?? modelLimiter();
  return new Hono<AuthEnv>().post("/ask", async (c) => {
    const user = c.get("user");
    if (!limiter.allow(user.id)) throw tooMany();
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
    const [asset, procedure, shotData] = await Promise.all([
      job.assetId ? d.assets.getForOwner(user.id, job.assetId) : null,
      jobStep && job.procedureId ? d.procedures.getDetail(user.id, job.procedureId) : null,
      d.storage.download(ev.storageKey),
    ]);
    const step = procedure?.steps.find((s) => s.id === jobStep?.procedureStepId);
    const context = [
      asset ? `Equipment: ${asset.make} ${asset.model}` : "",
      step ? `Step: ${step.title}` : "",
      step ? `Instruction: ${step.instruction}` : "",
      ...historyContext(req.history),
      req.userName ? calledLine(req.userName) : "",
    ].filter(Boolean);

    const size = { width: req.geometry.imageWidth, height: req.geometry.imageHeight };
    const outcome = await d.guide.ask({
      screenshot: {
        bytes: shotData,
        mimeType: ev.mimeType,
        ...size,
      },
      question: req.transcript,
      context,
      ...(req.lesson ? { lesson: req.lesson } : {}),
      ...(req.explain ? { explain: req.explain } : {}),
    });
    if (outcome.status === "unavailable") return reply(outcome);

    return reply(answered(outcome, ev.id, size, req.transcript));
  });
}

/** The answer to send: the model's words (or a plain fallback), where to point, what it proposed. */
function answered(
  outcome: Extract<ScreenGuideOutcome, { status: "answered" }>,
  evidenceId: string | null,
  size: { width: number; height: number },
  question = "",
): ScreenAskResponse {
  // A drag in Show me is an outline (the model's way to frame a region): it becomes a frame.
  void question;
  const dragAction = outcome.actions.find((a) => a.type === "drag" && a.path.length >= 2);
  let target: PointerTarget | null = null;
  if (dragAction && dragAction.type === "drag") {
    const p0 = dragAction.path[0]!;
    const p1 = dragAction.path[dragAction.path.length - 1]!;
    const x = Math.min(p0.x, p1.x);
    const y = Math.min(p0.y, p1.y);
    const w = Math.abs(p1.x - p0.x);
    const h = Math.abs(p1.y - p0.y);
    if (w >= 20 && h >= 16 && x + w <= size.width && y + h <= size.height) {
      target = {
        surface: "screen",
        evidenceId,
        label: outcome.label ?? "Here",
        geometry: { kind: "box", box: { x, y, w, h } },
      };
    }
  }
  if (!target) target = pointerFor(outcome.actions, evidenceId, size);
  return {
    status: "answered",
    reply: (outcome.reply || (target ? `${target.label}.` : CANT_POINT)).slice(0, 1200),
    target,
    proposed: outcome.actions.slice(0, 16),
    note: outcome.note ?? null,
    // Inside the screenshot, whole pixels: what the Mac draws.
    regions: (outcome.regions ?? [])
      .map((r) => ({
        label: r.label,
        detail: r.detail ?? null,
        say: r.say ?? null,
        mark: r.mark ?? "outline",
        quote: r.quote ?? null,
        point:
          r.point && r.point.x < size.width && r.point.y < size.height
            ? { x: Math.max(0, Math.round(r.point.x)), y: Math.max(0, Math.round(r.point.y)) }
            : null,
        box: {
          x: Math.max(0, Math.round(r.box.x)),
          y: Math.max(0, Math.round(r.box.y)),
          w: Math.max(1, Math.round(Math.min(r.box.w, size.width - r.box.x))),
          h: Math.max(1, Math.round(Math.min(r.box.h, size.height - r.box.y))),
        },
      }))
      .filter((r) => r.box.x < size.width && r.box.y < size.height),
    intro: outcome.intro ?? null,
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
/** Where a part was clicked, as kept for a screenshot. */
type Located = {
  point: { x: number; y: number } | null;
  box: { x: number; y: number; w: number; h: number };
};

export function inlineScreenRoutes(d: {
  guide: ScreenGuide;
  /** Answers and located parts kept for a while (tests pass their own). */
  answers?: TtlCache<ScreenAskResponse>;
  located?: TtlCache<Located>;
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
  // One locate follows each answer that marks parts.
  const locateLimiter = rateLimiter(30, 60_000);
  // A repeat is answered at once, and a part already clicked on a screenshot isn't clicked again.
  const answers = d.answers ?? ttlCache<ScreenAskResponse>();
  const located = d.located ?? ttlCache<Located>(2000);
  // Each tool step of a background task is a request, and several tasks run at once.
  const backgroundLimiter = rateLimiter(60, 60_000);
  const doer = d.doer ?? noModelScreenDoer;
  const now = d.now ?? Date.now;

  /** A model turn as the Mac sees it: actions to run with a session to continue, or done. */
  const turnResponse = (userId: string, outcome: DoOutcome, turn: number): DoTurnResponse => {
    if (outcome.status === "unavailable") return outcome;
    const t = outcome.turn;
    const finish = finishedTurn(t);
    // What happened each turn (never the screen or the words): enough to see where tasks stall.
    d.log?.({
      event: "do_turn",
      turn,
      actions: t.actions.map((a) => a.type).join(","),
      checks: t.safetyChecks.map((c) => c.code).join(","),
      finished: finish.done,
    });
    if (finish.done || !t.callId) return { status: "done", reply: finish.reply || "Done." };
    if (turn > DO_MAX_TURNS)
      return {
        status: "done",
        reply: "That took more steps than Tandrix takes at once. You have control back.",
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

  return (
    new Hono<AuthEnv>()
      .post("/ask", screenshotLimit, async (c) => {
        if (!limiter.allow(c.get("user").id)) throw tooMany();
        const parsed = ScreenAskInlineRequest.safeParse(await c.req.json().catch(() => undefined));
        if (!parsed.success) throw invalid(issues(parsed.error));
        const req = parsed.data;
        const bytes = shotBytes(req.screenshot);
        const size = { width: req.geometry.imageWidth, height: req.geometry.imageHeight };
        // The same question, in the same conversation, on the same screenshot: answered at once.
        const key = cacheKey(
          c.get("user").id,
          bytes,
          JSON.stringify({
            q: req.transcript.trim().toLowerCase(),
            mode: req.mode,
            lesson: req.lesson,
            explain: req.explain,
            // Asking the same thing again: its earlier ask isn't a difference.
            history: req.history.filter(
              (h) => h.question.trim().toLowerCase() !== req.transcript.trim().toLowerCase(),
            ),
            name: req.userName ?? null,
            size,
          }),
        );
        const known = answers.get(key);
        if (known) {
          c.header("x-tandrix-cache", "hit");
          return c.json(known);
        }
        const context = historyContext(req.history);
        if (req.userName) context.push(calledLine(req.userName));
        const outcome = await d.guide.ask({
          screenshot: { bytes, mimeType: req.screenshot.mimeType, ...size },
          question: req.transcript,
          context,
          ...(req.lesson ? { lesson: req.lesson } : {}),
          ...(req.explain ? { explain: req.explain } : {}),
        });
        if (outcome.status === "unavailable") return c.json(outcome satisfies ScreenAskResponse);
        const out = answered(outcome, null, size, req.transcript);
        answers.set(key, out);
        return c.json(out);
      })
      // Each part of an answer clicked, a line of NDJSON per part as soon as it's found: the Mac
      // is already speaking, and draws each part's mark as its line arrives.
      .post("/locate", screenshotLimit, async (c) => {
        if (!locateLimiter.allow(c.get("user").id)) throw tooMany();
        const parsed = ScreenLocateRequest.safeParse(await c.req.json().catch(() => undefined));
        if (!parsed.success) throw invalid(issues(parsed.error));
        const req = parsed.data;
        const size = { width: req.geometry.imageWidth, height: req.geometry.imageHeight };
        const bytes = shotBytes(req.screenshot);
        const user = c.get("user").id;
        // Parts already clicked on this screenshot come back at once; only the rest are asked.
        const keys = req.parts.map((p) => cacheKey(user, bytes, p.label.trim().toLowerCase()));
        const fresh = req.parts.flatMap((_, i) => (located.get(keys[i]!) ? [] : [i]));
        const asked = fresh.length
          ? (d.guide.locate ?? noModelScreenGuide.locate!)({
              screenshot: { bytes, mimeType: req.screenshot.mimeType, ...size },
              parts: fresh.map((i) => req.parts[i]!),
            })
          : [];
        const found = req.parts.map((_, i) => {
          const known = located.get(keys[i]!);
          if (known) return Promise.resolve(known);
          return asked[fresh.indexOf(i)]!.then((r) => {
            if (r.point) located.set(keys[i]!, r);
            return r;
          });
        });
        c.header("content-type", "application/x-ndjson");
        c.header("cache-control", "no-store");
        return stream(c, async (s) => {
          await Promise.all(
            found.map(async (f, i) => {
              const r = await f;
              const inside = (v: number, max: number) =>
                Math.max(0, Math.min(max - 1, Math.round(v)));
              const line: ScreenLocated = {
                i,
                point: r.point
                  ? { x: inside(r.point.x, size.width), y: inside(r.point.y, size.height) }
                  : null,
                box: {
                  x: inside(r.box.x, size.width),
                  y: inside(r.box.y, size.height),
                  w: Math.max(1, Math.round(r.box.w)),
                  h: Math.max(1, Math.round(r.box.h)),
                },
              };
              await s.write(`${JSON.stringify(line)}\n`);
            }),
          );
        });
      })
      .post("/background", async (c) => {
        const user = c.get("user");
        if (!backgroundLimiter.allow(user.id)) throw tooMany();
        const parsed = BackgroundRequest.safeParse(await c.req.json().catch(() => undefined));
        if (!parsed.success) throw invalid(issues(parsed.error));
        const { task, tools, steps, now } = parsed.data;
        const out = doer.background
          ? await doer.background(task, { tools, steps, ...(now ? { now } : {}) })
          : ({ status: "unavailable", message: BACKGROUND_UNAVAILABLE } as const);
        // What happened (never the task's words): enough to see where tasks stall.
        d.log?.({
          event: "background_task",
          status: out.status,
          steps: steps.length,
          ...(out.status === "call" ? { calls: out.calls.map((c) => c.name).join(",") } : {}),
        });
        return c.json(BackgroundResponse.parse(out));
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
          memory: parsed.data.memory,
          controls: parsed.data.controls,
        });
        return c.json(turnResponse(user.id, outcome, parsed.data.turn));
      })
      .post("/do/notes", screenshotLimit, async (c) => {
        const user = c.get("user");
        if (!doLimiter.allow(user.id)) throw tooMany();
        const parsed = DoNotesRequest.safeParse(await c.req.json().catch(() => undefined));
        if (!parsed.success) throw invalid(issues(parsed.error));
        const r = doer.notes
          ? await doer.notes({
              screenshot: {
                bytes: shotBytes(parsed.data.screenshot),
                mimeType: parsed.data.screenshot.mimeType,
              },
              task: parsed.data.task,
            })
          : null;
        return c.json(
          DoNotesResponse.parse(
            r
              ? { status: "done", note: r.note }
              : { status: "unavailable", message: DO_UNAVAILABLE },
          ),
        );
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
      })
  );
}
