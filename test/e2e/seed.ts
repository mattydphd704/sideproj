// Direct database access for E2E setup steps that have no screen yet (admin actions).
import { getPlatformProxy } from "wrangler";
import { createGroup } from "../../src/worker/services/groups";
import { addPendingMember } from "../../src/worker/services/members";
import { approveRequest, declineRequest } from "../../src/worker/services/groupRequests";

async function withDb<T>(fn: (db: D1Database) => Promise<T>): Promise<T> {
  const p = await getPlatformProxy<{ DB: D1Database }>({ configPath: "wrangler.jsonc", persist: { path: ".e2e-state/v3" } });
  try { return await fn(p.env.DB); } finally { await p.dispose(); }
}

export const seed = {
  group: (name: string, pending: string[] = []) => withDb(async (db) => {
    const g = await createGroup(db, { name, currency: "USD", createdVia: "admin" });
    for (const n of pending) await addPendingMember(db, g.id, n);
    return { ...g, display: `${g.group_code.slice(0, 4)}-${g.group_code.slice(4)}` };
  }),
  /** All E2E traffic comes from one address, so rate-limit counters are cleared between tests. */
  clearRateLimits: () => withDb((db) => db.prepare("DELETE FROM rate_limits").run().then(() => undefined)),
  latestRequestId: (groupName: string) => withDb((db) =>
    db.prepare("SELECT id FROM group_requests WHERE requested_group_name = ? ORDER BY created_at DESC LIMIT 1").bind(groupName).first<{ id: string }>().then((r) => r!.id)),
  approve: (id: string) => withDb((db) => approveRequest(db, id)),
  decline: (id: string) => withDb((db) => declineRequest(db, id)),
};
