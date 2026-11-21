-- Migration 0003: admin protocol audit log (ADR-17, docs/ADMIN_PROTOCOL.md).
-- One row per change set. Holds what was planned, the state it was planned against,
-- and what happened. Never holds group codes, PINs, hints or the admin key.
CREATE TABLE admin_changes (
  id             TEXT PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),  -- the change set's changeId
  note           TEXT CHECK (note IS NULL OR length(note) <= 200),
  ops_json       TEXT NOT NULL,                     -- the operations exactly as planned (groups by ID, never by code)
  plan_id        TEXT NOT NULL,                     -- new random ID each time the change set is planned
  plan_json      TEXT NOT NULL,                     -- the plan's step summaries, as reviewed
  basis_json     TEXT NOT NULL,                     -- group versions and request statuses the plan was based on
  status         TEXT NOT NULL CHECK (status IN ('planned','applied')),
  actor          TEXT NOT NULL,                     -- 'admin-key' in v1 (ADR-17)
  planned_at     INTEGER NOT NULL,
  applied_at     INTEGER,
  result_json    TEXT,                              -- IDs created or changed; codes are looked up live, never stored
  CHECK (status <> 'applied' OR (applied_at IS NOT NULL AND result_json IS NOT NULL))
);
CREATE INDEX idx_admin_changes_planned ON admin_changes(planned_at);
