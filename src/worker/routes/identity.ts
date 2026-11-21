import { Hono, type Context } from "hono";
import { num, type Env } from "../env";
import { normalizeGroupCode } from "../lib/codes";
import { ApiError, Errors } from "../lib/errors";
import * as v from "../lib/validate";
import { findGroupByCode, bumpGroupVersion } from "../services/groups";
import * as members from "../services/members";
import { bucketKey, hit, peek, LIMITS_RL } from "../services/rateLimit";
import { issueMemberToken, membershipsFromCookies } from "../auth/session";

export const identity = new Hono<{ Bindings: Env }>();

const clientIp = (c: Context) => c.req.header("cf-connecting-ip") ?? "unknown";

/**
 * Shared guard for anything that takes a group code: checks the IP's failure
 * budget, validates the code, counts the attempt against the code, and finds the
 * group. Unknown and malformed codes give the same error (FR-1.10).
 */
async function groupFromCode(c: Context<{ Bindings: Env }>, rawCode: unknown, now: number) {
  const { DB, PIN_PEPPER } = c.env;
  const ipBucket = await bucketKey(PIN_PEPPER, "ip", clientIp(c));
  const wait = await peek(DB, ipBucket, LIMITS_RL.ipFailures, now);
  if (wait) throw Errors.rateLimited(wait);

  const fail = async (err: ApiError) => {
    await hit(DB, ipBucket, LIMITS_RL.ipFailures, now);
    return err;
  };

  const code = normalizeGroupCode(rawCode);
  if (!code) throw await fail(Errors.invalidCode());
  const codeWait = await hit(DB, await bucketKey(PIN_PEPPER, "code", code), LIMITS_RL.codeAttempts, now);
  if (codeWait) throw Errors.rateLimited(codeWait);
  const group = await findGroupByCode(DB, code);
  if (!group) throw await fail(Errors.invalidCode());
  return { group, fail };
}

/** Group name and member names for a code, so the join and recovery screens can show them. */
identity.post("/api/groups/lookup", async (c) => {
  const body = await v.jsonBody(c.req.raw);
  const { group } = await groupFromCode(c, body.code, Date.now());
  const { results } = await c.env.DB.prepare(
    "SELECT display_name, status FROM members WHERE group_id = ? AND status IN ('pending','joined') ORDER BY display_name_norm",
  ).bind(group.id).all<{ display_name: string; status: string }>();
  return c.json({
    group: { id: group.id, name: group.name },
    members: results.map((m) => ({ displayName: m.display_name, pending: m.status === "pending" })),
  });
});

/** Join a group with its code, a display name and a new PIN (FR-1.3, FR-1.4). */
identity.post("/api/join", async (c) => {
  const now = Date.now();
  const body = await v.jsonBody(c.req.raw);
  const name = v.displayName(body.displayName);
  const pin = v.pin(body.pin);
  const hint = v.pinHint(body.pinHint, pin);
  const { group } = await groupFromCode(c, body.code, now);
  const { DB, PIN_PEPPER } = c.env;

  const existing = await members.findMemberByName(DB, group.id, name);
  let memberId: string;
  if (existing?.status === "pending") {
    // FR-2.2: the first person to open the group with a pending name sets its PIN.
    if (!(await members.activatePendingMember(DB, PIN_PEPPER, existing.id, pin, now, hint))) throw nameTaken();
    memberId = existing.id;
  } else if (existing) {
    throw nameTaken();
  } else {
    try {
      memberId = await members.insertJoinedMember(DB, PIN_PEPPER, group.id, name, pin, "self", now, hint);
    } catch (e) {
      if (String(e).includes("UNIQUE")) throw nameTaken(); // someone took the name a moment ago
      throw e;
    }
  }
  await bumpGroupVersion(DB, group.id).run();
  await issueMemberToken(c, DB, memberId, group.id, now);
  return c.json({ group: { id: group.id, name: group.name }, member: { id: memberId, displayName: name } }, 201);
});

const nameTaken = () =>
  new ApiError(409, "name_taken", "Someone in this group already uses that name. If it's you, use \"I've been here before\" to sign back in.");

/** Restore identity on a new device: code + name + PIN (FR-1.7). */
identity.post("/api/recover", async (c) => {
  const now = Date.now();
  const body = await v.jsonBody(c.req.raw);
  const name = v.displayName(body.displayName);
  const pin = v.pin(body.pin);
  const { group, fail } = await groupFromCode(c, body.code, now);
  const { DB, PIN_PEPPER } = c.env;

  const m = await members.findMemberByName(DB, group.id, name);
  if (!m || m.status !== "joined") throw await fail(Errors.invalidCredentials());
  if (m.locked_until && m.locked_until > now) throw Errors.locked(Math.ceil((m.locked_until - now) / 1000));

  let pinWasReset = false;
  if (m.pin_hash === null) {
    // The admin reset this PIN (G5): the PIN entered now becomes the new one (G25: tell the person).
    if (!(await members.setPinAfterReset(DB, PIN_PEPPER, m.id, pin))) throw Errors.invalidCredentials();
    pinWasReset = true;
  } else if (!(await members.pinMatches(PIN_PEPPER, m, pin))) {
    const lockMs = num(c.env.PIN_LOCKOUT_MINUTES, 15) * 60_000;
    const lockedUntil = await members.recordPinFailure(DB, m, num(c.env.PIN_MAX_ATTEMPTS, 5), lockMs, now);
    await fail(Errors.invalidCredentials());
    if (lockedUntil) throw Errors.locked(Math.ceil(lockMs / 1000));
    throw Errors.invalidCredentials();
  }
  await members.clearPinFailures(DB, m.id, now);
  await issueMemberToken(c, DB, m.id, group.id, now);
  return c.json({ group: { id: group.id, name: group.name }, member: { id: m.id, displayName: m.display_name }, pinWasReset });
});

/**
 * A member's PIN hint, shown on the Sign back in screen after they pick their name (G29).
 * Same code checks and rate limits as lookup. Pending or unknown names have no hint.
 */
identity.post("/api/groups/hint", async (c) => {
  const body = await v.jsonBody(c.req.raw);
  const { group } = await groupFromCode(c, body.code, Date.now());
  const name = v.displayName(body.displayName);
  const row = await c.env.DB.prepare(
    "SELECT pin_hint FROM members WHERE group_id = ? AND display_name_norm = ? AND status = 'joined'",
  ).bind(group.id, v.normName(name)).first<{ pin_hint: string | null }>();
  return c.json({ hint: row?.pin_hint ?? null });
});

/** Every group this browser belongs to, for the group switcher (FR-1.9). */
identity.get("/api/me", async (c) => {
  const list = await membershipsFromCookies(c, c.env.DB);
  return c.json({
    groups: list.map((m) => ({ id: m.groupId, name: m.groupName, member: { id: m.memberId, displayName: m.displayName } })),
  });
});
