# ADR-12: Schema conventions

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-12

## Context
Data must be consistent, private and exact.

## Decision
Random text IDs, timestamps in epoch milliseconds, prices as whole numbers of the smallest currency unit with a currency code (G16), limits enforced by CHECK constraints, only hashes stored for secrets. Removed members are kept marked `removed` (interim, B-013).

## Consequences
See `DATA_SCHEMA.md` v1.0.
