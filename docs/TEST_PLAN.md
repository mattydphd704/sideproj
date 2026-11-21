# Test Plan: Gift List Tracker v1

| | |
|---|---|
| **Status** | v1.0, living document |
| **Last updated** | 2026-11-21 |
| **Results** | [TEST_RESULTS.md](TEST_RESULTS.md), regenerated on every `npm run verify` |
| **Defects** | [BUGS.md](BUGS.md) |

This plan lists **every test we run or will run**, what each one proves, and which requirement it covers. Each test has an ID. The same ID appears in the test's name in the code and in the results file, so any line can be traced from requirement → test → result.

**Status:**
- ✅ **Passing**: implemented and passing in the latest run
- 🟡 **Planned**: written down here, not built yet
- 🔒 **Blocked**: needs access that hasn't been granted yet (AR-xx)
- ❌ **Failing**: see BUGS.md

---

## 1. How testing works

### 1.1 Levels

| Level | What it checks | Tool | Where it runs | Who runs it |
|---|---|---|---|---|
| **Environment checks (ENV)** | Install, security audit, types, build, migrations, the app starts | `scripts/verify.mjs` | Local | Engineer, before every code commit |
| **Schema tests (SCH, CLM)** | Rules the database itself enforces | Vitest + local D1 | Local | Automatic |
| **API tests (ID, REQ, ITM, CLM, FS, LIF, ADM, DSH)** | Each endpoint's behaviour and error cases | Vitest + local D1 + Hono `app.request()` | Local | Automatic |
| **View tests (VIS)** | **What each viewer can and can't receive** (glossary Part D): the surprise rule and hidden items | Vitest | Local | Automatic |
| **Auto-fill tests (AF)** | Extracting product details, and safety limits | Vitest + saved sample pages | Local | Automatic |
| **End-to-end tests (E2E)** | Whole user journeys in a real browser, at phone and desktop sizes | Playwright | Local, then dev | Automatic |
| **Scenario suites (PR-001/002/003)** | Feature experiments and tuning | Vitest + Playwright | Local and dev | Engineer, results reviewed by TPM |
| **Dev environment tests (DEV)** | The same app on real Cloudflare | Scripted calls + Playwright | Cloudflare dev | 🔒 AR-01 |
| **User acceptance (UAT)** | The TPM uses the app on dev from a manual checklist | Manual | Cloudflare dev | TPM |
| **Release gate (REL)** | Prod readiness checklist | Manual + scripted | — | TPM signs off |

### 1.2 Rules
1. **Every code commit runs `npm run verify` first** and commits the refreshed `TEST_RESULTS.md`, so you can see the result for each change.
2. **New features get tests before or alongside the code**, and their IDs are added to this plan.
3. **A failing test is never skipped, disabled or deleted to get a green run.** It's fixed, or logged in BUGS.md with the test ID, and the run is reported as FAIL.
4. **Tests use no real data and no internet.** Auto-fill uses saved sample pages. Real retailer tests need AR-03.
5. **Every bug fix adds a test** that would have caught it.
6. **Tests are checked against deliberate breaks.** For security-critical tests, the engineer temporarily breaks the protection to confirm the test fails, then restores it. Done for ID-19 (CSRF) and ID-09 (PIN lockout) on 2026-11-21.

### 1.3 How you can check results
- **Read [TEST_RESULTS.md](TEST_RESULTS.md) on GitHub:** the latest result, every check and test with ✅/❌, and a history of runs.
- **Or run it yourself** in a checkout:

```bash
npm ci
```

```bash
npm run verify
```

### 1.4 Entry and exit criteria

| Stage | Can start when | Done when |
|---|---|---|
| Local feature work | Previous `verify` is PASS | Feature tests pass, `verify` is PASS, docs are updated |
| Deploy to dev | All local tests pass, AR-01 granted | DEV-* pass |
| TPM acceptance | DEV-* pass | TPM signs off the UAT checklist |
| Prod | UAT signed off; Workers Paid enabled (ADR-02); AR-07 granted | REL-* complete, TPM go-ahead |

