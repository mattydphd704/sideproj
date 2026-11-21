# ADR-05: PINs hashed with HMAC-SHA-256 and a secret pepper

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-05

## Context
A 4–6 digit PIN has only about 1.1 million possible values, and slow hashes cost a lot of CPU on the Free plan.

## Decision
Store `HMAC-SHA-256(PIN_PEPPER, salt ‖ pin)`. The pepper is a Worker Secret, different in each environment. Online guessing is stopped by lockout and rate limits.

## Consequences
A leaked database alone can't be brute-forced. If the pepper is lost, every PIN has to be reset.
