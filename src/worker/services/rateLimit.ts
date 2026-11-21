import { hmacHex } from "../lib/crypto";

export type Limit = { max: number; windowMs: number };

// G15. "ip" counts failed attempts from one network address. "code" counts every
// join or recovery attempt against one group code.
export const LIMITS_RL = {
  ipFailures: { max: 10, windowMs: 15 * 60_000 },
  codeAttempts: { max: 30, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/** Bucket keys are hashed with the pepper, so IP addresses and codes aren't stored (DATA_SCHEMA §3.11). */
export const bucketKey = (pepper: string, kind: string, value: string) =>
  hmacHex(pepper, `rl:${kind}:${value}`).then((h) => `${kind}:${h}`);

/** Seconds until the bucket allows another attempt, or 0 if it's under the limit. Doesn't count. */
export async function peek(db: D1Database, bucket: string, limit: Limit, now: number): Promise<number> {
  const row = await db.prepare("SELECT window_start, count FROM rate_limits WHERE bucket = ?")
    .bind(bucket).first<{ window_start: number; count: number }>();
  if (!row || row.window_start <= now - limit.windowMs || row.count < limit.max) return 0;
  return Math.ceil((row.window_start + limit.windowMs - now) / 1000);
}

/** Counts one attempt. Returns seconds to wait if this attempt went over the limit, else 0. */
export async function hit(db: D1Database, bucket: string, limit: Limit, now: number): Promise<number> {
  const row = await db.prepare(
    `INSERT INTO rate_limits (bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(bucket) DO UPDATE SET
       count        = CASE WHEN window_start <= ?2 - ?3 THEN 1  ELSE count + 1   END,
       window_start = CASE WHEN window_start <= ?2 - ?3 THEN ?2 ELSE window_start END
     RETURNING window_start, count`,
  ).bind(bucket, now, limit.windowMs).first<{ window_start: number; count: number }>();
  if (!row || row.count <= limit.max) return 0;
  return Math.ceil((row.window_start + limit.windowMs - now) / 1000);
}
