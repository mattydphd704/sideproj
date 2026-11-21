# ADR-06: Advisory fair-share check

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-06

## Context
D1 can't run the fair-share check and the claim as one locked step.

## Decision
Check fair share as a separate read just before the claim. The claim itself is protected by a unique index, so it's always atomic.

## Consequences
Near-simultaneous claims can rarely skip a warning or get one they didn't need. The exact version (a Durable Object per group) is in backlog B-012 and tested in PR-003.
