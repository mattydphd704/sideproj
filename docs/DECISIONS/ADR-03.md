# ADR-03: TypeScript, Hono, React + Vite, hand-written SQL, Vitest, Playwright

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-03

## Context
We want one language, low CPU use per request, and tests that run locally without a Cloudflare account.

## Decision
Use the stack in architecture §3.

## Consequences
All automated tests run in the container. There's no ORM, so queries are visible SQL, reviewed in pull requests.
