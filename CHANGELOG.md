# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semantic versioning once code ships.

## [Unreleased]

### Added: planning phase (2026-11-21)
- `docs/PROJECT_BRIEF.md` v1.0: requirements, with questions Q1 to Q31 resolved.
- `docs/GLOSSARY.md`: terms, field catalogue, lifecycles, what each viewer sees, decisions G1 to G17.
- `docs/ARCHITECTURE.md` v1.0: Cloudflare Workers + D1 design, plan compatibility, access requests.
- `docs/DATA_SCHEMA.md` v1.0: 12 tables, key queries, lifecycle mapping.
- `docs/DECISIONS/`: ADR-01 to ADR-12.
- `docs/PR_TRACKER.md` (PR-001 to PR-003), `docs/BACKLOG.md` (B-001 to B-014), `docs/BUGS.md`.

### Added: project setup and database (2026-11-21)
- Dependencies under the ADR-13 policy: exact versions, lockfile checksums, versions at least 14 days old, no install scripts, `npm audit` clean (0 vulnerabilities).
- Worker (Hono) with `/api/health`, a placeholder nightly job, and the `/j/*` invite path served by the app.
- Placeholder React web app.
- `migrations/0001_init.sql`: all 12 tables from `DATA_SCHEMA.md` v1.0.
- 23 schema tests: foreign keys, length limits (G1, G4, G6), unique display names, group codes, link limits (G8), price and currency (G16), URL format, one live claim per item including 5 simultaneous claims, and cascade on permanent delete (G14).
- Fixed BUG-001 (audit findings) and worked around BUG-002 (npm crash).

### Added: test tracking (2026-11-21)
- `docs/TEST_PLAN.md`: every test with an ID, what it proves, and requirement and success-criteria coverage (137 tests: 32 passing, 97 planned, 8 blocked on access).
- `npm run verify` (`scripts/verify.mjs`): runs 9 environment checks plus the full test suite and writes `docs/TEST_RESULTS.md`, with run history.
- Test IDs added to every test name for traceability.

### Added: identity and access (2026-11-21)
- `POST /api/join`: join with a group code, display name and PIN. Picking a pending name on first visit sets its PIN.
- `POST /api/recover`: sign in on a new device with name and PIN. Lockout after 5 wrong PINs for 15 minutes. After an admin PIN reset, the next PIN entered becomes the new one.
- `POST /api/groups/lookup`: group name and member list for the join and recovery screens.
- `GET /api/me`: every group this browser belongs to, for the group switcher.
- Secure member cookies (`HttpOnly`, `Secure`, `SameSite=Lax`, 400 days, one per group). Only token hashes are stored.
- PINs stored as HMAC-SHA-256 with a salt and pepper (ADR-05).
- Rate limits (G15) with hashed keys. CSRF protection on all data-changing requests. Group codes accepted with or without the dash, in any case. Logs never include codes, PINs or tokens.
- 23 identity tests (ID-01 to ID-21). The CSRF and lockout tests were confirmed to fail when their protection is deliberately removed.
- `@types/node` added (approved), so type checking now covers tests and scripts.
