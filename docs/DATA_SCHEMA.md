# Data Schema: Gift List Tracker v1

| | |
|---|---|
| **Status** | v1.0, approved by TPM |
| **Last updated** | 2026-11-21 |
| **Database** | Cloudflare D1 (SQLite), one database per environment |
| **Based on** | `GLOSSARY.md` rev 3 (Part B field catalogue, Part C lifecycles, Part D visibility), `ARCHITECTURE.md` v1.0 |

This document is the design. The SQL below becomes the first migration file (`apps/api/migrations/0001_init.sql`) when coding starts. Until the TPM approves it, it's for review only.

---

## 1. Conventions

| Topic | Rule |
|---|---|
| **IDs** | `TEXT`, random and URL-safe: 16 bytes, base64url, 22 characters. They aren't sequential, so IDs reveal nothing about how many groups or items exist. |
| **Timestamps** | `INTEGER`, Unix epoch **milliseconds**, UTC. Column names end in `_at`. |
| **Booleans** | `INTEGER` 0/1 with `CHECK (x IN (0,1))`. |
| **Enums** | `TEXT` with a `CHECK (x IN (...))` constraint. Values match the glossary exactly. |
| **Money** | `price_minor INTEGER` (cents) plus `currency TEXT` (ISO 4217). No floating point. |
| **Text limits** | Enforced in **both** the API validation (shared package) and `CHECK (length(x) <= n)`. The limits are G1–G11. |
| **Secrets** | Only hashes are stored: `pin_hash`, `token_hash`. Raw PINs and tokens never touch the database or logs. |
| **Foreign keys** | Declared on every reference. **Verified 2026-11-21:** local D1 enforces them (`test/schema/constraints.test.ts`). Recheck on the first dev deploy. |
| **Naming** | `snake_case`, plural table names. |

---

## 2. Entity overview

```
 groups ─────────┬──< members ──┬──< member_tokens
   │             │              ├──< items (as owner) ──┬──< product_links
   │             │              │                       ├──< item_visibility >── members (visible_to)
   │             │              │                       └──< claims >── members (claimer)
   │             │              └──< tombstones (as claimer)
   │             └──< archive_batches ──< archive_batch_items >── items
   └── (created from) group_requests

 rate_limits   (standalone: join, recovery and request throttling)
```

`──<` means "one to many".

| Table | Glossary | Purpose |
|---|---|---|
| `groups` | B1 | A group, its code, currency, fair-share buffer and change counter |
| `group_requests` | B4 | A visitor's request for a new group |
| `members` | B2 | People in a group. Status is pending, joined or removed. |
| `member_tokens` | B3 | One per browser or device per membership |
| `items` | B5 | Things on a member's list |
| `item_visibility` | B5 `visible_to` | Which members can see an item limited to specific members |
| `product_links` | B6 | Links or descriptions attached to an item, with auto-filled details |
| `claims` | B7 | Reservations, including the purchased flag and history |
| `tombstones` | B8 | What a claimer keeps after a claimed item is permanently deleted |
| `archive_batches` | B9 | One record per archive action |
| `archive_batch_items` | B9 | Each item's state before archiving, used by Restore archive |
| `rate_limits` | NFR-3, NFR-4 | Attempt counters by IP address and by group code |

---

## 3. Tables (draft SQL)

### 3.1 `groups`
```sql
CREATE TABLE groups (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),      -- G1
  group_code         TEXT NOT NULL UNIQUE                                             -- G2: stored normalised,
                       CHECK (length(group_code) = 8),                                --   8 chars, uppercase, no dash
  currency           TEXT NOT NULL CHECK (length(currency) = 3),                      -- G9
  fair_share_buffer  REAL NOT NULL DEFAULT 1.0 CHECK (fair_share_buffer > 0),         -- G3
  version            INTEGER NOT NULL DEFAULT 0,          -- incremented on every change in the group (dashboard refresh)
  created_via        TEXT NOT NULL CHECK (created_via IN ('admin','request')),
  request_id         TEXT REFERENCES group_requests(id),  -- set when created_via = 'request'
  last_archived_at   INTEGER,                             -- kept for retroactive auto-archive (B-011)
  created_at         INTEGER NOT NULL
);
```

