# ADR-10: workers.dev URLs, and the /j/ short path for invites

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-10

## Context
No custom domain for now. Invite links contain the group code.

## Decision
Use free `*.workers.dev` URLs. Invite links use the app's own `/j/<code>` path. No third-party shorteners for invite links; TinyURL is allowed for the home page.

## Consequences
No domain cost. Group codes are never stored by a third party.
