-- Migration 0001: initial schema
-- Source: docs/DATA_SCHEMA.md v1.0 (approved 2026-11-21). Limits: docs/GLOSSARY.md Part E (G1–G17).
-- Conventions: random TEXT ids, epoch-millisecond INTEGER timestamps, 0/1 booleans,
-- prices as whole minor units + ISO 4217 currency (G16), only hashes stored for secrets.

CREATE TABLE groups (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 60),
  group_code         TEXT NOT NULL UNIQUE CHECK (length(group_code) = 8),
  currency           TEXT NOT NULL CHECK (length(currency) = 3),
  fair_share_buffer  REAL NOT NULL DEFAULT 1.0 CHECK (fair_share_buffer > 0),
  version            INTEGER NOT NULL DEFAULT 0,
  created_via        TEXT NOT NULL CHECK (created_via IN ('admin','request')),
  request_id         TEXT REFERENCES group_requests(id),
  last_archived_at   INTEGER,
  created_at         INTEGER NOT NULL
);

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
  group_id                TEXT REFERENCES groups(id),
  created_at              INTEGER NOT NULL,
  decided_at              INTEGER
);
CREATE INDEX idx_group_requests_status ON group_requests(status, created_at);

CREATE TABLE members (
  id                   TEXT PRIMARY KEY,
  group_id             TEXT NOT NULL REFERENCES groups(id),
  display_name         TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 30),
  display_name_norm    TEXT NOT NULL,
  status               TEXT NOT NULL CHECK (status IN ('pending','joined','removed')),
  added_by             TEXT NOT NULL CHECK (added_by IN ('self','admin','request')),
  is_admin             INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0,1)),
  pin_hash             TEXT,
  pin_salt             TEXT,
  failed_pin_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until         INTEGER,
  joined_at            INTEGER,
  last_seen_at         INTEGER,
  removed_at           INTEGER,
  created_at           INTEGER NOT NULL,
  CHECK (status <> 'joined' OR pin_hash IS NOT NULL OR joined_at IS NOT NULL)
);
CREATE UNIQUE INDEX uq_members_name ON members(group_id, display_name_norm) WHERE status <> 'removed';
CREATE INDEX idx_members_group ON members(group_id, status);

CREATE TABLE member_tokens (
  token_hash    TEXT PRIMARY KEY,
  member_id     TEXT NOT NULL REFERENCES members(id),
  created_at    INTEGER NOT NULL,
  last_used_at  INTEGER NOT NULL,
  revoked_at    INTEGER
);
CREATE INDEX idx_tokens_member ON member_tokens(member_id);

CREATE TABLE archive_batches (
  id            TEXT PRIMARY KEY,
  group_id      TEXT NOT NULL REFERENCES groups(id),
  archived_at   INTEGER NOT NULL,
  archived_by   TEXT NOT NULL,
  restored_at   INTEGER,
  restored_by   TEXT
);
CREATE INDEX idx_batches_group ON archive_batches(group_id, archived_at);

CREATE TABLE items (
  id                     TEXT PRIMARY KEY,
  group_id               TEXT NOT NULL REFERENCES groups(id),
  owner_member_id        TEXT NOT NULL REFERENCES members(id),
  title                  TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 100),
  mode                   TEXT NOT NULL CHECK (mode IN ('exact_product','givers_choice')),
  notes                  TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  visibility             TEXT NOT NULL DEFAULT 'everyone'
                           CHECK (visibility IN ('everyone','specific_members')),
  starred                INTEGER NOT NULL DEFAULT 0 CHECK (starred IN (0,1)),
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','deleted','archived')),
  deleted_at             INTEGER,
  archive_batch_id       TEXT REFERENCES archive_batches(id),
  readded_from_item_id   TEXT REFERENCES items(id) ON DELETE SET NULL,
  created_at             INTEGER NOT NULL,
  content_updated_at     INTEGER NOT NULL,
  CHECK (status <> 'deleted'  OR deleted_at IS NOT NULL),
  CHECK (status <> 'archived' OR archive_batch_id IS NOT NULL)
);
CREATE INDEX idx_items_dashboard ON items(group_id, status, owner_member_id);
CREATE INDEX idx_items_owner     ON items(owner_member_id, status);
CREATE INDEX idx_items_purge     ON items(status, deleted_at);

CREATE TABLE item_visibility (
  item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  member_id  TEXT NOT NULL REFERENCES members(id),
  PRIMARY KEY (item_id, member_id)
);
CREATE INDEX idx_visibility_member ON item_visibility(member_id);

CREATE TABLE product_links (
  id                    TEXT PRIMARY KEY,
  item_id               TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  position              INTEGER NOT NULL CHECK (position BETWEEN 1 AND 5),
  url                   TEXT CHECK (url IS NULL OR (length(url) <= 2000 AND url LIKE 'http%')),
  description           TEXT CHECK (description IS NULL OR length(description) <= 500),
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
  user_edited_fields    TEXT NOT NULL DEFAULT '[]',
  created_at            INTEGER NOT NULL,
  CHECK (url IS NOT NULL OR description IS NOT NULL),
  CHECK (price_minor IS NULL OR currency IS NOT NULL),
  UNIQUE (item_id, position)
);

CREATE TABLE claims (
  id                          TEXT PRIMARY KEY,
  item_id                     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
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
CREATE UNIQUE INDEX uq_claims_one_live ON claims(item_id) WHERE status IN ('active','frozen');
CREATE INDEX idx_claims_claimer ON claims(claimer_member_id, status);

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

CREATE TABLE archive_batch_items (
  batch_id                 TEXT NOT NULL REFERENCES archive_batches(id),
  item_id                  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  prior_status             TEXT NOT NULL CHECK (prior_status IN ('active','deleted')),
  deleted_days_remaining   INTEGER CHECK (prior_status <> 'deleted' OR deleted_days_remaining IS NOT NULL),
  PRIMARY KEY (batch_id, item_id)
);

CREATE TABLE rate_limits (
  bucket        TEXT PRIMARY KEY,
  window_start  INTEGER NOT NULL,
  count         INTEGER NOT NULL
);