### 3.2 `group_requests`
```sql
CREATE TABLE group_requests (
  id                      TEXT PRIMARY KEY,
  requested_group_name    TEXT NOT NULL CHECK (length(trim(requested_group_name)) BETWEEN 1 AND 60),
  requested_currency      TEXT NOT NULL CHECK (length(requested_currency) = 3),
  requester_display_name  TEXT NOT NULL CHECK (length(trim(requester_display_name)) BETWEEN 1 AND 30),
  requester_pin_hash      TEXT NOT NULL,
  requester_pin_salt      TEXT NOT NULL,
  request_token_hash      TEXT NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','declined')),
  group_id                TEXT REFERENCES groups(id),     -- set on approval
  created_at              INTEGER NOT NULL,
  decided_at              INTEGER
);
CREATE INDEX idx_group_requests_status ON group_requests(status, created_at);
```

### 3.3 `members`
```sql
CREATE TABLE members (
  id                   TEXT PRIMARY KEY,
  group_id             TEXT NOT NULL REFERENCES groups(id),
  display_name         TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 30),  -- G4
  display_name_norm    TEXT NOT NULL,                    -- lower(trim(display_name)), for uniqueness
  status               TEXT NOT NULL CHECK (status IN ('pending','joined','removed')),
  added_by             TEXT NOT NULL CHECK (added_by IN ('self','admin','request')),
  is_admin             INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0,1)),
  pin_hash             TEXT,                             -- NULL while pending or after a PIN reset
  pin_salt             TEXT,
  failed_pin_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until         INTEGER,
  joined_at            INTEGER,
  last_seen_at         INTEGER,
  removed_at           INTEGER,
  created_at           INTEGER NOT NULL,
  CHECK (status <> 'joined' OR pin_hash IS NOT NULL OR joined_at IS NOT NULL)
);
-- Display names must be unique among current members. A removed member's name can be reused (see G12).
CREATE UNIQUE INDEX uq_members_name ON members(group_id, display_name_norm) WHERE status <> 'removed';
CREATE INDEX idx_members_group ON members(group_id, status);
```
*A joined member whose PIN the admin reset has `pin_hash` set to NULL until they recover, which is why the check also accepts `joined_at`.*

### 3.4 `member_tokens`
```sql
CREATE TABLE member_tokens (
  token_hash    TEXT PRIMARY KEY,                        -- SHA-256 of the raw cookie value
  member_id     TEXT NOT NULL REFERENCES members(id),
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER NOT NULL,
  revoked_at    INTEGER                                  -- set on PIN reset (G5) or member removal
);
CREATE INDEX idx_tokens_member ON member_tokens(member_id);
```

### 3.5 `items`
```sql
CREATE TABLE items (
  id                     TEXT PRIMARY KEY,
  group_id               TEXT NOT NULL REFERENCES groups(id),   -- copied from the owner, for fast dashboard queries
  owner_member_id        TEXT NOT NULL REFERENCES members(id),
  title                  TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),     -- G6
  mode                   TEXT NOT NULL CHECK (mode IN ('exact_product','givers_choice')),
  notes                  TEXT CHECK (notes IS NULL OR length(notes) <= 500),              -- G7
  visibility             TEXT NOT NULL DEFAULT 'everyone'
                           CHECK (visibility IN ('everyone','specific_members')),
  starred                INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0,1)),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','deleted','archived')),
  deleted_at             INTEGER,                         -- starts the 90-day countdown
  archive_batch_id       TEXT REFERENCES archive_batches(id),
  readded_from_item_id   TEXT REFERENCES items(id) ON DELETE SET NULL,
  created_at             INTEGER NOT NULL,
  content_updated_at     INTEGER NOT NULL,                -- drives the claimer's updated flag
  CHECK (status <> 'deleted'  OR deleted_at IS NOT NULL),
  CHECK (status <> 'archived' OR archive_batch_id IS NOT NULL)
);
CREATE INDEX idx_items_dashboard ON items(group_id, status, owner_member_id);
CREATE INDEX idx_items_owner     ON items(owner_member_id, status);
CREATE INDEX idx_items_purge     ON items(status, deleted_at);          -- nightly purge job
```
**Change from glossary B5:** `deleted_days_remaining` moves from `items` to `archive_batch_items`, because it only matters while an item is archived. On Restore archive, `deleted_at` is set back by however much of the 90 days had already passed, which keeps exactly the days that were left. *(The glossary will be updated to match when this document is approved.)*

