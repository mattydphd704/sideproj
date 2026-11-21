// Minimal row builders for schema tests. Each returns the new row's id.
let n = 0;
const id = (p: string) => `${p}_${++n}_${Math.random().toString(36).slice(2, 8)}`;
const now = () => Date.now();

export async function group(db: D1Database, over: Record<string, unknown> = {}) {
  const row = { id: id("g"), name: "Smith Family", group_code: id("").slice(-8).toUpperCase().padEnd(8, "X").slice(0, 8),
    currency: "USD", created_via: "admin", created_at: now(), ...over };
  await insert(db, "groups", row);
  return row.id as string;
}

export async function member(db: D1Database, groupId: string, name: string, over: Record<string, unknown> = {}) {
  const row = { id: id("m"), group_id: groupId, display_name: name, display_name_norm: name.trim().toLowerCase(),
    status: "joined", added_by: "self", pin_hash: "h", pin_salt: "s", joined_at: now(), created_at: now(), ...over };
  await insert(db, "members", row);
  return row.id as string;
}

export async function item(db: D1Database, groupId: string, ownerId: string, over: Record<string, unknown> = {}) {
  const t = now();
  const row = { id: id("i"), group_id: groupId, owner_member_id: ownerId, title: "Camera", mode: "exact_product",
    created_at: t, content_updated_at: t, ...over };
  await insert(db, "items", row);
  return row.id as string;
}

export async function link(db: D1Database, itemId: string, over: Record<string, unknown> = {}) {
  const row = { id: id("l"), item_id: itemId, position: 1, url: "https://example.com/p", created_at: now(), ...over };
  await insert(db, "product_links", row);
  return row.id as string;
}

export async function claim(db: D1Database, itemId: string, claimerId: string, over: Record<string, unknown> = {}) {
  const t = now();
  const row = { id: id("c"), item_id: itemId, claimer_member_id: claimerId, claimed_at: t, last_seen_item_version_at: t, ...over };
  await insert(db, "claims", row);
  return row.id as string;
}

export async function insert(db: D1Database, table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  await db.prepare(`INSERT INTO ${table} (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`)
    .bind(...cols.map((c) => row[c] as string | number | null)).run();
}
