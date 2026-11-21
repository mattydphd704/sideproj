# Project Handbook: How We Work

| | |
|---|---|
| **Purpose** | One place that explains how this project is run and where everything lives, so any new session (or person) can pick up exactly where we left off. |
| **Last updated** | 2026-11-21 |
| **Project** | Gift Lists: a web app for families and friends to share wish lists and coordinate gifts, with no accounts |
| **Repo** | `mattydphd704/sideproj` |
| **Current work branch** | `claude/sharp-knuth-889h6a-ui-workflow` (see [BRANCHES.md](BRANCHES.md)) |
| **Dev app** | https://giftlist-dev.mcjdonovan.workers.dev (test data currently cleared; see [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md)) |

---

## 1. Roles

| Role | Who | Responsibilities |
|---|---|---|
| **TPM** | The project owner (user) | Sets requirements, makes decisions, approves each phase, grants every access request, reviews in the prototype, decides what reaches prod. |
| **Engineer** | Claude | Proposes architecture, data and design; writes the docs first and the code second; tests everything; tracks bugs, decisions and changes; asks before using any new access. |

---

## 2. Working agreement

1. **Phase gates.** Outline → architecture → data schema → docs → TPM sign-off → code (dev/test only) → full review → prod. No phase starts until the TPM approves the one before it.
2. **Ask before access.** Any new connection, credential, network host, package or repository is an **access request (AR-nn)** in [ARCHITECTURE.md](ARCHITECTURE.md) §11, and is used only once the TPM approves. Secrets go through the secure credential form, never the chat.
3. **Dev/test first.** Everything is built and tested locally, then on Cloudflare **dev**. **Prod** needs a full review and the TPM's explicit go-ahead (AR-07, release gate REL-*). Prod has never been touched.
4. **Docs first, then code, and keep them in sync.** Requirements, wording and rules live in the docs. Code follows them, and tests prove they match (e.g. UI-13 fails if on-screen wording differs from the doc).
5. **Decisions are recorded.** Open questions get an ID (Q-, G-, L-, A-, R- numbers) with a recommendation. The TPM decides, and the decision is logged where it applies. Architecture decisions get an ADR.
6. **Plain language for the TPM.** Short tables, clear asks, one recommendation per question.
7. **Git.** Commit and push only to the current work branch. Never push to the base branch or `main`, never merge, and open a pull request only when the TPM asks ([ADR-14](DECISIONS/ADR-14.md)).

---

## 3. How a feature moves from idea to dev

```
Requirement (PROJECT_BRIEF) ─▶ Terms & fields (GLOSSARY) ─▶ Architecture / Schema
        │                                                        │
        ▼                                                        ▼
 Task map (UI_TASK_MAP) ─▶ Interaction maps + exact wording (UI_INTERACTION_MAPS)
        │
        ▼
 Build: API + screens together (G18), shadcn/ui (ADR-15)
        │
        ▼
 Tests (TEST_PLAN) ─▶ npm run verify ─▶ TEST_RESULTS.md committed
        │
        ▼
 Clickable prototype (scenarios SC-nn) ─▶ TPM flags / pass-fail ─▶ fix docs + UI together
        │                                     (repeat until "testing complete")
        ▼
 Deploy to Cloudflare dev ─▶ live checks (DEV-nn) ─▶ TPM review ─▶ (later) prod
```

### 3.1 The review loop with the prototype
- **The prototype** (private artifact: https://claude.ai/artifact/MXW1Uugh9HiZn4ffTukGE7) runs the **real screens** against a pretend in-page server. Source: `src/prototype/`; rebuild with `npm run prototype`.
- **Scenarios** (SC-01 to SC-13, 12 active) each state who, how they arrive, what this browser already knows, test data, expected steps and the expected outcome. All of them use one shared data set (GR-8).
- **TPM tools in the prototype:**
  - **Flag something:** tap an element; the flag records the screen and the C- wording ID.
  - **Global change:** applies to every scenario that shows the same screen, or to every screen.
  - **Works as expected / Needs changes:** "Works as expected" shows a green check; a later global fix turns it into **Re-check**.
- **Engineer's loop:** read every flag and result (the artifact's `flags` and `runs` collections) → fix the docs and code together → run all checks → republish → mark each flag **Done** with a resolution note.
- **Global rules GR-1 to GR-8** ([UI_INTERACTION_MAPS.md](UI_INTERACTION_MAPS.md) §1.00) keep every screen and scenario consistent: one flow, same layout for the same screen, consistent timing for problems, the phone's own picker for dropdowns, shared test data.
- **Feedback rounds so far:** R1 (Home, PINs, hint, dropdown), R2 (global workflow logic), R3 (dark mode, one way in, PIN help, "Is that you?"). Each round is logged in UI_INTERACTION_MAPS §1.6b–§1.6e.