### 3.6 `item_visibility`
```sql
CREATE TABLE item_visibility (
  item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  member_id  TEXT NOT NULL REFERENCES members(id),
  PRIMARY KEY (item_id, member_id)
);
CREATE INDEX idx_visibility_member ON item_visibility(member_id);
```
Rules enforced by the API and covered by tests:
- Rows exist only when `items.visibility = 'specific_members'`, with at least one row in that case.
- The member must be **joined** and must not be the item's owner (FR-5.8).
- When a member is removed, their rows are deleted. If that leaves a `specific_members` item with no rows, the item is visible only to its owner until edited (G13).

### 3.7 `product_links`
```sql
CREATE TABLE product_links (
  id                    TEXT PRIMARY KEY,
  item_id               TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  position              INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),                -- G8
  url                   TEXT CHECK (url IS NULL OR (length(url) <= 2000 AND url LIKE 'http%')),
  description           TEXT CHECK (description IS NULL OR length(description) <= 500),  -- G11
  product_name          TEXT CHECK (product_name IS NULL OR length(product_name) <= 200),
  price_minor           INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  currency              TEXT CHECK (currency IS NULL OR length(currency) = 3),
  image_url             TEXT CHECK (image_url IS NULL OR length(image_url) <= 2000),
  retailer              TEXT CHECK (retailer IS NULL OR length(retailer) <= 100),
  size                  TEXT CHECK (size IS NULL OR length(size) <= 50),
  color                 TEXT CHECK (color IS NULL OR length(color) <= 50),
  notes                 TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  autofill_status       TEXT NOT NULL DEFAULT 'not_applicable'
                          CHECK (autofill_status IN ('not_applicable','pending','succeeded','partial','failed')),
  autofill_fetched_at   INTEGER,
  user_edited_fields    TEXT NOT NULL DEFAULT '[]',     -- JSON array of field names the owner overrode
  created_at            INTEGER NOT NULL,
  CHECK (url IS NOT NULL OR description IS NOT NULL),
  CHECK (price_minor IS NULL OR currency IS NOT NULL),
  UNIQUE (item_id, position)
);
```
- **Limits by mode:** `exact_product` allows exactly 1 link, and `givers_choice` allows 1–5. The API checks this on every link create or delete. The `position` range (1–5) also caps the total in the database.
- Only `https` URLs are fetched by auto-fill. `http` URLs can be saved but are never fetched (architecture §6.7).
- The API only accepts `http://` or `https://` URLs. The `LIKE 'http%'` check is a backstop.

### 3.8 `claims`
```sql
CREATE TABLE claims (
  id                          TEXT PRIMARY KEY,
  item_id                     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,  -- G14
  claimer_member_id           TEXT NOT NULL REFERENCES members(id),
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active','frozen','released')),
  purchased                   INTEGER NOT NULL DEFAULT 0 CHECK (purchased IN (0,1)),
  purchased_at                INTEGER,
  fair_share_override         INTEGER NOT NULL DEFAULT 0 CHECK (fair_share_override IN (0,1)),
  claimed_at                  INTEGER NOT NULL,
  released_at                 INTEGER,
  release_reason              TEXT CHECK (release_reason IN ('unclaimed','claimer_removed')),
  last_seen_item_version_at   INTEGER NOT NULL,
  CHECK (status <> 'released' OR released_at IS NOT NULL)
);
-- THE atomic-claim guarantee (NFR-2): at most one claim per item that isn't released.
CREATE UNIQUE INDEX uq_claims_one_live ON claims(item_id) WHERE status IN ('active','frozen');
CREATE INDEX idx_claims_claimer ON claims(claimer_member_id, status);
```
- **Released claims are kept** as hidden history (G10). They're never returned by any endpoint.
- **Updated flag:** shown while `items.content_updated_at > claims.last_seen_item_version_at`. Clearing it sets `last_seen_item_version_at` to now.
- **Claiming a soft-deleted or archived item** is blocked by the API, which checks `items.status = 'active'` in the same statement: `INSERT … SELECT … WHERE status='active'`.

