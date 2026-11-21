import type { MiddlewareHandler } from "hono";

/** Header the web app sends on every request that changes data (architecture §6.1). */
export const CLIENT_HEADER = "x-giftlist-client";

/**
 * Blocks cross-site form posts (CSRF): requests that change data must carry the
 * app's custom header, and if the browser sends an Origin, it must be our own.
 */
export const csrf: MiddlewareHandler = async (c, next) => {
  const m = c.req.method;
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();
  const origin = c.req.header("origin");
  const ownOrigin = new URL(c.req.url).origin;
  if (c.req.header(CLIENT_HEADER) !== "1" || (origin && origin !== ownOrigin)) {
    return c.json({ error: "csrf", message: "This request was blocked for security reasons." }, 403);
  }
  return next();
};
