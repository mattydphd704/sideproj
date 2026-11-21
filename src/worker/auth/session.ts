import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { newToken, sha256Hex } from "../lib/crypto";

// One cookie per group membership: m_<groupId> (architecture §6.1, glossary B3).
export const MEMBER_COOKIE_PREFIX = "m_";
const COOKIE_MAX_AGE = 400 * 24 * 60 * 60; // 400 days, renewed on use

export const memberCookieName = (groupId: string) => `${MEMBER_COOKIE_PREFIX}${groupId}`;

/** Creates a new token for a member, stores only its hash, and sets the cookie. */
export async function issueMemberToken(c: Context, db: D1Database, memberId: string, groupId: string, now = Date.now()) {
  const token = newToken();
  await db.prepare("INSERT INTO member_tokens (token_hash, member_id, created_at, last_used_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), memberId, now, now).run();
  setMemberCookie(c, groupId, token);
}

export function setMemberCookie(c: Context, groupId: string, token: string) {
  setCookie(c, memberCookieName(groupId), token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export type Membership = { memberId: string; displayName: string; groupId: string; groupName: string };

/** Every valid membership this browser holds, from its m_* cookies. Revoked or removed ones are ignored. */
export async function membershipsFromCookies(c: Context, db: D1Database, now = Date.now()): Promise<Membership[]> {
  const cookies = getCookie(c);
  const entries = Object.entries(cookies).filter(([k]) => k.startsWith(MEMBER_COOKIE_PREFIX)).slice(0, 50);
  const out: Membership[] = [];
  for (const [name, token] of entries) {
    const groupId = name.slice(MEMBER_COOKIE_PREFIX.length);
    const hash = await sha256Hex(token);
    const row = await db.prepare(
      `SELECT m.id AS memberId, m.display_name AS displayName, g.id AS groupId, g.name AS groupName
       FROM member_tokens t JOIN members m ON m.id = t.member_id JOIN groups g ON g.id = m.group_id
       WHERE t.token_hash = ? AND t.revoked_at IS NULL AND m.status = 'joined' AND g.id = ?`,
    ).bind(hash, groupId).first<Membership>();
    if (!row) continue;
    out.push(row);
    await db.batch([
      db.prepare("UPDATE member_tokens SET last_used_at = ? WHERE token_hash = ?").bind(now, hash),
      db.prepare("UPDATE members SET last_seen_at = ? WHERE id = ?").bind(now, row.memberId),
    ]);
    setMemberCookie(c, groupId, token); // renew expiry
  }
  return out.sort((a, b) => a.groupName.localeCompare(b.groupName));
}

/** Signs a member out everywhere (member removal, PIN reset). */
export const revokeAllTokens = (db: D1Database, memberId: string, now = Date.now()) =>
  db.prepare("UPDATE member_tokens SET revoked_at = ? WHERE member_id = ? AND revoked_at IS NULL").bind(now, memberId);
