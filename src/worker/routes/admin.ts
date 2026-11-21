// Admin protocol endpoints (docs/ADMIN_PROTOCOL.md, ADR-17). No screens: the TPM works
// through these from a Claude session or the scripts/admin.mjs command line.
import { Hono, type MiddlewareHandler } from "hono";
import type { Env } from "../env";
import { formatGroupCode } from "../lib/codes";
import { safeEqual, sha256Hex } from "../lib/crypto";
import { ApiError, Errors } from "../lib/errors";
import * as v from "../lib/validate";
import { bucketKey, hit, peek } from "../services/rateLimit";
import * as protocol from "../admin/protocol";

export const ADMIN_KEY_HEADER = "x-admin-key";
export const ADMIN_KEY_MIN_LENGTH = 32;
const KEY_FAILURES = { max: 10, windowMs: 15 * 60_000 }; // wrong keys per network

/**
 * Every /api/admin/* request needs the admin key (NFR-7). Fail closed: without a configured
 * key of at least 32 characters, the admin endpoints are switched off entirely.
 */
export const requireAdminKey: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const key = c.env.ADMIN_KEY;
  if (!key || key.length < ADMIN_KEY_MIN_LENGTH) {
    console.error(JSON.stringify({ level: "error", msg: "ADMIN_KEY missing or too short; admin endpoints disabled" }));
    throw new ApiError(503, "admin_disabled", "The admin protocol isn't set up on this server.");
  }
  const now = Date.now();
  const bucket = await bucketKey(c.env.PIN_PEPPER, "admin", c.req.header("cf-connecting-ip") ?? "unknown");
  const wait = await peek(c.env.DB, bucket, KEY_FAILURES, now);
  if (wait) throw Errors.rateLimited(wait);
  const given = c.req.header(ADMIN_KEY_HEADER) ?? "";
  // Hash both sides so the comparison takes the same time whatever the input's length.
  if (!safeEqual(await sha256Hex(given), await sha256Hex(key))) {
    await hit(c.env.DB, bucket, KEY_FAILURES, now);
    throw new ApiError(401, "admin_unauthorized", "A valid admin key is required.");
  }
  await next();
};

export const admin = new Hono<{ Bindings: Env }>();
admin.use("/api/admin/*", requireAdminKey);

const inviteUrl = (requestUrl: string, code: string) => `${new URL(requestUrl).origin}/j/${formatGroupCode(code)}`;
const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

/** requests.list: the queue of group requests (default: pending). */
admin.get("/api/admin/requests", async (c) => {
  const status = c.req.query("status") ?? "pending";
  if (!["pending", "approved", "declined", "all"].includes(status)) throw Errors.validation("status must be pending, approved, declined or all.");
  const { results } = await c.env.DB.prepare(
    `SELECT id, requested_group_name, requester_display_name, requested_currency, status, group_id, created_at, decided_at
     FROM group_requests ${status === "all" ? "" : "WHERE status = ?"} ORDER BY created_at DESC LIMIT 100`,
  ).bind(...(status === "all" ? [] : [status])).all<any>();
  return c.json({
    requests: results.map((r) => ({
      id: r.id, groupName: r.requested_group_name, requester: r.requester_display_name, currency: r.requested_currency,
      status: r.status, groupId: r.group_id, createdAt: iso(r.created_at), decidedAt: iso(r.decided_at),
    })),
  });
});

