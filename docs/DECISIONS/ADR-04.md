# ADR-04: Admin sign-in via Cloudflare Access

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-04

## Context
The admin needs secure sign-in, but members have no accounts.

## Decision
Put `/admin` and `/api/admin/*` behind Cloudflare Access, allowing only the TPM's identity. The Worker also checks the signed Access token.

## Consequences
We don't store an admin password. This requires Zero Trust setup in the dashboard (AR-04).
