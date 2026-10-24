import type { ContentfulStatusCode } from "hono/utils/http-status";

export type ErrorCode = "unauthorized" | "not_found" | "invalid_request" | "conflict" | "internal";

export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "unauthorized", "Sign in to continue.");
/** Used for missing and not-yours alike, so the API never reveals that someone else's job exists. */
export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found.`);
export const invalid = (details: string[]) =>
  new HttpError(400, "invalid_request", "The request isn't valid.", details);

/** Supabase returns plain objects, not Errors; Hono only routes Errors to onError. */
export class DbError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
    readonly details: string | null,
  ) {
    super(message);
    this.name = "DbError";
  }
}

/** Converts a Supabase/Postgres error into an HttpError for known cases, else a DbError. */
export function dbError(e: unknown): Error {
  if (e instanceof HttpError) return e;
  const o = (e ?? {}) as { message?: string; code?: string; details?: string };
  const message = o.message ?? String(e);
  // The signed-in user no longer exists (e.g. account deleted): their token outlives them.
  if (o.code === "23503" && /owner_id|users/.test(`${message} ${o.details ?? ""}`)) {
    return new HttpError(401, "unauthorized", "Your session has ended. Sign in again.");
  }
  if (o.code === "P0002") return new HttpError(404, "not_found", "Job not found.");
  // Raised by save_procedure when a concurrent request already gave the job its steps.
  if (o.code === "23505" && /already has a procedure/.test(message)) {
    return new HttpError(409, "conflict", "This job already has its steps.");
  }
  return e instanceof Error ? e : new DbError(message, o.code ?? null, o.details ?? null);
}
