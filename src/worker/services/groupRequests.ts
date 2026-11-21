import { newId, newToken, sha256Hex } from "../lib/crypto";
import { createGroup } from "./groups";
import { newPinHash } from "./members";
import { normName } from "../lib/validate";

export type RequestRow = {
  id: string;
  requested_group_name: string;
  requested_currency: string;
  requester_display_name: string;
  requester_pin_hash: string;
  requester_pin_salt: string;
  status: "pending" | "approved" | "declined";
  group_id: string | null;
};

/** A visitor's request for a new group (FR-1.2). Returns the raw request token for the cookie. */
export async function createRequest(
  db: D1Database, pepper: string,
  input: { groupName: string; currency: string; displayName: string; pin: string }, now = Date.now(),
) {
  const id = newId();
  const token = newToken();
  const { salt, hash } = await newPinHash(pepper, input.pin);
  await db.prepare(
    `INSERT INTO group_requests (id, requested_group_name, requested_currency, requester_display_name,
       requester_pin_hash, requester_pin_salt, request_token_hash, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
  ).bind(id, input.groupName, input.currency, input.displayName, hash, salt, await sha256Hex(token), now).run();
  return { id, token };
}

export const findRequestByToken = async (db: D1Database, token: string) =>
  db.prepare("SELECT * FROM group_requests WHERE request_token_hash = ?").bind(await sha256Hex(token)).first<RequestRow>();

/**
 * Admin approves a request: creates the group and makes the requester its first
 * joined member, using the PIN they chose when asking (FR-1.2).
 */
export async function approveRequest(db: D1Database, requestId: string, now = Date.now()) {
  const r = await db.prepare("SELECT * FROM group_requests WHERE id = ? AND status = 'pending'").bind(requestId).first<RequestRow>();
  if (!r) return null;
  const group = await createGroup(db, { name: r.requested_group_name, currency: r.requested_currency, createdVia: "request", requestId: r.id }, now);
  const memberId = newId();
  await db.batch([
    db.prepare(
      `INSERT INTO members (id, group_id, display_name, display_name_norm, status, added_by, pin_hash, pin_salt, joined_at, created_at)
       VALUES (?, ?, ?, ?, 'joined', 'request', ?, ?, ?, ?)`,
    ).bind(memberId, group.id, r.requester_display_name, normName(r.requester_display_name), r.requester_pin_hash, r.requester_pin_salt, now, now),
    db.prepare("UPDATE group_requests SET status = 'approved', group_id = ?, decided_at = ? WHERE id = ?").bind(group.id, now, r.id),
  ]);
  return { group, memberId };
}

export async function declineRequest(db: D1Database, requestId: string, now = Date.now()) {
  const r = await db.prepare("UPDATE group_requests SET status = 'declined', decided_at = ? WHERE id = ? AND status = 'pending'")
    .bind(now, requestId).run();
  return r.meta.changes === 1;
}

/** The requester's member record in an approved group. */
export const requesterMember = (db: D1Database, groupId: string) =>
  db.prepare("SELECT id FROM members WHERE group_id = ? AND added_by = 'request' AND status = 'joined' ORDER BY created_at LIMIT 1")
    .bind(groupId).first<{ id: string }>();

export const newRequestId = newId;
