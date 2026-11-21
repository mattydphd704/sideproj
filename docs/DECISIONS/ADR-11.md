# ADR-11: Account ownership and deploy rights

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-11

## Context
The TPM requires access to be requested and approved.

## Decision
The TPM owns the Cloudflare account. The engineer deploys to dev only. Every prod deploy needs the TPM's go-ahead.

## Consequences
Prod changes are gated by the TPM.
