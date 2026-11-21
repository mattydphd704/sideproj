# ADR-02: Free plan for dev; upgrade to Workers Paid before prod

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-02

## Context
Free plan limits: 10 ms of CPU per request, 100,000 requests a day, 7 days of database recovery.

## Decision
Dev runs on the TPM's current Free account. **Upgrading to Workers Paid ($5 a month) must happen before the first prod deploy.**

## Consequences
Dev may occasionally see auto-fill hit the CPU limit. Prod is safe from the daily request cap.
