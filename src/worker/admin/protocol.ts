// Admin protocol "giftlist-admin/1": plan → review → apply (docs/ADMIN_PROTOCOL.md, ADR-17).
//
// One function, evaluate(), checks a change set against the current database, works out what
// each operation would do, and builds the SQL to do it. Plan calls it and writes nothing.
// Apply calls it again, refuses if anything differs from what was reviewed, and runs every
// statement in one D1 batch (one transaction), guarded so a change in between rolls it all back.
import { LIMITS } from "../../shared/limits";
import { generateGroupCode } from "../lib/codes";
import { newId } from "../lib/crypto";
import { ApiError, Errors } from "../lib/errors";
import * as v from "../lib/validate";
import { revokeAllTokens } from "../auth/session";

export const PROTOCOL = "giftlist-admin/1";
export const MAX_OPS = 50;
export const MAX_NAMES_PER_ADD = 50;
export const PLAN_TTL_MS = 24 * 60 * 60_000;
export const FAIR_SHARE_MIN = 0.5;
export const FAIR_SHARE_MAX = 3;
export const ACTOR = "admin-key";

// ---------- Change set shape ----------

type Expect = { groupName: string; requester: string };
export type Op =
  | { op: "request.approve"; requestId: string; expect: Expect; ref?: string }
  | { op: "request.decline"; requestId: string; expect: Expect }
  | { op: "group.create"; name: string; currency: string; ref?: string; fairShareBuffer?: number }
  | { op: "member.add"; group: string; names: string[] }
  | { op: "member.remove"; group: string; name: string }
  | { op: "member.resetPin"; group: string; name: string }
  | { op: "group.setFairShare"; group: string; buffer: number };
export type ChangeSet = { protocol: string; changeId: string; note: string | null; ops: Op[] };

const FIELDS: Record<Op["op"], { required: string[]; optional: string[] }> = {
  "request.approve": { required: ["requestId", "expect"], optional: ["ref"] },
  "request.decline": { required: ["requestId", "expect"], optional: [] },
  "group.create": { required: ["name", "currency"], optional: ["ref", "fairShareBuffer"] },
  "member.add": { required: ["group", "names"], optional: [] },
  "member.remove": { required: ["group", "name"], optional: [] },
  "member.resetPin": { required: ["group", "name"], optional: [] },
  "group.setFairShare": { required: ["group", "buffer"], optional: [] },
};

const bad = (where: string, msg: string) => Errors.validation(`${where}: ${msg}`);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const str = (x: unknown, where: string) => {
  if (typeof x !== "string" || !x.trim()) throw bad(where, "must be a non-empty string");
  return x.trim();
};
const REF = /^[a-z0-9][a-z0-9-]{0,29}$/;

function groupNameOf(x: unknown, where: string) {
  const s = str(x, where).replace(/\s+/g, " ");
  if (s.length > LIMITS.groupNameMax) throw bad(where, `group names can be up to ${LIMITS.groupNameMax} characters`);
  if (/[\u0000-\u001f\u007f]/.test(s)) throw bad(where, "contains control characters");
  return s;
}
function bufferOf(x: unknown, where: string) {
  if (typeof x !== "number" || !Number.isFinite(x) || x < FAIR_SHARE_MIN || x > FAIR_SHARE_MAX) {
    throw bad(where, `must be a number from ${FAIR_SHARE_MIN} to ${FAIR_SHARE_MAX}`);
  }
  return Math.round(x * 100) / 100;
}
function nameOf(x: unknown, where: string) {
  try { return v.displayName(x); } catch (e) { throw bad(where, (e as Error).message); }
}

