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
