import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { requireUser, type AuthEnv, type VerifyToken } from "./auth";
import { HttpError } from "./errors";
import type { JobsRepo } from "./repos/jobs";
import { jobsRoutes } from "./routes/jobs";

export interface AppDeps {
  verifyToken: VerifyToken;
  jobs: JobsRepo;
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
  app.use("/jobs", requireUser(deps.verifyToken));
  app.route("/jobs", jobsRoutes(deps.jobs));

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
    log({ id: c.get("requestId"), level: "error", error: err.message });
    return c.json(
      { error: { code: "internal", message: "Something went wrong. Try again." } },
      500,
    );
  });

  return app;
}