---

## 2. Test catalogue

### 2.1 Environment checks (ENV): ✅ automated in `scripts/verify.mjs`
| ID | Check | Proves | Status |
|---|---|---|---|
| ENV-01 | Clean install from the lockfile (`npm ci`) | The exact pinned packages install, with checksums verified (ADR-13) | ✅ |
| ENV-02 | Security audit (`npm audit`) | No known vulnerabilities in our dependencies | ✅ |
| ENV-03 | Type check | No type errors in app code, tests or scripts | ✅ |
| ENV-04 | Production build | The web app and Worker build | ✅ |
| ENV-05 | Migrations apply to an empty database | The schema installs cleanly with Cloudflare's own tool | ✅ |
| ENV-06 | Automated test suite | All Vitest tests pass | ✅ |
| ENV-07 | Health check | The Worker runs and reaches the database | ✅ |
| ENV-08 | `/j/<code>` serves the app | Invite links open the app (FR-1.10) | ✅ |
| ENV-09 | Unknown API path → JSON 404 | No crashes or stray pages for bad paths | ✅ |
| ENV-10 | End-to-end browser tests (Playwright, phone and desktop) | Screens work in a real browser | ✅ |

### 2.2 Database schema (SMK, SCH, CLM): ✅ `test/schema/`
| ID | Test | Requirement | Status |
|---|---|---|---|
| SMK-01 | All 12 tables exist | DATA_SCHEMA §2 | ✅ |
| SCH-01 | Foreign keys enforced | DATA_SCHEMA §1 | ✅ |
| SCH-02 | Group code is exactly 8 characters | G2 | ✅ |
| SCH-03 | Group codes are unique | NFR-3 | ✅ |
| SCH-04 | Group name 60 characters at most | G1 | ✅ |
| SCH-05 | Display names unique in a group, ignoring case | Q12 | ✅ |
| SCH-06 | Same name allowed in different groups | Q12 | ✅ |
| SCH-07 | A removed member's name can be reused | G12 interim (B-013) | ✅ |
| SCH-08 | Display name 30 characters at most | G4 | ✅ |
| SCH-09 | Title 100 characters at most, not blank | G6 | ✅ |
| SCH-10 | Deleted item must record when it was deleted | FR-7.1 | ✅ |
| SCH-11 | Archived item must belong to an archive batch | FR-7.3 | ✅ |
| SCH-12 | Mode and visibility only accept glossary values | FR-3.1a, FR-3.2 | ✅ |
| SCH-13 | Link needs a URL or a description | FR-3.1a | ✅ |
| SCH-14 | 5 links at most per item | G8 | ✅ |
| SCH-15 | Price needs a currency and isn't negative | G16 | ✅ |
| SCH-16 | URLs must be http(s), so `javascript:` is rejected | Security | ✅ |
| SCH-17 | Permanent delete removes links, visibility and all claims | FR-7.2, G14 | ✅ |
| CLM-01 | Second live claim on an item is rejected | NFR-2 | ✅ |
| CLM-02 | A frozen (archived) claim also blocks a second claim | NFR-2, FR-7.3 | ✅ |
| CLM-03 | After release, someone else can claim | FR-5.4 | ✅ |
| CLM-04 | **5 simultaneous claims → exactly 1 succeeds** | NFR-2, success criterion 4 | ✅ |
| CLM-05 | Released claim must record when it was released | DATA_SCHEMA §3.8 | ✅ |

