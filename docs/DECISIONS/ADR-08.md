# ADR-08: Auto-fill runs separately, after saving, with safety limits

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-08

## Context
Retailer pages are slow, large and sometimes hostile.

## Decision
A separate request after the item is saved: https only, 5 s timeout, 2 MB cap, at most 3 redirects, and fields the owner edited are never overwritten.

## Consequences
Saving never waits for auto-fill. Some retailers will block us, and the PR-002 experiment measures how many.