/** Checks the change set's shape. Anything unexpected (unknown op or field) is refused, so typos can't slip through. */
export function parseChangeSet(body: unknown): ChangeSet {
  if (!isObj(body)) throw Errors.validation("The change set must be a JSON object.");
  for (const k of Object.keys(body)) if (!["protocol", "changeId", "note", "ops"].includes(k)) throw bad(k, "unknown field");
  if (body.protocol !== PROTOCOL) throw bad("protocol", `must be "${PROTOCOL}"`);
  if (typeof body.changeId !== "string" || !/^[A-Za-z0-9._-]{1,64}$/.test(body.changeId)) {
    throw bad("changeId", "must be 1–64 letters, numbers, dots, dashes or underscores");
  }
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.length > 200 || /[\u0000-\u001f\u007f]/.test(body.note)) {
      throw bad("note", "must be plain text, up to 200 characters");
    }
    note = body.note.trim() || null;
  }
  if (!Array.isArray(body.ops) || body.ops.length < 1 || body.ops.length > MAX_OPS) {
    throw bad("ops", `must be a list of 1 to ${MAX_OPS} operations`);
  }
  const ops = body.ops.map((raw, i) => parseOp(raw, `ops[${i}]`));
  return { protocol: PROTOCOL, changeId: body.changeId, note, ops };
}

function parseOp(raw: unknown, w: string): Op {
  if (!isObj(raw) || typeof raw.op !== "string" || !(raw.op in FIELDS)) {
    throw bad(w, `"op" must be one of ${Object.keys(FIELDS).join(", ")}`);
  }
  const kind = raw.op as Op["op"];
  const spec = FIELDS[kind];
  for (const k of Object.keys(raw)) if (k !== "op" && !spec.required.includes(k) && !spec.optional.includes(k)) throw bad(`${w}.${k}`, "unknown field");
  for (const k of spec.required) if (raw[k] === undefined) throw bad(`${w}.${k}`, "is required");
  const ref = () => {
    if (raw.ref === undefined) return undefined;
    if (typeof raw.ref !== "string" || !REF.test(raw.ref)) throw bad(`${w}.ref`, "must be 1–30 lowercase letters, numbers or dashes");
    return raw.ref;
  };
  const expect = (): Expect => {
    const e = raw.expect;
    if (!isObj(e) || Object.keys(e).some((k) => k !== "groupName" && k !== "requester")) {
      throw bad(`${w}.expect`, 'must be { "groupName": …, "requester": … }');
    }
    return { groupName: str(e.groupName, `${w}.expect.groupName`), requester: str(e.requester, `${w}.expect.requester`) };
  };
  const group = () => {
    const g = str(raw.group, `${w}.group`);
    if (g.startsWith("@") && !REF.test(g.slice(1))) throw bad(`${w}.group`, "is not a valid @ref");
    return g;
  };
  switch (kind) {
    case "request.approve":
      return { op: kind, requestId: str(raw.requestId, `${w}.requestId`), expect: expect(), ref: ref() };
    case "request.decline":
      return { op: kind, requestId: str(raw.requestId, `${w}.requestId`), expect: expect() };
    case "group.create": {
      const cur = raw.currency;
      if (typeof cur !== "string" || !/^[A-Za-z]{3}$/.test(cur)) throw bad(`${w}.currency`, "must be a 3-letter currency code, e.g. USD");
      return {
        op: kind, name: groupNameOf(raw.name, `${w}.name`), currency: cur.toUpperCase(), ref: ref(),
        fairShareBuffer: raw.fairShareBuffer === undefined ? undefined : bufferOf(raw.fairShareBuffer, `${w}.fairShareBuffer`),
      };
    }
    case "member.add": {
      if (!Array.isArray(raw.names) || raw.names.length < 1 || raw.names.length > MAX_NAMES_PER_ADD) {
        throw bad(`${w}.names`, `must be a list of 1 to ${MAX_NAMES_PER_ADD} names`);
      }
      return { op: kind, group: group(), names: raw.names.map((n, j) => nameOf(n, `${w}.names[${j}]`)) };
    }
    case "member.remove":
    case "member.resetPin":
      return { op: kind, group: group(), name: nameOf(raw.name, `${w}.name`) };
    case "group.setFairShare":
      return { op: kind, group: group(), buffer: bufferOf(raw.buffer, `${w}.buffer`) };
  }
}

