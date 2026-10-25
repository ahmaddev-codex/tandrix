import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { requireUser, type AuthEnv, type VerifyToken } from "./auth";
import { DbError, HttpError } from "./errors";
import type { NameplateReader } from "./nameplate";
import type { AssetsRepo } from "./repos/assets";
import type { EvidenceRepo, EvidenceStorage } from "./repos/evidence";
import type { JobsRepo } from "./repos/jobs";
import type { ManualFinder } from "./manual-finder";
import type { ManualsRepo } from "./repos/manuals";
import type { ProcedureGenerator } from "./procedure-generator";
import type { ProceduresRepo } from "./repos/procedures";
import type { Highlighter } from "./highlighter";
import type { DetectionsRepo } from "./repos/detections";
import type { StepStateRepo } from "./repos/step-state";
import { voiceRoutes, type StepAnswerer, type Transcriber } from "./voice";
import type { StepChecker } from "./step-checker";
import type { PartsChecker } from "./parts-checker";
import type { PartsChecksRepo } from "./repos/parts-checks";
import { partsRoutes } from "./routes/parts";
import type { SafeFetchOptions } from "./safe-fetch";
import { assetRoutes } from "./routes/asset";
import { evidenceRoutes } from "./routes/evidence";
import { jobsRoutes } from "./routes/jobs";
import { manualRoutes } from "./routes/manual";
import { procedureRoutes } from "./routes/procedure";
import { screenRoutes } from "./routes/screen";
import { detectionRoutes, stepRoutes } from "./routes/steps";
import type { ScreenGuide } from "./screen-guide";

export interface AppDeps {
  verifyToken: VerifyToken;
  jobs: JobsRepo;
  evidence: EvidenceRepo;
  storage: EvidenceStorage;
  assets: AssetsRepo;
  nameplateReader: NameplateReader;
  manuals: ManualsRepo;
  manualStorage: EvidenceStorage;
  manualFinder: ManualFinder;
  procedures: ProceduresRepo;
  procedureGenerator: ProcedureGenerator;
  detections: DetectionsRepo;
  highlighter: Highlighter;
  stepState: StepStateRepo;
  transcriber: Transcriber;
  answerer: StepAnswerer;
  checker: StepChecker;
  partsChecks: PartsChecksRepo;
  partsChecker: PartsChecker;
  screenGuide: ScreenGuide;
  /** Signs manual search candidates (TOKEN_SIGNING_SECRET). */
  tokenSecret: string;
  /** Tests only: swap DNS and transport for the manual download. */
  manualFetch?: Partial<SafeFetchOptions>;
  /** Tests only: a controllable clock for token expiry. */
  now?: () => number;
  corsOrigins: string[];
  /** Logs one line per request. Never request bodies, tokens or media. */
  log?: (line: Record<string, unknown>) => void;
}

export function createApp(deps: AppDeps) {
  const log = deps.log ?? ((l) => console.log(JSON.stringify(l)));
  const app = new Hono<AuthEnv>();

  app.use(requestId());
  app.use(async (c, next) => {
    const start = performance.now();
    await next();
    log({
      id: c.get("requestId"),
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - start),
    });
  });
  // Safety net (inside the request log, so the resulting 500 is logged): Hono only routes Error instances to onError. Anything else thrown (e.g. a plain
  // object from a library) would become an empty 500 with no log, so turn it into an Error.
  app.use(async (_c, next) => {
    try {
      await next();
    } catch (e) {
      throw e instanceof Error
        ? e
        : new Error(typeof e === "object" ? JSON.stringify(e) : String(e));
    }
  });
  app.use(
    cors({
      origin: (origin) => (deps.corsOrigins.includes(origin) ? origin : null),
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE"],
      maxAge: 600,
    }),
  );

  app.get("/health", (c) => c.json({ ok: true }));

  app.use("/jobs/*", requireUser(deps.verifyToken));
  app.use("/voice/*", requireUser(deps.verifyToken));
  app.route("/voice", voiceRoutes(deps.transcriber));
  app.use("/jobs", requireUser(deps.verifyToken));
  // Evidence first: the more specific path must win over /jobs/:id.
  app.route("/jobs/:id/evidence", evidenceRoutes(deps.evidence, deps.storage));
  app.route(
    "/jobs/:id/asset",
    assetRoutes({
      evidence: deps.evidence,
      storage: deps.storage,
      assets: deps.assets,
      reader: deps.nameplateReader,
    }),
  );
  app.route(
    "/jobs/:id/manual",
    manualRoutes({
      jobs: deps.jobs,
      assets: deps.assets,
      evidence: deps.evidence,
      evidenceStorage: deps.storage,
      manuals: deps.manuals,
      manualStorage: deps.manualStorage,
      finder: deps.manualFinder,
      tokenSecret: deps.tokenSecret,
      ...(deps.manualFetch ? { fetchOptions: deps.manualFetch } : {}),
      ...(deps.now ? { now: deps.now } : {}),
    }),
  );
  app.route(
    "/jobs/:id/procedure",
    procedureRoutes({
      jobs: deps.jobs,
      assets: deps.assets,
      manuals: deps.manuals,
      manualStorage: deps.manualStorage,
      procedures: deps.procedures,
      generator: deps.procedureGenerator,
      log,
    }),
  );
  const stepDeps = {
    jobs: deps.jobs,
    procedures: deps.procedures,
    evidence: deps.evidence,
    storage: deps.storage,
    detections: deps.detections,
    highlighter: deps.highlighter,
    stepState: deps.stepState,
    answerer: deps.answerer,
    checker: deps.checker,
    assets: deps.assets,
    ...(deps.now ? { now: deps.now } : {}),
  };
  app.route("/jobs/:id/steps", stepRoutes(stepDeps));
  app.route(
    "/jobs/:id/parts-check",
    partsRoutes({
      jobs: deps.jobs,
      procedures: deps.procedures,
      evidence: deps.evidence,
      storage: deps.storage,
      partsChecks: deps.partsChecks,
      checker: deps.partsChecker,
    }),
  );
  app.route("/jobs/:id/detections", detectionRoutes(stepDeps));
  app.route(
    "/jobs/:id/screen",
    screenRoutes({
      jobs: deps.jobs,
      assets: deps.assets,
      procedures: deps.procedures,
      evidence: deps.evidence,
      storage: deps.storage,
      guide: deps.screenGuide,
    }),
  );
  app.route(
    "/jobs",
    jobsRoutes(
      deps.jobs,
      deps.assets,
      deps.manuals,
      deps.procedures,
      deps.stepState,
      deps.partsChecks,
    ),
  );

  app.notFound((c) => c.json({ error: { code: "not_found", message: "No such route." } }, 404));
  app.onError((err, c) => {
    if (err instanceof HttpError) {
      return c.json(
        {
          error: {
            code: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
          },
        },
        err.status,
      );
    }
    log({
      id: c.get("requestId"),
      level: "error",
      error: err.message,
      ...(err instanceof DbError ? { dbCode: err.code } : {}),
    });
    return c.json(
      { error: { code: "internal", message: "Something went wrong. Try again." } },
      500,
    );
  });

  return app;
}
