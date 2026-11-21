import { afterAll, beforeAll, expect, test } from "vitest";
import { freshDb } from "../helpers/db";

let ctx: Awaited<ReturnType<typeof freshDb>>;
beforeAll(async () => { ctx = await freshDb(); });
afterAll(async () => { await ctx.dispose(); });

test("[SMK-01] all 13 tables exist", async () => {
  const { results } = await ctx.db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations' ORDER BY name")
    .all<{ name: string }>();
  expect(results.map((r) => r.name)).toEqual([
    "admin_changes", "archive_batch_items", "archive_batches", "claims", "group_requests", "groups",
    "item_visibility", "items", "member_tokens", "members", "product_links",
    "rate_limits", "tombstones",
  ]);
});