// ---------- Evaluation (shared by plan and apply) ----------

type SimMember = {
  id: string; name: string; status: "pending" | "joined";
  hasPin: boolean; lockedUntil: number | null; addedBy: string;
};
type SimGroup = {
  id: string; name: string; isNew: boolean; version: number | null; buffer: number;
  members: Map<string, SimMember>; label: string;
};
export type Step = { index: number; op: Op["op"]; summary: string };
export type Problem = { index: number; message: string };
export type Basis = { groups: Record<string, number>; requests: Record<string, "pending"> };
export type Evaluation = {
  steps: Step[]; warnings: Problem[]; errors: Problem[]; basis: Basis;
  statements: D1PreparedStatement[]; newGroups: { id: string; name: string; ref?: string; via: "admin" | "request" }[];
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

export async function evaluate(db: D1Database, ops: Op[], now: number): Promise<Evaluation> {
  const steps: Step[] = [], warnings: Problem[] = [], errors: Problem[] = [];
  const basis: Basis = { groups: {}, requests: {} };
  const statements: D1PreparedStatement[] = [];
  const newGroups: Evaluation["newGroups"] = [];
  const groups = new Map<string, SimGroup>(); // by group ID
  const refs = new Map<string, string>(); // ref → group ID
  const touched = new Set<string>(); // existing groups whose version goes up
  const requestsUsed = new Set<string>();

  async function loadMembers(groupId: string) {
    const { results } = await db.prepare(
      `SELECT id, display_name, display_name_norm, status, pin_hash IS NOT NULL AS has_pin, locked_until, added_by
       FROM members WHERE group_id = ? AND status <> 'removed'`,
    ).bind(groupId).all<{ id: string; display_name: string; display_name_norm: string; status: "pending" | "joined"; has_pin: number; locked_until: number | null; added_by: string }>();
    return new Map(results.map((m) => [m.display_name_norm, {
      id: m.id, name: m.display_name, status: m.status, hasPin: !!m.has_pin, lockedUntil: m.locked_until, addedBy: m.added_by,
    }]));
  }

  async function resolveGroup(ref: string): Promise<SimGroup> {
    if (ref.startsWith("@")) {
      const id = refs.get(ref.slice(1));
      if (!id) throw new Error(`${ref} doesn't match a group created earlier in this change set`);
      return groups.get(id)!;
    }
    const cached = groups.get(ref);
    if (cached) return cached;
    const g = await db.prepare("SELECT id, name, version, fair_share_buffer FROM groups WHERE id = ?")
      .bind(ref).first<{ id: string; name: string; version: number; fair_share_buffer: number }>();
    if (!g) throw new Error(`no group has the ID "${ref}" (use groups.list to find it)`);
    const sim: SimGroup = { id: g.id, name: g.name, isNew: false, version: g.version, buffer: g.fair_share_buffer, members: await loadMembers(g.id), label: `"${g.name}"` };
    groups.set(g.id, sim);
    basis.groups[g.id] = g.version;
    return sim;
  }

  function addRef(ref: string | undefined, groupId: string) {
    if (!ref) return;
    if (refs.has(ref)) throw new Error(`@${ref} is already used earlier in this change set`);
    refs.set(ref, groupId);
  }

  function findMember(g: SimGroup, name: string) {
    const m = g.members.get(v.normName(name));
    if (!m) throw new Error(`nobody called "${name}" is in ${g.label}`);
    return m;
  }

  function insertGroup(id: string, name: string, currency: string, via: "admin" | "request", requestId: string | null, buffer?: number) {
    statements.push(db.prepare(
      `INSERT INTO groups (id, name, group_code, currency, fair_share_buffer, created_via, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, name, generateGroupCode(), currency, buffer ?? 1.0, via, requestId, now));
  }

  async function checkRequest(o: Extract<Op, { requestId: string }>) {
    if (requestsUsed.has(o.requestId)) throw new Error("this request is already used earlier in this change set");
    const r = await db.prepare(
      "SELECT id, requested_group_name, requested_currency, requester_display_name, status FROM group_requests WHERE id = ?",
    ).bind(o.requestId).first<{ id: string; requested_group_name: string; requested_currency: string; requester_display_name: string; status: string }>();
    if (!r) throw new Error(`no request has the ID "${o.requestId}"`);
    if (r.status !== "pending") throw new Error(`this request was already ${r.status}`);
    if (r.requested_group_name !== o.expect.groupName || r.requester_display_name !== o.expect.requester) {
      throw new Error(`this request is for "${r.requested_group_name}" from ${r.requester_display_name}, not "${o.expect.groupName}" from ${o.expect.requester}`);
    }
    requestsUsed.add(r.id);
    basis.requests[r.id] = "pending";
    return r;
  }

  for (const [index, o] of ops.entries()) {
    try {
      switch (o.op) {
        case "group.create": {
          const id = newId();
          addRef(o.ref, id);
          const dup = await db.prepare("SELECT COUNT(*) AS n FROM groups WHERE lower(name) = lower(?)").bind(o.name).first<{ n: number }>();
          if (dup?.n) warnings.push({ index, message: `another group is already called "${o.name}" (allowed; codes keep them apart)` });
          insertGroup(id, o.name, o.currency, "admin", null, o.fairShareBuffer);
          groups.set(id, { id, name: o.name, isNew: true, version: null, buffer: o.fairShareBuffer ?? 1, members: new Map(), label: `new group "${o.name}"` });
          newGroups.push({ id, name: o.name, ref: o.ref, via: "admin" });
          const fs = o.fairShareBuffer !== undefined && o.fairShareBuffer !== 1 ? `, fair-share setting ${o.fairShareBuffer}` : "";
          steps.push({ index, op: o.op, summary: `+ Create group "${o.name}" (${o.currency}${fs}); its code is made when applied` });
          break;
        }
        case "request.approve": {
          const r = await checkRequest(o);
          const id = newId(), memberId = newId();
          addRef(o.ref, id);
          insertGroup(id, r.requested_group_name, r.requested_currency, "request", r.id);
          // The requester becomes the first joined member, with the PIN and hint they chose (FR-1.2).
          statements.push(db.prepare(
            `INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, pin_hash, pin_salt, pin_hint, joined_at, created_at)
             SELECT ?, ?, requester_display_name, ?, 'joined', 'request', requester_pin_hash, requester_pin_salt, requester_pin_hint, ?, ?
             FROM group_requests WHERE id = ?`,
          ).bind(memberId, id, v.normName(r.requester_display_name), now, now, r.id));
          statements.push(db.prepare("UPDATE group_requests SET status = 'approved', group_id = ?, decided_at = ? WHERE id = ? AND status = 'pending'").bind(id, now, r.id));
          const members = new Map<string, SimMember>([[v.normName(r.requester_display_name), {
            id: memberId, name: r.requester_display_name, status: "joined", hasPin: true, lockedUntil: null, addedBy: "request",
          }]]);
          groups.set(id, { id, name: r.requested_group_name, isNew: true, version: null, buffer: 1, members, label: `new group "${r.requested_group_name}"` });
          newGroups.push({ id, name: r.requested_group_name, ref: o.ref, via: "request" });
          steps.push({ index, op: o.op, summary: `✓ Approve "${r.requested_group_name}" from ${r.requester_display_name}: creates the group (${r.requested_currency}) with ${r.requester_display_name} as its first member, who is moved in automatically` });
          break;
        }
        case "request.decline": {
          const r = await checkRequest(o);
          statements.push(db.prepare("UPDATE group_requests SET status = 'declined', decided_at = ? WHERE id = ? AND status = 'pending'").bind(now, r.id));
          steps.push({ index, op: o.op, summary: `✗ Decline "${r.requested_group_name}" from ${r.requester_display_name}` });
          break;
        }
        case "member.add": {
          const g = await resolveGroup(o.group);
          const seen = new Set<string>();
          for (const name of o.names) {
            const norm = v.normName(name);
            if (seen.has(norm)) throw new Error(`"${name}" is listed twice`);
            seen.add(norm);
            const existing = g.members.get(norm);
            if (existing) throw new Error(`${g.label} already has someone called "${existing.name}"`);
          }
          for (const name of o.names) {
            const id = newId();
            statements.push(db.prepare(
              `INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, created_at)
               VALUES (?, ?, ?, ?, 'pending', 'admin', ?)`,
            ).bind(id, g.id, name, v.normName(name), now));
            g.members.set(v.normName(name), { id, name, status: "pending", hasPin: false, lockedUntil: null, addedBy: "admin" });
          }
          if (!g.isNew) touched.add(g.id);
          steps.push({ index, op: o.op, summary: `+ Add ${list(o.names)} to ${g.label} (not joined yet; each sets a PIN on their first visit)` });
          break;
        }
        case "member.remove": {
          const g = await resolveGroup(o.group);
          if (g.isNew) throw new Error("can't remove someone from a group created in this change set");
          const m = findMember(g, o.name);
          const one = <T>(sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args).first<T>();
          const items = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM items WHERE owner_member_id = ?", m.id))!.n;
          const theirClaims = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM claims WHERE claimer_member_id = ? AND status IN ('active','frozen')", m.id))!.n;
          const devices = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM member_tokens WHERE member_id = ? AND revoked_at IS NULL", m.id))!.n;
          // Other people's claims on this person's items: those claimers keep a tombstone (DATA_SCHEMA §4.5).
          const { results: claimsOnItems } = await db.prepare(
            `SELECT c.claimer_member_id, c.purchased, i.title FROM claims c JOIN items i ON i.id = c.item_id
             WHERE i.owner_member_id = ? AND c.status IN ('active','frozen') AND c.claimer_member_id <> ?`,
          ).bind(m.id, m.id).all<{ claimer_member_id: string; purchased: number; title: string }>();
          for (const c of claimsOnItems) {
            statements.push(db.prepare(
              `INSERT INTO tombstones (id, claimer_member_id, group_id, recipient_name_snapshot, item_title_snapshot, was_purchased, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
            ).bind(newId(), c.claimer_member_id, g.id, m.name, c.title, c.purchased, now));
          }
          statements.push(
            db.prepare("UPDATE claims SET status = 'released', released_at = ?, release_reason = 'claimer_removed' WHERE claimer_member_id = ? AND status IN ('active','frozen')").bind(now, m.id),
            db.prepare("DELETE FROM item_visibility WHERE member_id = ?").bind(m.id),
            db.prepare("DELETE FROM items WHERE owner_member_id = ?").bind(m.id), // links, visibility and claims go with them
            revokeAllTokens(db, m.id, now),
            db.prepare(
              `UPDATE members SET status = 'removed', removed_at = ?, pin_hash = NULL, pin_salt = NULL, pin_hint = NULL,
                 failed_pin_attempts = 0, locked_until = NULL WHERE id = ?`,
            ).bind(now, m.id),
          );
          g.members.delete(v.normName(m.name));
          touched.add(g.id);
          const effects = [
            `deletes ${plural(items, "item")}`,
            `releases ${plural(theirClaims, "claim")} ${m.name} made`,
            claimsOnItems.length ? `leaves ${plural(claimsOnItems.length, "\"no longer on the list\" note")} for people who claimed ${m.name}'s items` : null,
            m.status === "joined" ? `signs ${m.name} out on ${plural(devices, "device")}` : `${m.name} hadn't joined yet`,
          ].filter(Boolean);
          steps.push({ index, op: o.op, summary: `− Remove ${m.name} from ${g.label}: ${effects.join(", ")}. Their name can be used again.` });
          if (![...g.members.values()].some((x) => x.status === "joined")) {
            warnings.push({ index, message: `nobody who has joined will be left in ${g.label}` });
          }
          break;
        }
        case "member.resetPin": {
          const g = await resolveGroup(o.group);
          const m = findMember(g, o.name);
          if (m.status !== "joined") throw new Error(`${m.name} hasn't joined yet, so there's no PIN to reset`);
          if (g.isNew) throw new Error("can't reset a PIN in a group created in this change set");
          const devices = (await db.prepare("SELECT COUNT(*) AS n FROM member_tokens WHERE member_id = ? AND revoked_at IS NULL").bind(m.id).first<{ n: number }>())!.n;
          statements.push(
            db.prepare("UPDATE members SET pin_hash = NULL, pin_salt = NULL, pin_hint = NULL, failed_pin_attempts = 0, locked_until = NULL WHERE id = ?").bind(m.id),
            revokeAllTokens(db, m.id, now),
          );
          if (!m.hasPin) warnings.push({ index, message: `${m.name}'s PIN was already reset and is waiting for a new one` });
          const locked = m.lockedUntil && m.lockedUntil > now ? ", lifts the lock" : "";
          m.hasPin = false; m.lockedUntil = null;
          touched.add(g.id);
          steps.push({ index, op: o.op, summary: `↺ Reset ${m.name}'s PIN in ${g.label}: signs ${m.name} out on ${plural(devices, "device")}, clears the hint${locked}. The next PIN ${m.name} enters becomes the new one.` });
          break;
        }
        case "group.setFairShare": {
          const g = await resolveGroup(o.group);
          statements.push(db.prepare("UPDATE groups SET fair_share_buffer = ? WHERE id = ?").bind(o.buffer, g.id));
          const before = g.buffer;
          g.buffer = o.buffer;
          if (!g.isNew) touched.add(g.id);
          if (before === o.buffer) warnings.push({ index, message: `the setting is already ${o.buffer}` });
          steps.push({ index, op: o.op, summary: `⚖ Fair-share setting for ${g.label}: ${before} → ${o.buffer}` });
          break;
        }
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      errors.push({ index, message: (e as Error).message });
    }
  }
  for (const id of touched) statements.push(db.prepare("UPDATE groups SET version = version + 1 WHERE id = ?").bind(id));
  return { steps, warnings, errors, basis, statements, newGroups };
}

