# Test Results

Generated automatically by `npm run verify` (`scripts/verify.mjs`). **Don't edit by hand.** What each test means is described in [TEST_PLAN.md](TEST_PLAN.md).

## Latest run

| | |
|---|---|
| **Result** | ✅ **PASS**: stable baseline |
| **When** | 2026-11-21 23:53 UTC |
| **Code version** | `8b62977` (plus uncommitted changes) |
| **Environment** | Node v22.23.5, local (this container), no Cloudflare account used |
| **Environment checks** | 11 of 11 passed |
| **Automated tests** | 118 of 118 passed |

### Environment checks
| ID | Check | Result | Detail |
|---|---|---|---|
| ENV-01 | Clean install from lockfile (npm ci) | ✅ | 200 packages installed |
| ENV-02 | Security audit (npm audit) | ✅ | 0 vulnerabilities |
| ENV-03 | Type check (src, tests, scripts) | ✅ | no type errors |
| ENV-04 | Production build | ✅ | web app + Worker built |
| ENV-05 | Migrations apply to an empty database | ✅ | 25 SQL statements applied |
| ENV-06 | Automated test suite (Vitest) | ✅ | 76/76 tests passed |
| ENV-07 | API health check reaches the database | ✅ | {"ok":true,"env":"local"} |
| ENV-08 | Invite path /j/<code> serves the app (FR-1.10) | ✅ | HTTP 200 |
| ENV-09 | Unknown API path returns a JSON 404 | ✅ | HTTP 404 {"error":"not_found","message":"Not found."} |
| ENV-10 | End-to-end browser tests (Playwright) | ✅ | 27/27 browser tests passed |
| ENV-11 | Prototype builds and every scenario walks as described | ✅ | 15/15 scenario walkthroughs passed |

