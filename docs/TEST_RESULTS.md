# Test Results

Generated automatically by `npm run verify` (`scripts/verify.mjs`). **Don't edit by hand.** What each test means is described in [TEST_PLAN.md](TEST_PLAN.md).

## Latest run

| | |
|---|---|
| **Result** | ✅ **PASS**: stable baseline |
| **When** | 2026-11-21 18:31 UTC |
| **Code version** | `192cf10` |
| **Environment** | Node v22.23.5, local (this container), no Cloudflare account used |
| **Environment checks** | 10 of 10 passed |
| **Automated tests** | 81 of 81 passed |

### Environment checks
| ID | Check | Result | Detail |
|---|---|---|---|
| ENV-01 | Clean install from lockfile (npm ci) | ✅ | 200 packages installed |
| ENV-02 | Security audit (npm audit) | ✅ | 0 vulnerabilities |
| ENV-03 | Type check (src, tests, scripts) | ✅ | no type errors |
| ENV-04 | Production build | ✅ | web app + Worker built |
| ENV-05 | Migrations apply to an empty database | ✅ | 25 SQL statements applied |
| ENV-06 | Automated test suite (Vitest) | ✅ | 60/60 tests passed |
| ENV-07 | API health check reaches the database | ✅ | {"ok":true,"env":"local"} |
| ENV-08 | Invite path /j/<code> serves the app (FR-1.10) | ✅ | HTTP 200 |
| ENV-09 | Unknown API path returns a JSON 404 | ✅ | HTTP 404 {"error":"not_found","message":"Not found."} |
| ENV-10 | End-to-end browser tests (Playwright) | ✅ | 21/21 browser tests passed |

