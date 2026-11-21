import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Every API error has the same shape: { error: <code>, message: <plain English> }. */
export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
    public headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export function errorResponse(c: Context, e: ApiError) {
  for (const [k, v] of Object.entries(e.headers)) c.header(k, v);
  return c.json({ error: e.code, message: e.message }, e.status);
}

// Errors shared across routes. Wording is shown to users, so it stays friendly.
export const Errors = {
  invalidCode: () => new ApiError(400, "invalid_code", "That group code didn't work. Check it and try again."),
  invalidCredentials: () =>
    new ApiError(401, "invalid_credentials", "That name and PIN didn't match. Check them and try again."),
  rateLimited: (retryAfterSec: number) =>
    new ApiError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.", {
      "Retry-After": String(retryAfterSec),
    }),
  locked: (retryAfterSec: number) =>
    new ApiError(423, "locked", "Too many wrong PINs. This name is locked for a few minutes.", {
      "Retry-After": String(retryAfterSec),
    }),
  validation: (message: string) => new ApiError(400, "validation", message),
};