### Automated tests
| ID | Test | Area | Result | Time |
|---|---|---|---|---|
| ADM-01 | admin endpoints need the right key, and are switched off when no key is configured | test/api/admin.test.ts | ✅ | 176 ms |
| ADM-02 | repeated wrong keys from one network are rate-limited | test/api/admin.test.ts | ✅ | 315 ms |
| ADM-03 | group.create makes a group with a code in the right format and an invite link | test/api/admin.test.ts | ✅ | 213 ms |
| ADM-04 | member.add adds people as not joined yet; duplicate names are refused at plan time | test/api/admin.test.ts | ✅ | 534 ms |
| ADM-05 | member.remove deletes their items, releases their claims, leaves notes for claimers and signs them out | test/api/admin.test.ts | ✅ | 758 ms |
| ADM-06 | member.resetPin signs them out, clears the hint and lifts a lock; not for people who haven't joined | test/api/admin.test.ts | ✅ | 380 ms |
| ADM-07 | request.approve and request.decline; the expect guard stops acting on the wrong request | test/api/admin.test.ts | ✅ | 471 ms |
| ADM-09 | group.setFairShare changes the buffer within 0.5 to 3 | test/api/admin.test.ts | ✅ | 306 ms |
| ADM-10 | planning writes nothing except the stored plan | test/api/admin.test.ts | ✅ | 356 ms |
| ADM-11 | apply is all or nothing: if the state changed after the checks, the whole batch rolls back | test/api/admin.test.ts | ✅ | 401 ms |
| ADM-12 | a plan is refused if anything changed since it was reviewed | test/api/admin.test.ts | ✅ | 572 ms |
| ADM-13 | the same change set is applied only once; repeating apply returns the first result | test/api/admin.test.ts | ✅ | 399 ms |
| ADM-14 | the audit log records each change set, without codes, PINs, hints or the key | test/api/admin.test.ts | ✅ | 188 ms |
| ADM-15 | reading: requests, groups and one group's people with their states | test/api/admin.test.ts | ✅ | 151 ms |
| ADM-16 | change sets are checked strictly: version, IDs, unknown ops or fields, references and limits | test/api/admin.test.ts | ✅ | 233 ms |
| ADM-17 | plans expire after 24 hours | test/api/admin.test.ts | ✅ | 142 ms |
| REQ-01 | submitting a request stores it as pending and sets a request cookie | test/api/groupRequests.test.ts | ✅ | 58 ms |
| — | [REQ-01b] request fields are validated | test/api/groupRequests.test.ts | ✅ | 9 ms |
| REQ-07 | a hint given with a request carries over to the new member when approved | test/api/groupRequests.test.ts | ✅ | 108 ms |
| REQ-02 | while pending, the status check says pending | test/api/groupRequests.test.ts | ✅ | 36 ms |
| REQ-03 | approval creates the group with the requester as first member and moves the browser in | test/api/groupRequests.test.ts | ✅ | 265 ms |
| REQ-04 | a declined request reports declined and creates no group | test/api/groupRequests.test.ts | ✅ | 75 ms |
| REQ-05 | more than 5 requests from one network in an hour are blocked | test/api/groupRequests.test.ts | ✅ | 169 ms |
| REQ-06 | no request cookie → 404 no_request | test/api/groupRequests.test.ts | ✅ | 5 ms |
| ID-22 | after an admin PIN reset, recovery reports pinWasReset (G25) | test/api/groupRequests.test.ts | ✅ | 366 ms |
| CFG-01 | without a proper PIN pepper the API refuses to run (fails closed) | test/api/groupRequests.test.ts | ✅ | 9 ms |
| ID-01 | join with a valid code creates a joined member and sets a cookie | joining | ✅ | 122 ms |
| ID-02 | unknown and malformed codes give the same generic error | joining | ✅ | 75 ms |
| ID-03 | a display name already in use is rejected with a helpful message | joining | ✅ | 189 ms |
| ID-04 | picking a pending name on first visit sets the PIN and joins | joining | ✅ | 205 ms |
| ID-05 | the member cookie is HttpOnly, Secure, SameSite=Lax, one per group | joining | ✅ | 98 ms |
| ID-06 | only the token's hash is stored; the raw token is not in the database | joining | ✅ | 122 ms |
| ID-11 | PIN must be exactly 4 numbers (TPM UI review round 1) | joining | ✅ | 135 ms |
| ID-23 | optional PIN hint: saved, max 40 characters, can't contain the PIN (G29) | joining | ✅ | 245 ms |
| ID-24 | the hint endpoint returns a joined member's hint only; lookup never includes hints | joining | ✅ | 377 ms |
| ID-25 | an admin PIN reset also clears the hint | joining | ✅ | 148 ms |
| ID-12 | PINs are stored as salted HMACs with the pepper, never as plain text | joining | ✅ | 214 ms |
| ID-14 | codes work with or without the dash, in any case | joining | ✅ | 191 ms |
| ID-20 | a pending member has no session until they set a PIN | joining | ✅ | 89 ms |
| ID-21 | lookup shows the group name and member names (pending flagged), not removed members | joining | ✅ | 172 ms |
| ID-07 | correct PIN on a new browser issues a new token; the old device stays signed in | recovery | ✅ | 275 ms |
| ID-08 | a wrong PIN is rejected and counted | recovery | ✅ | 216 ms |
| ID-09 | 5 wrong PINs lock the name for 15 minutes, even against the correct PIN | recovery | ✅ | 564 ms |
| ID-10 | after the lock expires the correct PIN works and the count resets | recovery | ✅ | 197 ms |
| ID-18 | an admin PIN reset signs the member out everywhere; their next PIN becomes the new one | recovery | ✅ | 273 ms |
| ID-16 | one browser in several groups: /api/me lists them all | sessions | ✅ | 228 ms |
| ID-17 | a removed member's tokens stop working | sessions | ✅ | 134 ms |
| ID-19 | data-changing requests without the app header, or from another site, are blocked | sessions | ✅ | 31 ms |
| — | [ID-13a] 10 failed attempts from one IP in 15 minutes → further attempts blocked | rate limits and logging | ✅ | 607 ms |
| — | [ID-13b] more than 30 attempts on one code in an hour → blocked | rate limits and logging | ✅ | 1568 ms |
| — | [ID-13c] rate-limit keys don't store IP addresses or codes in plain text | rate limits and logging | ✅ | 10 ms |
| ID-15 | codes, PINs and tokens never appear in logs | rate limits and logging | ✅ | 181 ms |
| SCH-01 | are enforced (a member must belong to a real group) | foreign keys | ✅ | 16 ms |
| SCH-02 | group code must be exactly 8 characters (G2) | groups | ✅ | 13 ms |
| SCH-03 | group codes are unique | groups | ✅ | 32 ms |
| SCH-04 | group name max 60 characters (G1) | groups | ✅ | 25 ms |
| SCH-05 | display names are unique in a group, ignoring case (Q12) | members | ✅ | 39 ms |
| SCH-06 | the same name is fine in a different group | members | ✅ | 45 ms |
| SCH-07 | a removed member's name can be reused (G12 interim) | members | ✅ | 37 ms |
| SCH-08 | display name max 30 characters (G4) | members | ✅ | 20 ms |
| SCH-09 | title max 100 characters (G6) and must not be blank | items | ✅ | 75 ms |
| SCH-10 | deleted items must record when they were deleted | items | ✅ | 54 ms |
| SCH-11 | archived items must belong to an archive batch | items | ✅ | 37 ms |
| SCH-12 | mode and visibility only accept the glossary values | items | ✅ | 55 ms |
| SCH-13 | need a URL or a description | product links | ✅ | 83 ms |
| SCH-14 | at most 5 positions per item (G8) | product links | ✅ | 139 ms |
| SCH-15 | a price needs a currency, and is a whole non-negative number (G16) | product links | ✅ | 72 ms |
| SCH-16 | URLs must look like http(s) links | product links | ✅ | 56 ms |
| CLM-01 | a second live claim on the same item is rejected | claims (NFR-2: at most one live claim per item) | ✅ | 103 ms |
| CLM-02 | a frozen claim (archived item) also blocks a second claim | claims (NFR-2: at most one live claim per item) | ✅ | 89 ms |
| CLM-03 | after a claim is released, someone else can claim | claims (NFR-2: at most one live claim per item) | ✅ | 115 ms |
| CLM-04 | simultaneous claims: exactly one succeeds | claims (NFR-2: at most one live claim per item) | ✅ | 163 ms |
| CLM-05 | a released claim must record when it was released | claims (NFR-2: at most one live claim per item) | ✅ | 65 ms |
| SCH-17 | deleting an item removes its links, visibility rows and all claims | permanent delete (FR-7.2, G14) | ✅ | 210 ms |
| SMK-01 | all 13 tables exist | test/schema/smoke.test.ts | ✅ | 12 ms |
| UI-13 | every C- ID in the interaction maps exists in copy.ts with the same text, and vice versa | test/ui/copy.test.ts | ✅ | 3 ms |
| UI-01 | Home: a valid code opens the Join screen with the group name | browser (phone) | ✅ | 2391 ms |
| UI-02 | Home: an invalid code shows the error and keeps focus on the box | browser (phone) | ✅ | 1227 ms |
| UI-03 | /j/<code> opens Join directly; an already-joined browser goes straight in | browser (phone) | ✅ | 2844 ms |
| UI-04 | Joining as a new person lands inside the group with a welcome message | browser (phone) | ✅ | 2318 ms |
| UI-05 | Choosing a pre-added name in the dropdown joins as that person | browser (phone) | ✅ | 2339 ms |
| UI-06 | A new person typing a name already in the group is asked "Is that you?"; Yes leads to their PIN | browser (phone) | ✅ | 2764 ms |
| UI-07 | PINs that don't match are caught before sending | browser (phone) | ✅ | 2152 ms |
| UI-08 | Sign back in on a second browser by choosing your own name | browser (phone) | ✅ | 2738 ms |
| UI-09 | Wrong PIN shows the message and two help buttons; the 5th wrong PIN locks the name | browser (phone) | ✅ | 3379 ms |
| UI-10 | Request a group → waiting → approved → moved in automatically | browser (phone) | ✅ | 3185 ms |
| UI-11 | Declined request → message → 'Send a new request' | browser (phone) | ✅ | 2730 ms |
| UI-12 | 360 px wide: no sideways scrolling on any Section 1 screen | browser (phone) | ✅ | 4812 ms |
| UI-14 | Keyboard only: join with Tab and Enter; errors are announced | browser (phone) | ✅ | 2237 ms |
| UI-15 | The dropdown lists everyone in the group; joined names lead to Enter your PIN, added names to Create a PIN (round 3) | browser (phone) | ✅ | 4300 ms |
| UI-16 | PIN boxes: exactly 4, numbers visible as typed | browser (phone) | ✅ | 1890 ms |
| UI-17 | PIN hint: can't contain the PIN; "Show my hint" after choosing your name | browser (phone) | ✅ | 3582 ms |
| UI-18 | Home has no heading, intro or card title (review round 1) | browser (phone) | ✅ | 845 ms |
| UI-19 | PIN match is checked the moment the 4th number is typed, on Join and Start a group (GR-3) | browser (phone) | ✅ | 2080 ms |
| UI-20 | Join is answered in order: dropdown first, then name (new people only), then PIN block (GR-2) | browser (phone) | ✅ | 1729 ms |
| UI-21 | Every dropdown uses the phone's own picker (GR-4) | browser (phone) | ✅ | 2724 ms |
| UI-22 | "I don't have a PIN yet" explains and switches to a new, distinguishing name (round 3) | browser (phone) | ✅ | 3462 ms |
| UI-23 | "I can't remember my PIN" shows the hint and says to ask the organiser (round 3) | browser (phone) | ✅ | 2945 ms |
| UI-24 | Dark mode: outline buttons have a visible surface and border (global flag, round 3) | browser (phone) | ✅ | 1080 ms |
| UI-01 | Home: a valid code opens the Join screen with the group name | browser (desktop) | ✅ | 2087 ms |
| UI-02 | Home: an invalid code shows the error and keeps focus on the box | browser (desktop) | ✅ | 1224 ms |
| UI-04 | Joining as a new person lands inside the group with a welcome message | browser (desktop) | ✅ | 2170 ms |
| UI-18 | Home has no heading, intro or card title (review round 1) | browser (desktop) | ✅ | 1005 ms |
| PROTO-01 | SC-01 Join from an invite link | prototype scenarios | ✅ | 2075 ms |
| PROTO-02 | SC-02 Type a group code | prototype scenarios | ✅ | 2613 ms |
| PROTO-03 | SC-03 Join under a name the organiser added | prototype scenarios | ✅ | 1867 ms |
| PROTO-04 | SC-04 Same name as someone already in the group | prototype scenarios | ✅ | 2435 ms |
| PROTO-05 | SC-05 Sign back in on a new device, using the hint | prototype scenarios | ✅ | 1652 ms |
| PROTO-06 | SC-06 Wrong PIN, then too many wrong PINs | prototype scenarios | ✅ | 3500 ms |
| PROTO-15 | SC-13 Types their name instead of choosing it | prototype scenarios | ✅ | 1337 ms |
| PROTO-09 | SC-09 Start a new group (approved) | prototype scenarios | ✅ | 3384 ms |
| PROTO-10 | SC-10 Start a new group (declined) | prototype scenarios | ✅ | 2908 ms |
| PROTO-07 | SC-07 PIN typo while joining | prototype scenarios | ✅ | 1034 ms |
| PROTO-08 | SC-08 Broken invite link | prototype scenarios | ✅ | 733 ms |
| PROTO-12 | SC-12 Too many attempts from one network | prototype scenarios | ✅ | 1186 ms |
| PROTO-00 | every scenario card uses the shared group data and opens its start screen | prototype scenarios | ✅ | 602 ms |
| PROTO-13 | "Works as expected" puts a green check on the scenario and counts it | prototype scenarios | ✅ | 158 ms |
| PROTO-14 | A global change on the Join screen appears in every scenario that shows Join, and only those | prototype scenarios | ✅ | 1489 ms |