// ---------- Plan and apply ----------

export type AdminChangeRow = {
  id: string; note: string | null; ops_json: string; plan_id: string; plan_json: string; basis_json: string;
  status: "planned" | "applied"; actor: string; planned_at: number; applied_at: number | null; result_json: string | null;
};

const conflict = (code: string, message: string) => new ApiError(409, code, message);

/** Plan: checks the change set and stores it for review. Writes nothing else. */
export async function plan(db: D1Database, cs: ChangeSet, now = Date.now()) {
  const existing = await db.prepare("SELECT status FROM admin_changes WHERE id = ?").bind(cs.changeId).first<{ status: string }>();
  if (existing?.status === "applied") throw conflict("already_applied", `Change set "${cs.changeId}" was already applied. Use a new changeId.`);
  const ev = await evaluate(db, cs.ops, now);
  if (ev.errors.length) return { ok: false as const, changeId: cs.changeId, steps: ev.steps, warnings: ev.warnings, errors: ev.errors };
  const planId = newId();
  await db.prepare(
    `INSERT INTO admin_changes (id, note, ops_json, plan_id, plan_json, basis_json, status, actor, planned_at)
     VALUES (?, ?, ?, ?, ?, ?, 'planned', ?, ?)
     ON CONFLICT (id) DO UPDATE SET note = excluded.note, ops_json = excluded.ops_json, plan_id = excluded.plan_id,
       plan_json = excluded.plan_json, basis_json = excluded.basis_json, planned_at = excluded.planned_at
     WHERE admin_changes.status = 'planned'`,
  ).bind(cs.changeId, cs.note, JSON.stringify(cs.ops), planId, JSON.stringify(ev.steps.map((s) => s.summary)), JSON.stringify(ev.basis), ACTOR, now).run();
  return { ok: true as const, changeId: cs.changeId, planId, expiresAt: now + PLAN_TTL_MS, steps: ev.steps, warnings: ev.warnings };
}

