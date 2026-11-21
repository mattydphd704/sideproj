import { Hono } from "hono";

export type Env = {
  DB: D1Database;
  APP_ENV: string;
  SOFT_DELETE_DAYS: string;
  PIN_MAX_ATTEMPTS: string;
  PIN_LOCKOUT_MINUTES: string;
  DASHBOARD_REFRESH_SECONDS: string;
  FAIR_SHARE_BUFFER_DEFAULT: string;
};

export const app = new Hono<{ Bindings: Env }>();

// Health check: confirms the Worker is running and the database is reachable.
app.get("/api/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({ ok: row?.ok === 1, env: c.env.APP_ENV });
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch: app.fetch,
  // Nightly job (NFR-10): permanently delete items past the 90-day window.
  // Implemented in a later step; for now this is a no-op placeholder.
  async scheduled(_controller, _env, _ctx) {},
} satisfies ExportedHandler<Env>;