### 3.2 Testing rules
- `npm run verify` runs **11 environment checks** plus every automated test, and writes [TEST_RESULTS.md](TEST_RESULTS.md):
  - **ENV-01 to ENV-05:** clean install from the lockfile, security audit, type check, build, migrations.
  - **ENV-06:** unit and API tests (Vitest).
  - **ENV-07 to ENV-09:** live local server checks.
  - **ENV-10:** browser tests (Playwright, phone and desktop).
  - **ENV-11:** prototype scenario walkthroughs.
- **The rules:**
  - Run `verify` before every code commit, and commit the regenerated TEST_RESULTS.md.
  - Never skip, disable or delete a failing test. Fix it or log it in BUGS.md.
  - Every bug fix gets a test.
  - Security-critical tests are checked against deliberate breaks (mutation checks).
  - Tests use no real data and no internet.
- **Latest:** 102 of 102 tests passing; DEV-01, DEV-02, DEV-03, DEV-05 (part) and DEV-08 passed on the live dev app.

### 3.3 Dependencies ([ADR-13](DECISIONS/ADR-13.md))
- Exact pinned versions, committed lockfile, install with `npm ci`.
- Only versions published at least 14 days earlier, no install scripts, `npm audit` clean.
- Every new package is an access request to the TPM.

---

## 4. Document map

### 4.1 Requirements and design
| File | What it holds | Status |
|---|---|---|
| [PROJECT_BRIEF.md](PROJECT_BRIEF.md) | Problem, goals, roles, functional and non-functional requirements (FR-1–FR-7, NFR-1–NFR-11), success criteria, decision log Q1–Q31 | v1.2, approved |
| [GLOSSARY.md](GLOSSARY.md) | Every term (Part A), field catalogue for every table (Part B), status lifecycles (Part C), **what each viewer sees** (Part D), field decisions G1–G17 (Part E) | Current |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Cloudflare Workers + D1 design, plan compatibility, key designs (identity, PINs, response shaping, claims, archive), API outline, capacity and cost, **access requests AR-01–AR-08** | v1.0 + updates |
| [DATA_SCHEMA.md](DATA_SCHEMA.md) | 12 tables as SQL, key queries, lifecycle mapping, migration history | v1.0 + migration 0002 |
| [DECISIONS/](DECISIONS/README.md) | ADR-01 to ADR-16: platform, plans, stack, admin sign-in, PIN hashing, advisory fair share, refresh, auto-fill, view builder, URLs, ownership, schema conventions, dependency policy, branching, shadcn/ui, dev deploy | All accepted |

### 4.2 UI and workflow
| File | What it holds |
|---|---|
| [UI_TASK_MAP.md](UI_TASK_MAP.md) | 50 user tasks and system events (T-01–T-59, S-01–S-07), end-to-end and admin workflow maps, screen map, wording decisions L1–L18, gaps G18–G23 |
| [UI_INTERACTION_MAPS.md](UI_INTERACTION_MAPS.md) | **Section 1, Getting in:** global rules GR-1–GR-8, per-screen wireframes, **every on-screen text with its C- ID**, API and error handling, accessibility, open points G24–G33, review logs R1–R3, prototype scenarios, UI tests. Sections 2+ (My list, giving, admin) are not mapped yet. |
| `docs/screens/section-1/` | 21 review screenshots, regenerated by `npm run screens` |

### 4.3 Tracking
| File | What it holds |
|---|---|
| [TEST_PLAN.md](TEST_PLAN.md) | Every test with an ID, what it proves, requirement coverage, status (passing, planned or blocked) |
| [TEST_RESULTS.md](TEST_RESULTS.md) | Generated by `npm run verify`: latest results plus run history |
| [BUGS.md](BUGS.md) | BUG-001 to BUG-006, all fixed or worked around |
| [BACKLOG.md](BACKLOG.md) | Deferred items B-001 to B-016 (e.g. per-group admins, auto-archive, retention, exact fair share, placeholder → home screen) |
| [PR_TRACKER.md](PR_TRACKER.md) | Feature experiments PR-001 (partial claims), PR-002 (auto-fill), PR-003 (fair-share tuning) |
| [BRANCHES.md](BRANCHES.md) | Branch register and status |
| [../CHANGELOG.md](../CHANGELOG.md) | Everything that changed, newest first |

