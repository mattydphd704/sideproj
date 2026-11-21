# ADR-17: Admin work through a plan → apply protocol, protected by an admin key

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM ("we don't need a UI for admin right now"; chose option A)
- **Supersedes:** ADR-04 for now (Cloudflare Access sign-in is deferred along with the admin screens)
- **Ref:** [ADMIN_PROTOCOL.md](../ADMIN_PROTOCOL.md), ARCHITECTURE §6.8, AR-09, backlog B-017

## Context
The admin (the TPM) needs to review and approve group requests, create groups, and add, remove and reset people in them. ADR-04 planned an admin area of screens behind Cloudflare Access (AR-04). The TPM decided admin screens aren't needed yet: admin work will be done from the Claude session. Until now the engineer approved dev requests with a script that wrote raw SQL to the dev database (`scripts/dev-requests.mjs`), which bypassed the server's checks, kept no audit trail and wasn't fit for prod.

Two options were considered:
- **A. Admin endpoints on the Worker**, protected by an admin key, reusing the server's tested logic.
- **B. Direct database commands** from the session with the existing Cloudflare token.

## Decision
1. **Option A.** The Worker exposes `/api/admin/*`: read endpoints (requests, groups, one group, audit log) and two write endpoints, **plan** and **apply**.
2. **Protocol `giftlist-admin/1`:** every change is a change set that is planned (checked, nothing written), reviewed by the TPM, then applied exactly as reviewed, all or nothing, once only. Rules AP-1 to AP-10 in ADMIN_PROTOCOL.md.
3. **Admin key:** a secret of at least 32 characters, one per environment, stored as the Worker secret `ADMIN_KEY` and sent in the `X-Admin-Key` header. Without it the admin endpoints are off (`503`). Wrong keys are rate-limited per network.
4. **The key never reaches the session's machine:** on dev it's saved by the TPM as a network secret on the `sideproj` cloud environment for the dev host, and the proxy adds the header (AR-09).
5. **Audit log** in D1 (`admin_changes`, migration 0003), with no codes, PINs, hints or keys. `actor` is `admin-key`.
6. `scripts/dev-requests.mjs` is retired.

## Consequences
- The admin functions FR-2.1 to FR-2.6 work on dev without any screens; archive and restore (FR-2.8) are added as protocol 1.1 once items exist.
- The admin credential in the glossary (`admin_credential_hash`, NFR-7) is now the admin key. The Worker holds it as a secret, not the database.
- One shared key means there's no per-person identity in the audit log. That's acceptable with a single admin (FR-2.7). Per-group admins (B-001) would need per-person credentials.
- Anyone holding the key has full admin power over that environment. Mitigations: per-environment keys, rate limiting, fail closed, never in the repo, chat or command line, and every change is reviewed and logged. Rotating the key means setting a new Worker secret and a new network secret.
- Admin screens and Cloudflare Access move to the backlog (B-017, AR-04). If they're built later, they can use the same plan and apply endpoints, with Access in front.