export type ApplyResult = { changeId: string; appliedAt: number; steps: string[]; newGroupIds: string[] };

/** Apply: runs exactly the plan that was reviewed, all or nothing. Applying twice returns the first result. */
export async function apply(db: D1Database, changeId: string, planId: string, now = Date.now(), opts: { beforeBatch?: () => Promise<void> } = {}) {
  const row = await db.prepare("SELECT * FROM admin_changes WHERE id = ?").bind(changeId).first<AdminChangeRow>();
  if (!row) throw new ApiError(404, "no_plan", `There's no plan for change set "${changeId}". Plan it first.`);
  if (row.plan_id !== planId) {
    throw conflict(row.status === "applied" ? "already_applied" : "plan_superseded",
      row.status === "applied" ? `Change set "${changeId}" was already applied from a different plan.` : "This change set was planned again since. Review and apply the newest plan.");
  }
  if (row.status === "applied") return { replayed: true, result: JSON.parse(row.result_json!) as ApplyResult };
  if (now - row.planned_at > PLAN_TTL_MS) throw conflict("plan_expired", "This plan is more than 24 hours old. Plan it again.");

  const stale = () => conflict("plan_stale", "Something changed since this plan was made, so nothing was applied. Plan it again and review the new plan.");
  const ops = JSON.parse(row.ops_json) as Op[];
  const basis = JSON.parse(row.basis_json) as Basis;
  const ev = await evaluate(db, ops, now);
  const reviewed = JSON.parse(row.plan_json) as string[];
  const same = !ev.errors.length && JSON.stringify(ev.basis) === row.basis_json && JSON.stringify(ev.steps.map((s) => s.summary)) === JSON.stringify(reviewed);
  if (!same) throw stale();

  const result: ApplyResult = { changeId, appliedAt: now, steps: ev.steps.map((s) => s.summary), newGroupIds: ev.newGroups.map((g) => g.id) };
  // Guard: the first statement marks the change set applied only if the state still matches the plan.
  // If it doesn't, status becomes NULL, the NOT NULL constraint fails, and D1 rolls back the whole batch.
  // The status and plan checks also stop a second, simultaneous apply of the same change set.
  const conds = ["status = 'planned'", "plan_id = ?"], args: unknown[] = [planId];
  for (const [id, ver] of Object.entries(basis.groups)) { conds.push("(SELECT version FROM groups WHERE id = ?) = ?"); args.push(id, ver); }
  for (const id of Object.keys(basis.requests)) { conds.push("(SELECT status FROM group_requests WHERE id = ?) = 'pending'"); args.push(id); }
  const guard = db.prepare(
    `UPDATE admin_changes SET status = CASE WHEN ${conds.join(" AND ")} THEN 'applied' ELSE NULL END,
       applied_at = ?, result_json = ? WHERE id = ?`,
  ).bind(...args, now, JSON.stringify(result), changeId);
  await opts.beforeBatch?.(); // tests only: simulates another change landing between the checks and the batch
  try {
    await db.batch([guard, ...ev.statements]);
  } catch (e) {
    const msg = String(e);
    if (/NOT NULL|UNIQUE|constraint/i.test(msg)) throw stale();
    throw e;
  }
  return { replayed: false, result };
}
