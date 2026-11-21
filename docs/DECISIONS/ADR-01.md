# ADR-01: Cloudflare Workers, Static Assets and D1 as the platform

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-01

## Context
The TPM wants hosting on Cloudflare, Free or $5 a month. v1 needs a small API, a shared database, a nightly job and static pages.

## Decision
Use one Worker per environment to run the API and serve the static pages, with one D1 (SQLite) database per environment.

## Consequences
Everything fits within Cloudflare's included limits. There are no other servers to manage. We're tied to D1's limits, e.g. no interactive transactions (see ADR-06).
