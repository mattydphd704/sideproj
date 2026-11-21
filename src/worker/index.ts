import { Hono } from "hono";
import type { Env } from "./env";
import { ApiError, errorResponse } from "./lib/errors";
import { csrf } from "./middleware/csrf";
import { identity } from "./routes/identity";
import { groupRequests } from "./routes/groupRequests";

export type { Env };

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/api/*", csrf);

  // Fail closed: without the PIN pepper, PINs and rate-limit keys can't be protected (ADR-05).
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/health") return next();
    if (!c.env.PIN_PEPPER || c.env.PIN_PEPPER.length < 16) {
      console.error(JSON.stringify({ level: "error", msg: "PIN_PEPPER missing or too short" }));
      return c.json({ error: "server_misconfigured", message: "Something went wrong. Please try again." }, 500);
    }
    return next();
  });

  // Health check: confirms the Worker is running and the database is reachable.
  app.get("/api/health", async (c) => {
    const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return c.json({ ok: row?.ok === 1, env: c.env.APP_ENV });
  });

  app.route("/", identity);
  app.route("/", groupRequests);

  app.notFound((c) => c.json({ error: "not_found", message: "Not found." }, 404));

  // Known errors become friendly JSON. Anything else is logged without request
  // details (no codes, PINs or tokens in logs) and returns a generic message.
  app.onError((err, c) => {
    if (err instanceof ApiError) return errorResponse(c, err);
    console.error(JSON.stringify({ level: "error", msg: "unhandled", name: err.name, path: redactPath(c.req.path) }));
    return c.json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
  });

  return app;
}

/** Invite paths contain group codes, so they're never logged as-is (architecture §6.10). */
export const redactPath = (p: string) => (p.startsWith("/j/") ? "/j/<redacted>" : p);

export const app = createApp();

export default {
  fetch: app.fetch,
  // Nightly job (NFR-10): permanently delete items past the 90-day window. Built in a later step.
  async scheduled(_controller, _env, _ctx) {},
} satisfies ExportedHandler<Env>;
