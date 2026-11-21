# ADR-07: Dashboard refresh by version check

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-07

## Context
The dashboard should be roughly up to date (FR-4.3) without real-time infrastructure.

## Decision
The client checks `GET /api/groups/:id/version` every 30 s while the tab is visible, and when it regains focus.

## Consequences
Cheap and simple. Updates can be up to 30 s late. Real-time updates are backlog B-005.
