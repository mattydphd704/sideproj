-- Migration 0002: optional PIN hint (TPM UI review round 1, 2026-11-21; G29).
-- PINs are now exactly 4 digits; that rule lives in the API (only hashes are stored).
ALTER TABLE members ADD COLUMN pin_hint TEXT CHECK (pin_hint IS NULL OR length(pin_hint) <= 40);
ALTER TABLE group_requests ADD COLUMN requester_pin_hint TEXT CHECK (requester_pin_hint IS NULL OR length(requester_pin_hint) <= 40);
