# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semantic versioning once code ships.

## [Unreleased]

### Added: UI and workflow, branch `claude/sharp-knuth-889h6a-ui-workflow` (2026-11-21)
- ADR-15: shadcn/ui is the design language.
- G18 decided: build the APIs and the UI together, screen by screen.
- `docs/UI_INTERACTION_MAPS.md` Section 1 (Getting in, T-01 to T-08) drafted: flows, phone wireframes with shadcn components, every piece of wording with a C- ID, API calls and error handling, accessibility, open points G24 to G28, and planned tests UI-01 to UI-14.
- AR-08 (shadcn packages) prepared for approval.

### Housekeeping (2026-11-21)
- Dev test data cleared at the TPM's request. The database is empty, with schema and migrations kept. Re-seed steps are in `docs/DEV_ENVIRONMENT.md`.
- `docs/PROJECT_HANDBOOK.md` added: how we work, the review loop, testing rules, a map of every document and code area, accounts and access state, next steps, and how to resume in a new session.

### Deployed: Cloudflare dev (2026-11-21)
- **Dev app live: https://giftlist-dev.mcjdonovan.workers.dev** (AR-01). Worker `giftlist-dev`, D1 `giftlist-dev` (migrations 0001–0002), secret `PIN_PEPPER` set only on Cloudflare.
- Seeded with the Smith Family test group (`SMTH-2345`), using the same data as the prototype (`scripts/dev-seed.mjs`).
- ADR-16: the dev deploy embeds the web app in the Worker (`wrangler.dev.jsonc`, `src/worker/embedded.ts`, `scripts/embed-assets.mjs`, `npm run deploy:dev`), because this environment's proxy blocks the separate asset upload.
- `scripts/dev-requests.mjs`: the engineer approves or declines dev group requests until the admin area exists.
- Live checks DEV-01, DEV-02, DEV-03, DEV-05 (part) and DEV-08 passed; test traces removed. See `docs/DEV_ENVIRONMENT.md`.

### Changed: TPM review round 3, all open flags resolved (2026-11-21)
- **Global flag, dark mode:** outline buttons (e.g. "Start a new group") get a visible surface and border, and borders are stronger in dark mode. A `dark:` variant follows both the device setting and an explicit `data-theme`. App-wide.
- **One way in:** the Join screen's dropdown lists everyone in the group (reverses R1-4, G33). Returning people choose their name and enter only their PIN. After a wrong PIN: "I don't have a PIN yet" (explains, suggests e.g. "Alex B", "Use a different name") and "I can't remember my PIN" (hint + ask the organiser). A new person typing a taken name is asked "Is that you?". The separate Sign back in screen is removed (`/j/<code>/back` opens Join). Brief v1.2 (FR-1.7, FR-2.2, new FR-1.11). Server unchanged.
- Global rules GR-1 and GR-2 rewritten, plus §1.2/§1.3 and the wording tables. Six C-REC IDs and three C-JOIN/C-ERR IDs retired; C-JOIN-32–35 and C-REC-16–19 added.
- Prototype: SC-11 moved to the backlog (B-015); SC-04 and SC-06 rewritten; SC-13 added. The placeholder screen is to be replaced by each person's home screen (B-016).
- BUG-006 fixed: "There's already a Alex" grammar, found by the walkthrough test.
- Tests: UI-06, 08, 09, 15, 17 and 21 rewritten; UI-22 to UI-24 and PROTO-15 added.

### Added: prototype progress and global changes (2026-11-21)
- "Works as expected" puts a green check on the scenario, and the top bar shows "N of 12 working".
- "Global change" button: a change that applies to every scenario showing the same screen, or to every screen. It appears in every affected scenario and is resolved once for all of them. Scenarios passed before a global fix show "Re-check".
- Each scenario lists the screens it passes through. Flags record their screen and scope.
- Tests PROTO-13 (green check and count) and PROTO-14 (a global change reaches exactly the scenarios that share the screen).

### Changed: TPM review round 2, global workflow logic (2026-11-21)
- **Global rules GR-1 to GR-8** for every Getting-in screen and scenario (`UI_INTERACTION_MAPS.md` §1.00): one flow map, the same layout for the same screen, consistent timing for problems, the phone's own picker for dropdowns, and one shared data set for the prototype.
- Join screen: "Have you already been added?" is always shown and answered first. "Your name" appears for new people only. The PIN block appears once that's answered. With nobody waiting, "No, I'm new here" is already chosen (G32).
- One shared "About your PIN" block (`PinBlock`) for Join and Start a group. PINs are checked the moment the 4th number is typed, with "PINs match." The hint is checked as you type. Name and group name are checked when you leave the field.
- All dropdowns use a styled native picker (`NativeSelect`). The custom pop-up Select is no longer used.
- Prototype: all 12 scenarios use the same Smith Family data. Cards show "How they arrive" and "This browser" and expand to the group data. Steps are rewritten to the global flow. The engineer's response appears on each marked result.
- Bugs found by the new scenario walkthroughs and fixed: **BUG-004** (stale group details reused on the Join screen) and **BUG-005** (a closed screen could still navigate).
- Tests: UI-15 updated; UI-19, UI-20, UI-21 and PROTO-00 to PROTO-12 added; `npm run verify` now also builds and walks the prototype (ENV-11).

### Changed: prototype scenario picker (2026-11-21)
- All 12 setup and sign-in scenarios are always visible, grouped into 4 workflows, with Previous and Next buttons. Previously, at narrower widths the list collapsed into a dropdown and only SC-01 was obvious (TPM feedback).

### Added: clickable prototype (2026-11-21)
- `src/prototype/`: the real Section 1 screens in a phone frame, with a pretend in-page server (same validation and messages as the Worker), 12 workflow scenarios (SC-01 to SC-12), in-line flagging (records the C- wording ID of the tapped element) and pass/fail per scenario. Published privately as an artifact, with flags stored in its shared database. `npm run prototype` rebuilds it.
- The router can keep its path in memory (for the prototype). Theme tokens also honour an explicit `data-theme` setting.

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