## Run history (newest first)
<!-- history:start -->
| When | Code version | Result | Env checks | Tests |
|---|---|---|---|---|
| 2026-11-21 23:53 UTC | `8b62977` + uncommitted changes | ✅ PASS | 11/11 | 118/118 |
| 2026-11-21 23:50 UTC | `8b62977` + uncommitted changes | ❌ FAIL | 10/11 | 118/118 |
| 2026-11-21 23:16 UTC | `41b2991` | ✅ PASS | 11/11 | 102/102 |
| 2026-11-21 19:43 UTC | `9e41faa` | ✅ PASS | 11/11 | 102/102 |
| 2026-11-21 19:16 UTC | `35ef785` | ✅ PASS | 11/11 | 99/99 |
| 2026-11-21 19:05 UTC | `70c6af1` | ✅ PASS | 11/11 | 97/97 |
| 2026-11-21 18:43 UTC | `cb88b6c` | ✅ PASS | 10/10 | 81/81 |
| 2026-11-21 18:31 UTC | `192cf10` | ✅ PASS | 10/10 | 81/81 |
| 2026-11-21 18:23 UTC | `29c8de0` | ✅ PASS | 10/10 | 81/81 |
| 2026-11-21 18:02 UTC | `d4e8113` | ✅ PASS | 10/10 | 72/72 |
| 2026-11-21 17:24 UTC | `72aee5b` | ✅ PASS | 9/9 | 46/46 |
| 2026-11-21 17:06 UTC | `7a10a5d` | ✅ PASS | 9/9 | 23/23 |
| 2026-11-21 17:04 UTC | `d4234dc` + uncommitted changes | ✅ PASS | 9/9 | 23/23 |
<!-- history:end -->
