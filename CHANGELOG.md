# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semantic versioning once code ships.

## [Unreleased]

### Added: UI and workflow, branch `claude/sharp-knuth-889h6a-ui-workflow` (2026-11-21)
- ADR-15: shadcn/ui is the design language.
- G18 decided: build the APIs and the UI together, screen by screen.
- `docs/UI_INTERACTION_MAPS.md` Section 1 (Getting in, T-01 to T-08) drafted: flows, phone wireframes with shadcn components, every piece of wording with a C- ID, API calls and error handling, accessibility, open points G24 to G28, and planned tests UI-01 to UI-14.
- AR-08 (shadcn packages) prepared for approval.

### Changed: TPM UI review round 1 (2026-11-21)
- Home: "Gift Lists" heading, intro line and "Have a group code?" removed; the header line is kept for future use (R1-1).
- Scenarios documented for how people reach frames 06–08 (R1-2).
- PINs are exactly 4 numbers, shown while typing, with an optional PIN hint (40 characters at most, can't contain the PIN, shown on request on Sign back in, cleared by a PIN reset). Brief v1.1 (FR-1.4, FR-1.7, NFR-4), G29, migration `0002_pin_hint.sql`, new `POST /api/groups/hint` (R1-3).
- The Join screen's pre-added names are a "Have you already been added?" dropdown listing only people who haven't signed in yet (FR-2.2) (R1-4).
- Tests: ID-11 updated; ID-23–25, REQ-07, UI-15–18 added; UI-05 updated. Screenshots regenerated (20).
- Open for TPM: G30 (extra protection for 4-digit PINs), G31 (keep the "Already here" line).

### Added: Section 1 screens built (2026-11-21)
- AR-08 approved and installed (shadcn/ui: Tailwind 4, Radix UI, lucide icons, sonner, input-otp and helpers): 0 vulnerabilities, no install scripts.
- API: `POST /api/group-requests` and `GET /api/group-requests/current` (request, wait, approve or decline, with automatic move-in); recovery reports `pinWasReset` (G25); lookup returns the group ID; the API fails closed without a proper PIN secret key.
- UI: shadcn theme (light and dark follow the device) and components, a wording file (`src/web/copy.ts`) keyed by C- IDs, and screens for Home, Join (with pre-added names), Sign back in (with lockout), Start a group, Waiting and Declined, plus a temporary "inside a group" screen.
- Tests: REQ-01 to REQ-06, ID-22, CFG-01, and UI-01 to UI-14 in a real browser on phone and desktop. UI-13 keeps the doc wording and the code wording identical. `npm run verify` now includes the browser tests (ENV-10).
- `npm run screens` captures 18 review screenshots in `docs/screens/section-1/`.
- Fixed BUG-003: long group names made the Join button overflow at 360 px. Found by UI-12.
- `docs/UI_TASK_MAP.md` v0.1: 50 user tasks and system events (T-01 to T-59, S-01 to S-07), an end-to-end workflow map, an admin workflow map, the lifecycle of one gift across people, the screen map, 18 wording decisions (L1 to L18) and open points G18 to G23.

### Process (2026-11-21)
- ADR-14: branching workflow. Step 4 work is on branch `claude/sharp-knuth-889h6a-step4-views`, cut from `2ca0f3d`.
- The type-check label in `verify` now reads "src, tests, scripts".
- `docs/BRANCHES.md` added. UI and workflow work moves to `claude/sharp-knuth-889h6a-ui-workflow`, and the step 4 branch is paused and kept.

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