/** groups.list: every group with its code, invite link and member counts. */
admin.get("/api/admin/groups", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT g.id, g.name, g.group_code, g.currency, g.created_via, g.created_at,
       (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id AND m.status = 'joined') AS joined,
       (SELECT COUNT(*) FROM members m WHERE m.group_id = g.id AND m.status = 'pending') AS pending
     FROM groups g ORDER BY g.created_at DESC LIMIT 500`,
  ).all<any>();
  return c.json({
    groups: results.map((g) => ({
      id: g.id, name: g.name, code: formatGroupCode(g.group_code), inviteUrl: inviteUrl(c.req.url, g.group_code),
      currency: g.currency, createdVia: g.created_via, createdAt: iso(g.created_at), joined: g.joined, notJoinedYet: g.pending,
    })),
  });
});

/** groups.show: one group and everyone in it, with each person's state. */
admin.get("/api/admin/groups/:id", async (c) => {
  const db = c.env.DB;
  const g = await db.prepare("SELECT * FROM groups WHERE id = ?").bind(c.req.param("id")).first<any>();
  if (!g) throw new ApiError(404, "not_found", "No group has that ID.");
  const now = Date.now();
  const { results } = await db.prepare(
    `SELECT m.id, m.display_name, m.status, m.added_by, m.pin_hash IS NOT NULL AS has_pin, m.pin_hint IS NOT NULL AS has_hint,
       m.locked_until, m.joined_at, m.last_seen_at,
       (SELECT COUNT(*) FROM member_tokens t WHERE t.member_id = m.id AND t.revoked_at IS NULL) AS devices
     FROM members m WHERE m.group_id = ? AND m.status <> 'removed' ORDER BY m.display_name_norm`,
  ).bind(g.id).all<any>();
  return c.json({
    group: {
      id: g.id, name: g.name, code: formatGroupCode(g.group_code), inviteUrl: inviteUrl(c.req.url, g.group_code),
      currency: g.currency, fairShareBuffer: g.fair_share_buffer, version: g.version, createdVia: g.created_via,
      createdAt: iso(g.created_at), lastArchivedAt: iso(g.last_archived_at),
    },
    members: results.map((m) => ({
      id: m.id, name: m.display_name, addedBy: m.added_by,
      state: m.status === "pending" ? "not_joined_yet"
        : m.locked_until && m.locked_until > now ? "locked"
        : m.has_pin ? "joined" : "pin_reset_waiting",
      lockedUntil: m.locked_until && m.locked_until > now ? iso(m.locked_until) : null,
      hasHint: !!m.has_hint, devices: m.devices, joinedAt: iso(m.joined_at), lastSeenAt: iso(m.last_seen_at),
    })),
  });
});

/** The audit log: recent change sets, planned and applied. */
admin.get("/api/admin/changes", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id, note, status, plan_json, actor, planned_at, applied_at FROM admin_changes ORDER BY planned_at DESC LIMIT 50",
  ).all<any>();
  return c.json({
    changes: results.map((r) => ({
      changeId: r.id, note: r.note, status: r.status, steps: JSON.parse(r.plan_json), actor: r.actor,
      plannedAt: iso(r.planned_at), appliedAt: iso(r.applied_at),
    })),
  });
});

/** Plan: check a change set and store it for review. Writes nothing else. */
admin.post("/api/admin/plan", async (c) => {
  const cs = protocol.parseChangeSet(await v.jsonBody(c.req.raw));
  const p = await protocol.plan(c.env.DB, cs);
  if (!p.ok) return c.json({ error: "plan_invalid", message: "Nothing was planned. Fix the problems listed and plan again.", ...p }, 422);
  return c.json({ ...p, expiresAt: iso(p.expiresAt) });
});

/** Apply: run a reviewed plan, all or nothing. New groups' codes and invite links come back here. */
admin.post("/api/admin/apply", async (c) => {
  const body = await v.jsonBody(c.req.raw);
  if (typeof body.changeId !== "string" || typeof body.planId !== "string") throw Errors.validation("changeId and planId are required.");
  const { replayed, result } = await protocol.apply(c.env.DB, body.changeId, body.planId);
  const newGroups = [];
  for (const id of result.newGroupIds) {
    const g = await c.env.DB.prepare("SELECT id, name, group_code FROM groups WHERE id = ?").bind(id).first<any>();
    if (g) newGroups.push({ id: g.id, name: g.name, code: formatGroupCode(g.group_code), inviteUrl: inviteUrl(c.req.url, g.group_code) });
  }
  return c.json({ applied: true, replayed, changeId: result.changeId, appliedAt: iso(result.appliedAt), steps: result.steps, newGroups });
});
