import { hashPin, newId, safeEqual, base64url, randomBytes } from "../lib/crypto";
import { normName } from "../lib/validate";
import { revokeAllTokens } from "../auth/session";

export type MemberRow = {
  id: string;
  group_id: string;
  display_name: string;
  status: "pending" | "joined" | "removed";
  pin_hash: string | null;
  pin_salt: string | null;
  failed_pin_attempts: number;
  locked_until: number | null;
};

export const findMemberByName = (db: D1Database, groupId: string, name: string) =>
  db.prepare(
    `SELECT id, group_id, display_name, status, pin_hash, pin_salt, failed_pin_attempts, locked_until
     FROM members WHERE group_id = ? AND display_name_norm = ? AND status <> 'removed'`,
  ).bind(groupId, normName(name)).first<MemberRow>();

export async function newPinHash(pepper: string, pin: string) {
  const salt = base64url(randomBytes(16));
  return { salt, hash: await hashPin(pepper, salt, pin) };
}

export async function pinMatches(pepper: string, m: Pick<MemberRow, "pin_hash" | "pin_salt">, pin: string) {
  if (!m.pin_hash || !m.pin_salt) return false;
  return safeEqual(await hashPin(pepper, m.pin_salt, pin), m.pin_hash);
}

/** New joined member who chose their own name (FR-1.3). */
export async function insertJoinedMember(
  db: D1Database, pepper: string, groupId: string, name: string, pin: string,
  addedBy: "self" | "request" = "self", now = Date.now(), hint: string | null = null,
) {
  const { salt, hash } = await newPinHash(pepper, pin);
  const id = newId();
  await db.prepare(
    `INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, pin_hash, pin_salt, pin_hint, joined_at, last_seen_at, created_at)
     VALUES (?, ?, ?, ?, 'joined', ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, groupId, name, normName(name), addedBy, hash, salt, hint, now, now, now).run();
  return id;
}

/** A pending member (added by the admin) sets their PIN on first visit and becomes joined (FR-2.2). */
export async function activatePendingMember(db: D1Database, pepper: string, memberId: string, pin: string, now = Date.now(), hint: string | null = null) {
  const { salt, hash } = await newPinHash(pepper, pin);
  const r = await db.prepare(
    `UPDATE members SET status = 'joined', pin_hash = ?, pin_salt = ?, pin_hint = ?, joined_at = ?, last_seen_at = ?
     WHERE id = ? AND status = 'pending'`,
  ).bind(hash, salt, hint, now, now, memberId).run();
  return r.meta.changes === 1;
}

/** Admin adds a member by name; they show as pending until their first visit (FR-2.2). */
export async function addPendingMember(db: D1Database, groupId: string, name: string, now = Date.now()) {
  const id = newId();
  await db.prepare(
    `INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, created_at)
     VALUES (?, ?, ?, ?, 'pending', 'admin', ?)`,
  ).bind(id, groupId, name, normName(name), now).run();
  return id;
}

/** Admin PIN reset (FR-2.6, G5): clears the PIN and signs the member out on every device. */
export async function resetPin(db: D1Database, memberId: string, now = Date.now()) {
  await db.batch([
    db.prepare("UPDATE members SET pin_hash = NULL, pin_salt = NULL, pin_hint = NULL, failed_pin_attempts = 0, locked_until = NULL WHERE id = ?").bind(memberId),
    revokeAllTokens(db, memberId, now),
  ]);
}

/** Records a wrong PIN; locks after the max attempts (NFR-4). Returns the lock end time, if locked. */
export async function recordPinFailure(db: D1Database, m: MemberRow, maxAttempts: number, lockMs: number, now = Date.now()) {
  const attempts = m.failed_pin_attempts + 1;
  const lockedUntil = attempts >= maxAttempts ? now + lockMs : null;
  await db.prepare("UPDATE members SET failed_pin_attempts = ?, locked_until = ? WHERE id = ?")
    .bind(lockedUntil ? 0 : attempts, lockedUntil, m.id).run();
  return lockedUntil;
}

export const clearPinFailures = (db: D1Database, memberId: string, now = Date.now()) =>
  db.prepare("UPDATE members SET failed_pin_attempts = 0, locked_until = NULL, last_seen_at = ? WHERE id = ?").bind(now, memberId).run();

/** Sets a new PIN for a joined member whose PIN the admin reset. */
export async function setPinAfterReset(db: D1Database, pepper: string, memberId: string, pin: string) {
  const { salt, hash } = await newPinHash(pepper, pin);
  const r = await db.prepare("UPDATE members SET pin_hash = ?, pin_salt = ? WHERE id = ? AND status = 'joined' AND pin_hash IS NULL")
    .bind(hash, salt, memberId).run();
  return r.meta.changes === 1;
}