### 4.4 Environments
| File | What it holds |
|---|---|
| [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md) | Dev URL, how it's deployed, **how to re-seed the Smith Family test data** (currently cleared), how to clear it, live check results |

---

## 5. Code map (for reference)

| Path | What it is |
|---|---|
| `migrations/` | D1 SQL: `0001_init.sql` (12 tables), `0002_pin_hint.sql` |
| `src/worker/` | Hono API: identity (join, recover, lookup, hint, me), group requests, rate limits, CSRF, fail-closed pepper check. `embedded.ts` is the dev-deploy entry (ADR-16). |
| `src/web/` | React + shadcn/ui app. `copy.ts` holds every on-screen string under its C- ID. Screens: Home, Join (the one way in), NewGroup, GroupPlaceholder. Shared `PinBlock` and `NativeSelect`. |
| `src/shared/limits.ts` | Field limits (G1–G17, 4-digit PIN, hint 40 characters) |
| `src/prototype/` | Clickable prototype: scenarios, mock server (reuses real validation), flags |
| `test/schema`, `test/api`, `test/ui` | Vitest: database rules, API behaviour, doc/code wording sync |
| `test/e2e/` | Playwright: getting-in journeys, review screenshots, prototype walkthroughs |
| `scripts/` | `verify.mjs`, `build-prototype.mjs`, `embed-assets.mjs`, `dev-seed.mjs`, `dev-requests.mjs` |
| `wrangler.jsonc` / `wrangler.dev.jsonc` | Local config / Cloudflare dev config |

---

## 6. Accounts, access and environments (no secrets here)

| Item | State |
|---|---|
| Cloudflare account | TPM's account, **Free plan**. Upgrade to Workers Paid before prod (ADR-02). |
| Cloudflare API token | Workers + D1, saved as a **network secret on the `sideproj` cloud environment**. Injected by the session proxy, never in the repo or the chat. |
| Cloud environment `sideproj` | Personal, for this repo. Allowed hosts: `api.cloudflare.com`, `giftlist-dev.mcjdonovan.workers.dev`, plus package registries. |
| Dev Worker / D1 | `giftlist-dev` / `giftlist-dev`. Secret `PIN_PEPPER` stored only on Cloudflare. |
| Cloudflare Access (admin sign-in) | Not set up yet (AR-04). Needed before the admin area is tested. |
| Retailer sites for auto-fill | Not granted (AR-03). Needed for the PR-002 experiment. |
| Prod | Not created. Needs AR-07 and the release gate. |

---

## 7. Where we are and what's next

**Done:**
- Planning docs.
- Database, and the identity and group-request APIs.
- **Section 1 (Getting in)**: mapped, built, reviewed in 3 prototype rounds, and **tested complete by the TPM**.
- Deployed to Cloudflare dev and checked live. Dev test data has since been cleared.

**Open decisions for the TPM:**
- G30: extra protection for 4-digit PINs.
- G31: keep the "Already here" line.
- G32: pre-choose "No, I'm new here" in an empty group.
- Whether to open a pull request from the work branch into the base branch.

**Next, as recommended:**
1. **Section 2, My list:** task and interaction maps, then build. This replaces the placeholder screen (B-016).
2. Section 3: Giving (dashboard, claims, fair share).
3. Section 4: Delete, archive and restore.
4. Section 5: Admin area, which needs Cloudflare Access (AR-04).

Each follows the same loop: map, approve, build with tests, prototype review, dev.

### Resuming in a new session
1. Check out `claude/sharp-knuth-889h6a-ui-workflow` and run `npm ci`, then `npm run verify` (it should report PASS).
2. Read this handbook, then [PROJECT_BRIEF.md](PROJECT_BRIEF.md), [UI_INTERACTION_MAPS.md](UI_INTERACTION_MAPS.md) §1.00, [TEST_PLAN.md](TEST_PLAN.md) and [DEV_ENVIRONMENT.md](DEV_ENVIRONMENT.md).
3. Use the `sideproj` cloud environment for anything that touches Cloudflare.
4. Follow the working agreement in §2. When in doubt, ask the TPM.