### 2.3 Identity and access (ID): ✅ `test/api/identity.test.ts`
| ID | Test | Requirement | Status |
|---|---|---|---|
| ID-01 | Join with a valid code → joined member, token cookie set | FR-1.3–1.5 | ✅ |
| ID-02 | Wrong or unknown code → the same generic error (doesn't reveal whether a group exists) | FR-1.10, NFR-3 | ✅ |
| ID-03 | Duplicate display name rejected with a clear message | Q12 | ✅ |
| ID-04 | Picking a pending name on first visit sets the PIN and joins | FR-2.2 | ✅ |
| ID-05 | Cookie is `HttpOnly`, `Secure` and `SameSite=Lax`; one cookie per group | Arch §6.1 | ✅ |
| ID-06 | Only the token's hash is stored; the raw token never appears in the database | NFR-4, ADR-05 | ✅ |
| ID-07 | Recovery with the correct PIN issues a new token; other devices stay signed in | FR-1.7 | ✅ |
| ID-08 | Wrong PIN increases the failure count | NFR-4 | ✅ |
| ID-09 | 5 wrong PINs → locked for 15 minutes, even with the correct PIN | NFR-4, G15 | ✅ |
| ID-10 | Lock expires after 15 minutes and the count resets on success | NFR-4 | ✅ |
| ID-11 | PIN must be 4–6 digits | FR-1.4 | ✅ |
| ID-12 | PIN stored as a salted HMAC with a pepper, never in plain text | ADR-05 | ✅ |
| ID-13a | 10 **failed** attempts from one IP in 15 minutes → blocked, even with a valid code | G15, NFR-3 | ✅ |
| ID-13b | More than 30 attempts on one group code in an hour → blocked | G15, NFR-3 | ✅ |
| ID-13c | Rate-limit keys store hashes, never IP addresses or codes | DATA_SCHEMA §3.11 | ✅ |
| ID-14 | `/j/` code accepted with or without the dash, in any case | FR-1.10 | ✅ |
| ID-15 | Group codes, PINs and tokens never appear in logs | Arch §6.9, §6.10 | ✅ |
| ID-16 | One browser in several groups: `/api/me` lists them all | FR-1.9 | ✅ |
| ID-17 | Removed member's tokens stop working | FR-2.3 | ✅ |
| ID-18 | Admin PIN reset signs the member out everywhere | G5 | ✅ |
| ID-19 | Requests that change data without the app's custom header are rejected (CSRF) | Arch §6.1 | ✅ |
| ID-20 | A pending member has no session until they set a PIN, so they can't act as a giver. The recipient and visibility parts are tested in ITM-06 and FS-05. | FR-5.8 | ✅ |
| ID-21 | Code lookup returns the group name and member names, with pending ones flagged; removed members and IDs aren't included | FR-1.7, FR-2.2 | ✅ |

### 2.4 Group requests (REQ): ✅ `test/api/groupRequests.test.ts`
| ID | Test | Requirement | Status |
|---|---|---|---|
| REQ-01 | Submit a request (group name, currency, name, PIN) → pending, request cookie set | FR-1.2 | ✅ |
| REQ-02 | Status check shows "waiting" while pending | FR-1.2 | ✅ |
| REQ-03 | Approve → group created, requester is the first joined member, browser moved in automatically | FR-1.2 | ✅ |
| REQ-04 | Decline → requester sees declined; no group created | FR-1.2 | ✅ |
| REQ-05 | Request rate limit: more than 5 per network per hour is blocked | NFR-3 | ✅ |
| REQ-01b | Request fields validated (group name, currency, name, PIN) | FR-1.2 | ✅ |
| REQ-06 | No request cookie → "no request" | FR-1.2 | ✅ |
| ID-22 | After an admin PIN reset, recovery reports that the new PIN was set | G25 | ✅ |
| CFG-01 | Without a proper PIN secret key, the API refuses to run (fails closed) | ADR-05 | ✅ |

### 2.5 Items and links (ITM): 🟡
| ID | Test | Requirement | Status |
|---|---|---|---|
| ITM-01 | Exact product: exactly 1 link, a URL or a description | FR-3.1a | 🟡 |
| ITM-02 | Giver's choice: 1–5 links; a 6th is rejected | FR-3.1a, G8 | 🟡 |
| ITM-03 | API validation matches database limits (G1–G17) with friendly errors | Glossary Part E | 🟡 |
| ITM-04 | Editing an item updates its "last changed" time (drives the updated flag) | FR-5.7 | 🟡 |
| ITM-05 | Star and unstar, any number of items | FR-3.5 | 🟡 |
| ITM-06 | "Specific members" only allows joined members other than the owner | FR-3.2, FR-5.8 | 🟡 |
| ITM-07 | Item left with no viewers is visible only to its owner, with a note | G13 interim (B-014) | 🟡 |
| ITM-08 | Only the owner can edit or delete an item | FR-3.3 | 🟡 |

### 2.6 What each viewer sees (VIS): 🟡 **critical: success criteria 5 and 6**
One test for each cell of glossary Part D, for each viewer role.

| ID | Test | Requirement | Status |
|---|---|---|---|
| VIS-01 | Owner never receives claim status, the claimer or purchased, for any item state | FR-3.4, NFR-5, SC-5 | 🟡 |
| VIS-02 | Hidden members never receive the item, and no placeholder or count either | FR-3.2, Q13, SC-6 | 🟡 |
| VIS-03 | Purchased is sent only to the claimer | FR-5.5, Q24 | 🟡 |
| VIS-04 | Other members see "Claimed by <name>" and greyed out | FR-5.2 | 🟡 |
| VIS-05 | Updated flag shows for the claimer after an edit, and clears once seen | FR-5.7 | 🟡 |
| VIS-06 | Soft-deleted views: owner sees Deleted with Restore; others see "Deleted by owner" | FR-7.1 | 🟡 |
| VIS-07 | Tombstone shown only to the claimer | FR-7.2 | 🟡 |
| VIS-08 | Archived views for owner, claimer and others | FR-7.3 | 🟡 |
| VIS-09 | Who an item is shared with is sent only to its owner | Glossary B5 | 🟡 |
| VIS-10 | **No response ever contains** `pin_hash`, `token_hash`, salts or other members' tokens. Scans every endpoint's output. | NFR-5 | 🟡 |

### 2.7 Claims through the API (CLM): 🟡
| ID | Test | Requirement | Status |
|---|---|---|---|
| CLM-06 | Claim an available item → appears on my Claimed list | FR-5.1, FR-5.3 | 🟡 |
| CLM-07 | Can't claim your own item | FR-5 | 🟡 |
| CLM-08 | Claiming a hidden item → 404, so its existence isn't revealed | FR-3.2 | 🟡 |
| CLM-09 | Can't claim deleted or archived items | FR-7.1, FR-7.3 | 🟡 |
| CLM-10 | Unclaim → item available again | FR-5.4 | 🟡 |
| CLM-11 | Mark purchased, then unmark | FR-5.5 | 🟡 |
| CLM-12 | Claimed list sorted by recipient name | FR-5.3 | 🟡 |
| CLM-13 | Simultaneous claims through the API → one succeeds, the other gets a friendly "already claimed" | NFR-2 | 🟡 |

### 2.8 Fair share (FS): 🟡 initial logic, tuned in PR-003
| ID | Test | Requirement | Status |
|---|---|---|---|
| FS-01 | Rule (a): warning when available items < waiting givers × buffer, using the brief's Sam/Alex example | FR-6.3 | 🟡 |
| FS-02 | Rule (b): warning when a waiting giver has no visible available item | FR-6.3 | 🟡 |
| FS-03 | Warning shown on **every** claim that breaches, not just the first | FR-6.4, Q29 | 🟡 |
| FS-04 | "Claim anyway" proceeds and records the override | FR-6.4 | 🟡 |
| FS-05 | Pending members aren't counted | FR-6.1, Q28 | 🟡 |
| FS-06 | Nudge on the Claimed list appears and clears as conditions change | FR-6.5 | 🟡 |
| FS-07 | The recipient never receives fair-share information | FR-6.6 | 🟡 |
| FS-08 | The per-group buffer setting is respected | G3 | 🟡 |

### 2.9 Delete, archive and restore (LIF): 🟡
| ID | Test | Requirement | Status |
|---|---|---|---|
| LIF-01 | Soft delete → Deleted section; claim kept | FR-7.1 | 🟡 |
| LIF-02 | Restore within 90 days → active, claim intact | FR-7.1 | 🟡 |
| LIF-03 | Owner's permanent delete → gone for everyone; claimer gets a tombstone | FR-7.2 | 🟡 |
| LIF-04 | Nightly job purges items deleted more than 90 days ago (simulated clock) | NFR-10, SC-8 | 🟡 |
| LIF-05 | Nightly job run twice → no extra effect | NFR-10 | 🟡 |
| LIF-06 | Nightly job skips archived items | FR-7.3 | 🟡 |
| LIF-07 | Archive is all-or-nothing: a failure part-way changes nothing | NFR-11 | 🟡 |
| LIF-08 | **Archive then restore → every item and claim exactly as before** | FR-7.4, SC-9 | 🟡 |
| LIF-09 | Deleted items keep their remaining days through archive and restore | FR-7.3 | 🟡 |
| LIF-10 | Re-add an archived item → new, unclaimed copy | FR-7.3, Q30 | 🟡 |
| LIF-11 | Restore after a re-add keeps both copies | FR-7.4 | 🟡 |
| LIF-12 | Removing a member: items deleted (with tombstones for others' claims), claims released, tokens revoked | FR-2.3 | 🟡 |

### 2.10 Admin (ADM): 🟡
| ID | Test | Requirement | Status |
|---|---|---|---|
| ADM-01 | Admin endpoints reject requests without a valid Cloudflare Access token | ADR-04, NFR-7 | 🟡 |
| ADM-02 | Valid Access token accepted (signature, audience and expiry checked) | ADR-04 | 🟡 |
| ADM-03 | Create a group → code generated in the right format | FR-2.1, G2 | 🟡 |
| ADM-04 | Add a pending member | FR-2.2 | 🟡 |
| ADM-05 | Remove a member (see LIF-12) | FR-2.3 | 🟡 |
| ADM-06 | Reset a PIN (see ID-18) | FR-2.6 | 🟡 |
| ADM-07 | Approve or decline group requests (see REQ-03, REQ-04) | FR-2.4 | 🟡 |
| ADM-08 | Archive and restore (see LIF-07–LIF-09) | FR-2.8 | 🟡 |
| ADM-09 | Change a group's fair-share buffer | G3 | 🟡 |

### 2.11 Dashboard (DSH): 🟡
| ID | Test | Requirement | Status |
|---|---|---|---|
| DSH-01 | Dashboard lists other members' visible items, grouped by member | FR-4.1 | 🟡 |
| DSH-02 | Group version increases on every change | FR-4.3 | 🟡 |
| DSH-03 | Version check reads a single row (CPU and row budget) | ADR-07 | 🟡 |

### 2.12 Auto-fill (AF): 🟡 PR-002
| ID | Test | Requirement | Status |
|---|---|---|---|
| AF-01 | Extract name, price, currency and image from Open Graph tags (saved sample page) | FR-3.1b | 🟡 |
| AF-02 | Extract from schema.org Product/Offer JSON-LD (saved sample page) | FR-3.1b | 🟡 |
| AF-03 | Blocked: non-https, IP-address hosts, our own host, `http://` links | ADR-08, G17 | 🟡 |
| AF-04 | 5 s timeout, 2 MB cap, at most 3 redirects | ADR-08 | 🟡 |
| AF-05 | Fields the owner edited are never overwritten | FR-3.1b | 🟡 |
| AF-06 | Auto-fill failure → the item still saves and the status shows `failed` | FR-3.1b | 🟡 |
| AF-07 | Real retailer sample: success rate by category | PR-002 | 🔒 AR-03 |

### 2.12a Screens, Section 1: Getting in (UI): ✅ `test/e2e/getting-in.spec.ts`, `test/ui/copy.test.ts`
Runs on a phone (Pixel 7) and, for tests tagged `@desktop`, also desktop Chrome, against a throwaway local database.

| ID | Test | Requirement | Status |
|---|---|---|---|
| UI-01 | Home: a valid code opens Join with the group name (phone + desktop) | T-02 | ✅ |
| UI-02 | Home: invalid code → error, focus kept on the box (phone + desktop) | T-02 | ✅ |
| UI-03 | `/j/<code>` opens Join; an already-joined browser goes straight in | T-01, FR-1.10 | ✅ |
| UI-04 | Join as a new person → inside the group with the welcome message, in under 2 minutes (phone + desktop) | T-03, SC-2 | ✅ |
| UI-05 | Tap a pre-added name → joins as that person | T-04 | ✅ |
| UI-06 | Name taken → error with a working "Sign back in" link | T-03, T-05 | ✅ |
| UI-07 | PINs that don't match are caught before sending (confirmed by a deliberate break) | G24 | ✅ |
| UI-08 | Sign back in on a second browser | T-05, SC-3 | ✅ |
| UI-09 | Wrong-PIN message; the 5th wrong PIN shows the locked alert and disables Sign in | T-05, S-02 | ✅ |
| UI-10 | Request a group → waiting (also after coming back) → approved → moved in | T-06, T-07 | ✅ |
| UI-11 | Declined → message → "Send a new request" | T-08 | ✅ |
| UI-12 | 360 px wide: no sideways scrolling on any Section 1 screen (found BUG-003) | NFR-1 | ✅ |
| UI-13 | **Every C- wording ID in UI_INTERACTION_MAPS.md matches `copy.ts` exactly, both ways** | Doc and UI stay in sync | ✅ |
| UI-14 | Keyboard only: Tab and Enter complete the join; errors are announced | Accessibility | ✅ |

**Review screenshots:** `npm run screens` regenerates `docs/screens/section-1/*.png` (18 screens and states, light and dark).

### 2.13 End-to-end in a browser (E2E): 🟡 Playwright, phone and desktop sizes
| ID | Journey | Status |
|---|---|---|
| E2E-01 | Open an invite link on a phone → join → add the first item in under 2 minutes (SC-2) | 🟡 |
| E2E-02 | Add Exact product and Giver's choice items with links | 🟡 |
| E2E-03 | Claim an item → greyed out for a third member, invisible to the owner | 🟡 |
| E2E-04 | Recover identity in a second browser with name and PIN (SC-3) | 🟡 |
| E2E-05 | Group request → admin approves → requester moved in automatically | 🟡 |
| E2E-06 | Fair-share warning appears and "Claim anyway" works | 🟡 |
| E2E-07 | Admin archive and restore | 🟡 |
| E2E-08 | No sideways scrolling at 360 px phone width (NFR-1) | 🟡 |

### 2.14 Scenario suites
| Suite | Scenarios | Where defined | Status |
|---|---|---|---|
| PR-001 | Partial claims, scenarios 1–5 | PR_TRACKER.md | 🟡 (feature not in v1) |
| PR-002 | Auto-fill experiment, scenarios 1–4 | PR_TRACKER.md | 🟡 / 🔒 AR-03 |
| PR-003 | Fair-share tuning, scenarios 1–8 | PR_TRACKER.md | 🟡 |

### 2.15 Cloudflare dev environment (DEV): 🔒 AR-01
| ID | Test | Status |
|---|---|---|
| DEV-01 | Migrations apply to the remote dev D1 | 🔒 |
| DEV-02 | Foreign keys enforced on real D1 (repeat of SCH-01) | 🔒 |
| DEV-03 | Health check, `/j/` and 404 on `*.workers.dev` (repeat of ENV-07–09) | 🔒 |
| DEV-04 | Admin area blocked without Cloudflare Access | 🔒 AR-04 |
| DEV-05 | E2E-01 to E2E-08 against dev | 🔒 |
| DEV-06 | CPU time per request under the Free plan's 10 ms (except auto-fill) | 🔒 |
| DEV-07 | Nightly job runs on schedule | 🔒 |

### 2.16 User acceptance (UAT): TPM, on dev
A checklist will be published before the dev deploy. It covers each success criterion (brief §9) step by step, on your own phone and laptop.

### 2.17 Release gate (REL): before prod
| ID | Item |
|---|---|
| REL-01 | All automated tests pass; `npm audit` clean |
| REL-02 | UAT signed off by TPM |
| REL-03 | Cloudflare account upgraded to Workers Paid (ADR-02) |
| REL-04 | Prod secrets set (separate `PIN_PEPPER`); Access configured |
| REL-05 | Database export taken; restore procedure tested on dev |
| REL-06 | Prod deploy go-ahead from TPM (AR-07) |

---

## 3. Requirements coverage

Every requirement must map to at least one test before v1 ships.

| Requirement | Tests |
|---|---|
| FR-1 Groups and access | ID-01–ID-21, REQ-01–05, ENV-08, SCH-02–08 |
| FR-2 Admin | ADM-01–09, LIF-12, REQ-03–04 |
| FR-3 My list | ITM-01–08, SCH-09–16, AF-01–07 |
| FR-4 Dashboard | DSH-01–03, VIS-01–10 |
| FR-5 Claiming | CLM-01–13, VIS-03–05 |
| FR-6 Fair share | FS-01–08, PR-003 |
| FR-7 Delete, archive, restore | LIF-01–12, SCH-10–11, SCH-17, VIS-06–08 |
| NFR-1 Mobile | E2E-08 |
| NFR-2 Atomic claims | CLM-01–05, CLM-13 |
| NFR-3 Code protection | SCH-03, ID-02, ID-13a–c, ID-14 |
| NFR-4 PIN security | ID-06–12 |
| NFR-5 Server enforcement | VIS-01–10 |
| NFR-6 Minimal personal data | VIS-10, ID-15 |
| NFR-7 Admin credential | ADM-01–02, DEV-04 |
| NFR-8 Environments | ENV-*, DEV-*, REL-* |
| NFR-9 Advisory fair share | FS-01–04, PR-003 scenario 8 |
| NFR-10 Nightly job | LIF-04–06, DEV-07 |
| NFR-11 All-or-nothing archive | LIF-07–08 |

### Success criteria (brief §9) → tests
| # | Criterion | Tests |
|---|---|---|
| 1 | Admin creates a group in under 1 minute | ADM-03, UAT |
| 2 | Join and add first item in under 2 minutes | E2E-01, UAT |
| 3 | Recover identity on a second device | **ID-07 ✅**, E2E-04 |
| 4 | No double claims, even when simultaneous | **CLM-04 ✅**, CLM-13 |
| 5 | Owner never receives claim info | VIS-01, E2E-03 |
| 6 | Hidden items never sent to excluded members | VIS-02, CLM-08 |
| 7 | Fair-share warning always shown on breach | FS-01–03 |
| 8 | 90-day restore and purge with tombstones | LIF-01–06 |
| 9 | Archive then restore returns the exact prior state | LIF-08 |
| 10 | Dev/test pass and TPM review before prod | REL-01–06 |

---

## 4. Progress summary

| Area | Total | ✅ Passing | 🟡 Planned | 🔒 Blocked |
|---|---|---|---|---|
| ENV | 10 | 10 | 0 | 0 |
| Schema (SMK/SCH/CLM-01–05) | 23 | 23 | 0 | 0 |
| ID (identity) + CFG | 25 | 25 | 0 | 0 |
| REQ (group requests) | 7 | 7 | 0 | 0 |
| UI, Section 1 | 14 | 14 | 0 | 0 |
| ITM / VIS / CLM-API / FS / LIF / ADM / DSH | 58 | 0 | 58 | 0 |
| AF | 7 | 0 | 6 | 1 |
| E2E | 8 | 0 | 8 | 0 |
| DEV | 7 | 0 | 0 | 7 |
| **Total automated** | **159** | **79** | **72** | **8** |

*This table is updated by hand whenever tests move between states. Per-run results come from TEST_RESULTS.md.*