### Automated tests
| ID | Test | Area | Result | Time |
|---|---|---|---|---|
| REQ-01 | submitting a request stores it as pending and sets a request cookie | test/api/groupRequests.test.ts | ✅ | 58 ms |
| — | [REQ-01b] request fields are validated | test/api/groupRequests.test.ts | ✅ | 9 ms |
| REQ-07 | a hint given with a request carries over to the new member when approved | test/api/groupRequests.test.ts | ✅ | 100 ms |
| REQ-02 | while pending, the status check says pending | test/api/groupRequests.test.ts | ✅ | 36 ms |
| REQ-03 | approval creates the group with the requester as first member and moves the browser in | test/api/groupRequests.test.ts | ✅ | 214 ms |
| REQ-04 | a declined request reports declined and creates no group | test/api/groupRequests.test.ts | ✅ | 50 ms |
| REQ-05 | more than 5 requests from one network in an hour are blocked | test/api/groupRequests.test.ts | ✅ | 148 ms |
| REQ-06 | no request cookie → 404 no_request | test/api/groupRequests.test.ts | ✅ | 1 ms |
| ID-22 | after an admin PIN reset, recovery reports pinWasReset (G25) | test/api/groupRequests.test.ts | ✅ | 255 ms |
| CFG-01 | without a proper PIN pepper the API refuses to run (fails closed) | test/api/groupRequests.test.ts | ✅ | 12 ms |
| ID-01 | join with a valid code creates a joined member and sets a cookie | joining | ✅ | 121 ms |
| ID-02 | unknown and malformed codes give the same generic error | joining | ✅ | 76 ms |
| ID-03 | a display name already in use is rejected with a helpful message | joining | ✅ | 133 ms |
| ID-04 | picking a pending name on first visit sets the PIN and joins | joining | ✅ | 169 ms |
| ID-05 | the member cookie is HttpOnly, Secure, SameSite=Lax, one per group | joining | ✅ | 91 ms |
| ID-06 | only the token's hash is stored; the raw token is not in the database | joining | ✅ | 124 ms |
| ID-11 | PIN must be exactly 4 numbers (TPM UI review round 1) | joining | ✅ | 103 ms |
| ID-23 | optional PIN hint: saved, max 40 characters, can't contain the PIN (G29) | joining | ✅ | 218 ms |
| ID-24 | the hint endpoint returns a joined member's hint only; lookup never includes hints | joining | ✅ | 371 ms |
| ID-25 | an admin PIN reset also clears the hint | joining | ✅ | 138 ms |
| ID-12 | PINs are stored as salted HMACs with the pepper, never as plain text | joining | ✅ | 199 ms |
| ID-14 | codes work with or without the dash, in any case | joining | ✅ | 168 ms |
| ID-20 | a pending member has no session until they set a PIN | joining | ✅ | 86 ms |
| ID-21 | lookup shows the group name and member names (pending flagged), not removed members | joining | ✅ | 142 ms |
| ID-07 | correct PIN on a new browser issues a new token; the old device stays signed in | recovery | ✅ | 213 ms |
| ID-08 | a wrong PIN is rejected and counted | recovery | ✅ | 162 ms |
| ID-09 | 5 wrong PINs lock the name for 15 minutes, even against the correct PIN | recovery | ✅ | 450 ms |
| ID-10 | after the lock expires the correct PIN works and the count resets | recovery | ✅ | 153 ms |
| ID-18 | an admin PIN reset signs the member out everywhere; their next PIN becomes the new one | recovery | ✅ | 257 ms |
| ID-16 | one browser in several groups: /api/me lists them all | sessions | ✅ | 208 ms |
| ID-17 | a removed member's tokens stop working | sessions | ✅ | 97 ms |
| ID-19 | data-changing requests without the app header, or from another site, are blocked | sessions | ✅ | 19 ms |
| — | [ID-13a] 10 failed attempts from one IP in 15 minutes → further attempts blocked | rate limits and logging | ✅ | 434 ms |
| — | [ID-13b] more than 30 attempts on one code in an hour → blocked | rate limits and logging | ✅ | 1142 ms |
| — | [ID-13c] rate-limit keys don't store IP addresses or codes in plain text | rate limits and logging | ✅ | 7 ms |
| ID-15 | codes, PINs and tokens never appear in logs | rate limits and logging | ✅ | 149 ms |
| SCH-01 | are enforced (a member must belong to a real group) | foreign keys | ✅ | 16 ms |
| SCH-02 | group code must be exactly 8 characters (G2) | groups | ✅ | 12 ms |
| SCH-03 | group codes are unique | groups | ✅ | 26 ms |
| SCH-04 | group name max 60 characters (G1) | groups | ✅ | 27 ms |
| SCH-05 | display names are unique in a group, ignoring case (Q12) | members | ✅ | 32 ms |
| SCH-06 | the same name is fine in a different group | members | ✅ | 43 ms |
| SCH-07 | a removed member's name can be reused (G12 interim) | members | ✅ | 32 ms |
| SCH-08 | display name max 30 characters (G4) | members | ✅ | 20 ms |
| SCH-09 | title max 100 characters (G6) and must not be blank | items | ✅ | 66 ms |
| SCH-10 | deleted items must record when they were deleted | items | ✅ | 47 ms |
| SCH-11 | archived items must belong to an archive batch | items | ✅ | 38 ms |
| SCH-12 | mode and visibility only accept the glossary values | items | ✅ | 46 ms |
| SCH-13 | need a URL or a description | product links | ✅ | 62 ms |
| SCH-14 | at most 5 positions per item (G8) | product links | ✅ | 114 ms |
| SCH-15 | a price needs a currency, and is a whole non-negative number (G16) | product links | ✅ | 70 ms |
| SCH-16 | URLs must look like http(s) links | product links | ✅ | 44 ms |
| CLM-01 | a second live claim on the same item is rejected | claims (NFR-2: at most one live claim per item) | ✅ | 75 ms |
| CLM-02 | a frozen claim (archived item) also blocks a second claim | claims (NFR-2: at most one live claim per item) | ✅ | 81 ms |
| CLM-03 | after a claim is released, someone else can claim | claims (NFR-2: at most one live claim per item) | ✅ | 96 ms |
| CLM-04 | simultaneous claims: exactly one succeeds | claims (NFR-2: at most one live claim per item) | ✅ | 151 ms |
| CLM-05 | a released claim must record when it was released | claims (NFR-2: at most one live claim per item) | ✅ | 67 ms |
| SCH-17 | deleting an item removes its links, visibility rows and all claims | permanent delete (FR-7.2, G14) | ✅ | 164 ms |
| SMK-01 | all 12 tables exist | test/schema/smoke.test.ts | ✅ | 11 ms |
| UI-13 | every C- ID in the interaction maps exists in copy.ts with the same text, and vice versa | test/ui/copy.test.ts | ✅ | 3 ms |
| UI-01 | Home: a valid code opens the Join screen with the group name | browser (phone) | ✅ | 2641 ms |
| UI-02 | Home: an invalid code shows the error and keeps focus on the box | browser (phone) | ✅ | 1138 ms |
| UI-03 | /j/<code> opens Join directly; an already-joined browser goes straight in | browser (phone) | ✅ | 2508 ms |
| UI-04 | Joining as a new person lands inside the group with a welcome message | browser (phone) | ✅ | 2028 ms |
| UI-05 | Choosing a pre-added name in the dropdown joins as that person | browser (phone) | ✅ | 2396 ms |
| UI-06 | Name taken shows the error with a working 'Sign back in' link | browser (phone) | ✅ | 2791 ms |
| UI-07 | PINs that don't match are caught before sending | browser (phone) | ✅ | 1966 ms |
| UI-08 | Sign back in on a second browser | browser (phone) | ✅ | 2710 ms |
| UI-09 | Wrong PIN message; the 5th wrong PIN shows the locked alert | browser (phone) | ✅ | 3420 ms |
| UI-10 | Request a group → waiting → approved → moved in automatically | browser (phone) | ✅ | 3161 ms |
| UI-11 | Declined request → message → 'Send a new request' | browser (phone) | ✅ | 2929 ms |
| UI-12 | 360 px wide: no sideways scrolling on any Section 1 screen | browser (phone) | ✅ | 4785 ms |
| UI-14 | Keyboard only: join with Tab and Enter; errors are announced | browser (phone) | ✅ | 2027 ms |
| UI-15 | The dropdown lists only people who haven't signed in yet | browser (phone) | ✅ | 4761 ms |
| UI-16 | PIN boxes: exactly 4, numbers visible as typed | browser (phone) | ✅ | 1791 ms |
| UI-17 | PIN hint: can't contain the PIN; shown on request when signing back in | browser (phone) | ✅ | 3934 ms |
| UI-18 | Home has no heading, intro or card title (review round 1) | browser (phone) | ✅ | 905 ms |
| UI-01 | Home: a valid code opens the Join screen with the group name | browser (desktop) | ✅ | 1625 ms |
| UI-02 | Home: an invalid code shows the error and keeps focus on the box | browser (desktop) | ✅ | 978 ms |
| UI-04 | Joining as a new person lands inside the group with a welcome message | browser (desktop) | ✅ | 1364 ms |
| UI-18 | Home has no heading, intro or card title (review round 1) | browser (desktop) | ✅ | 941 ms |

## Run history (newest first)
<!-- history:start -->
| When | Code version | Result | Env checks | Tests |
|---|---|---|---|---|
| 2026-11-21 18:31 UTC | `192cf10` | ✅ PASS | 10/10 | 81/81 |
| 2026-11-21 18:23 UTC | `29c8de0` | ✅ PASS | 10/10 | 81/81 |
| 2026-11-21 18:02 UTC | `d4e8113` | ✅ PASS | 10/10 | 72/72 |
| 2026-11-21 17:24 UTC | `72aee5b` | ✅ PASS | 9/9 | 46/46 |
| 2026-11-21 17:06 UTC | `7a10a5d` | ✅ PASS | 9/9 | 23/23 |
| 2026-11-21 17:04 UTC | `d4234dc` + uncommitted changes | ✅ PASS | 9/9 | 23/23 |
<!-- history:end -->