### 3.9 `tombstones`
```sql
CREATE TABLE tombstones (
  id                        TEXT PRIMARY KEY,
  claimer_member_id         TEXT NOT NULL REFERENCES members(id),
  group_id                  TEXT NOT NULL REFERENCES groups(id),
  recipient_name_snapshot   TEXT NOT NULL,
  item_title_snapshot       TEXT NOT NULL,
  was_purchased             INTEGER NOT NULL CHECK (was_purchased IN (0,1)),
  created_at                INTEGER NOT NULL,
  dismissed_at              INTEGER
);
CREATE INDEX idx_tombstones_claimer ON tombstones(claimer_member_id, dismissed_at);
```

### 3.10 `archive_batches` and `archive_batch_items`
```sql
CREATE TABLE archive_batches (
  id            TEXT PRIMARY KEY,
  group_id      TEXT NOT NULL REFERENCES groups(id),
  archived_at   INTEGER NOT NULL,
  archived_by   TEXT NOT NULL,          -- Cloudflare Access user ID ('sub'), not an email address
  restored_at   INTEGER,
  restored_by   TEXT
);
CREATE INDEX idx_batches_group ON archive_batches(group_id, archived_at);

CREATE TABLE archive_batch_items (
  batch_id                 TEXT NOT NULL REFERENCES archive_batches(id),
  item_id                  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  prior_status             TEXT NOT NULL CHECK (prior_status IN ('active','deleted')),
  deleted_days_remaining   INTEGER CHECK (prior_status <> 'deleted' OR deleted_days_remaining IS NOT NULL),
  PRIMARY KEY (batch_id, item_id)
);
```

### 3.11 `rate_limits`
```sql
CREATE TABLE rate_limits (
  bucket        TEXT PRIMARY KEY,       -- e.g. 'join:ip:<hash>', 'join:code:<hash>', 'request:ip:<hash>'
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);
```
IP addresses and codes are stored **hashed**, using the pepper. Rows older than 24 hours are removed by the nightly job. Limits are configuration settings (§7).

---

## 4. Key queries

### 4.1 Dashboard for viewer `:v` in group `:g` (FR-4, Part D)
```sql
SELECT i.*, m.display_name AS owner_name
FROM items i
JOIN members m ON m.id = i.owner_member_id AND m.status = 'joined'
WHERE i.group_id = :g
  AND i.owner_member_id <> :v
  AND i.status IN ('active','deleted','archived')
  AND ( i.visibility = 'everyone'
        OR EXISTS (SELECT 1 FROM item_visibility iv WHERE iv.item_id = i.id AND iv.member_id = :v) );
```
Claims for these items are then loaded separately and attached by the **view builder** (architecture §6.3). The view builder never runs this query or attaches claims for the viewer's own items.

### 4.2 Claim (NFR-2)
```sql
INSERT INTO claims (id, item_id, claimer_member_id, status, claimed_at, last_seen_item_version_at, fair_share_override)
SELECT :id, i.id, :v, 'active', :now, :now, :override
FROM items i
WHERE i.id = :item AND i.status = 'active' AND i.owner_member_id <> :v
  AND ( i.visibility = 'everyone'
        OR EXISTS (SELECT 1 FROM item_visibility iv WHERE iv.item_id = i.id AND iv.member_id = :v) );
-- 0 rows inserted          → 404 (not visible), or 409 if the item isn't active
-- unique-index violation   → 409 already_claimed
```
The fair-share check runs first, as a separate read (advisory, AD-06).

### 4.3 Archive a group (one `batch()`, so it all happens or none of it does, NFR-11)
```sql
INSERT INTO archive_batches (id, group_id, archived_at, archived_by) VALUES (:b, :g, :now, :admin);
INSERT INTO archive_batch_items (batch_id, item_id, prior_status, deleted_days_remaining)
  SELECT :b, id, status,
         CASE WHEN status='deleted' THEN max(0, 90 - (:now - deleted_at) / 86400000) END
  FROM items WHERE group_id = :g AND status IN ('active','deleted');
UPDATE claims SET status='frozen'
  WHERE status='active' AND item_id IN (SELECT item_id FROM archive_batch_items WHERE batch_id=:b);
UPDATE items SET status='archived', archive_batch_id=:b
  WHERE id IN (SELECT item_id FROM archive_batch_items WHERE batch_id=:b);
UPDATE groups SET last_archived_at=:now, version=version+1 WHERE id=:g;
```
**Restore archive** reverses it:
- items go back to `prior_status`;
- deleted items get `deleted_at = :now - (90 - remaining) days`;
- claims go from `frozen` back to `active`;
- the batch's `restored_at` is set.

### 4.4 Nightly purge (NFR-10)
For items where `status='deleted' AND deleted_at < :now - 90 days`, in batches of 100:
1. Insert tombstones for live claims, using a snapshot of the title and recipient name.
2. Delete the item. Its links, visibility rows and **all** of its claims, live or released, are removed automatically (G14).
3. Increase the group's version.

Running it again does nothing, because purged items no longer match.

### 4.5 Remove a member (FR-2.3)
One `batch()`:
1. Set the member to `removed`, with `removed_at`.
2. Revoke all their tokens.
3. Release their live claims with `release_reason='claimer_removed'`.
4. Delete their `item_visibility` rows.
5. Hard-delete their items, and their links and visibility rows.
   - Claims other members made on those items get tombstones first, the same as the purge.
6. Increase the group's version.

---

## 5. Lifecycle-to-schema mapping (glossary Part C)

| Transition | What changes |
|---|---|
| Item: active → deleted | `status`, `deleted_at`, `content_updated_at` unchanged, group `version`+1 |
| Item: deleted → active (restore) | `status='active'`, `deleted_at=NULL` |
| Item: deleted → gone | Purge job (§4.4) |
| Item: → archived / restored | §4.3 |
| Item: archived → re-add | New `items` row (+ copied links) with `readded_from_item_id` set |
| Member: pending → joined | `pin_hash`, `pin_salt`, `joined_at`, new token |
| Member: → removed | §4.5 |
| Claim: active ⇄ frozen | Archive / restore (§4.3) |
| Claim: → released | Unclaim, member removal or purge |
| Request: pending → approved | One `batch()`: create the group and the requester as a joined member, using the request's PIN hash; set the request to `approved` and record its `group_id` |

---

## 6. Size estimate (v1 scale)

At 100 groups × 15 members × 20 items × 2 links, plus claims and history, there are about 150,000 rows, roughly **30–50 MB**. That's well under D1's Free limit of 500 MB per database.

---

## 7. Configuration (environment variables, not tables)

| Key | Default | Ref |
|---|---|---|
| `SOFT_DELETE_DAYS` | 90 | FR-7.1 |
| `PIN_MAX_ATTEMPTS` / `PIN_LOCKOUT_MINUTES` | 5 / 15 | NFR-4 |
| `DASHBOARD_REFRESH_SECONDS` | 30 | FR-4.3 |
| `FAIR_SHARE_BUFFER_DEFAULT` | 1.0 | FR-6.3 |
| `JOIN_RATE_LIMIT` | 10 per IP per 15 minutes; 30 per code per hour (G15) | NFR-3 |
| `PIN_PEPPER` *(secret)* | — | AD-05 |

Note that 90 also appears in the archive SQL (§4.3); in code it comes from `SOFT_DELETE_DAYS`.

---

## 8. Open points and decisions

These continue the glossary's G-numbering. **G12 and G13 are in the backlog (B-013, B-014).** v1 ships with the interim behaviour shown, so the schema stays consistent, and it will be revisited later.

| # | Point | Decision |
|---|---|---|
| G12 | Removing a member: hard-delete the member row, or keep it marked `removed`? | **Backlog B-013. Interim v1 behaviour: keep it, marked `removed`.** Released claim history (G10) and archive records still refer to the member. Their display name is freed for reuse, and their PIN hash and tokens are cleared. |
| G13 | A "specific members" item loses its last allowed viewer because that member was removed | **Backlog B-014. Interim v1 behaviour:** the item becomes visible **only to its owner** until the owner edits it. The owner sees a note: "No one can see this item." |
| G14 | When an item is permanently deleted, what happens to its released-claim history? | **Accepted.** Delete it along with the item. The tombstone holds what the claimer needs. This keeps the "removed completely" promise in FR-7.2. |
| G15 | Join rate limits | **Accepted.** 10 attempts per IP address per 15 minutes; 30 attempts per group code per hour |
| G16 | Price storage | **Accepted.** Stored as a whole number of the currency's smallest unit (e.g. cents), with that price's own currency code. Shown in that currency, with no conversion. If no currency is found, the group's currency is used. |
| G17 | `http://` (non-secure) product links | **Accepted.** Can be saved and shown, but auto-fill never fetches them |
