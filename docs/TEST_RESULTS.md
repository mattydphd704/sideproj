# Test Results

Generated automatically by `npm run verify` (`scripts/verify.mjs`). **Don't edit by hand.** What each test means is described in [TEST_PLAN.md](TEST_PLAN.md).

## Latest run

| | |
|---|---|
| **Result** | ✅ **PASS**: stable baseline |
| **When** | 2026-11-21 17:24 UTC |
| **Code version** | `72aee5b` |
| **Environment** | Node v22.23.5, local (this container), no Cloudflare account used |
| **Environment checks** | 9 of 9 passed |
| **Automated tests** | 46 of 46 passed |

### Environment checks
| ID | Check | Result | Detail |
|---|---|---|---|
| ENV-01 | Clean install from lockfile (npm ci) | ✅ | 104 packages installed |
| ENV-02 | Security audit (npm audit) | ✅ | 0 vulnerabilities |
| ENV-03 | Type check (src) | ✅ | no type errors |
| ENV-04 | Production build | ✅ | web app + Worker built |
| ENV-05 | Migrations apply to an empty database | ✅ | 25 SQL statements applied |
| ENV-06 | Automated test suite (Vitest) | ✅ | 46/46 tests passed |
| ENV-07 | API health check reaches the database | ✅ | {"ok":true,"env":"local"} |
| ENV-08 | Invite path /j/<code> serves the app (FR-1.10) | ✅ | HTTP 200 |
| ENV-09 | Unknown API path returns a JSON 404 | ✅ | HTTP 404 {"error":"not_found","message":"Not found."} |

### Automated tests
| ID | Test | Area | Result | Time |
|---|---|---|---|---|
| ID-01 | join with a valid code creates a joined member and sets a cookie | joining | ✅ | 112 ms |
| ID-02 | unknown and malformed codes give the same generic error | joining | ✅ | 69 ms |
| ID-03 | a display name already in use is rejected with a helpful message | joining | ✅ | 140 ms |
| ID-04 | picking a pending name on first visit sets the PIN and joins | joining | ✅ | 158 ms |
| ID-05 | the member cookie is HttpOnly, Secure, SameSite=Lax, one per group | joining | ✅ | 100 ms |
| ID-06 | only the token's hash is stored; the raw token is not in the database | joining | ✅ | 97 ms |
| ID-11 | PIN must be 4–6 digits | joining | ✅ | 177 ms |
| ID-12 | PINs are stored as salted HMACs with the pepper, never as plain text | joining | ✅ | 194 ms |
| ID-14 | codes work with or without the dash, in any case | joining | ✅ | 181 ms |
| ID-20 | a pending member has no session until they set a PIN | joining | ✅ | 85 ms |
| ID-21 | lookup shows the group name and member names (pending flagged), not removed members | joining | ✅ | 164 ms |
| ID-07 | correct PIN on a new browser issues a new token; the old device stays signed in | recovery | ✅ | 226 ms |
| ID-08 | a wrong PIN is rejected and counted | recovery | ✅ | 167 ms |
| ID-09 | 5 wrong PINs lock the name for 15 minutes, even against the correct PIN | recovery | ✅ | 479 ms |
| ID-10 | after the lock expires the correct PIN works and the count resets | recovery | ✅ | 167 ms |
| ID-18 | an admin PIN reset signs the member out everywhere; their next PIN becomes the new one | recovery | ✅ | 254 ms |
| ID-16 | one browser in several groups: /api/me lists them all | sessions | ✅ | 231 ms |
| ID-17 | a removed member's tokens stop working | sessions | ✅ | 100 ms |
| ID-19 | data-changing requests without the app header, or from another site, are blocked | sessions | ✅ | 19 ms |
| — | [ID-13a] 10 failed attempts from one IP in 15 minutes → further attempts blocked | rate limits and logging | ✅ | 447 ms |
| — | [ID-13b] more than 30 attempts on one code in an hour → blocked | rate limits and logging | ✅ | 1182 ms |
| — | [ID-13c] rate-limit keys don't store IP addresses or codes in plain text | rate limits and logging | ✅ | 8 ms |
| ID-15 | codes, PINs and tokens never appear in logs | rate limits and logging | ✅ | 137 ms |
| SCH-01 | are enforced (a member must belong to a real group) | foreign keys | ✅ | 15 ms |
| SCH-02 | group code must be exactly 8 characters (G2) | groups | ✅ | 18 ms |
| SCH-03 | group codes are unique | groups | ✅ | 24 ms |
| SCH-04 | group name max 60 characters (G1) | groups | ✅ | 23 ms |
| SCH-05 | display names are unique in a group, ignoring case (Q12) | members | ✅ | 34 ms |
| SCH-06 | the same name is fine in a different group | members | ✅ | 49 ms |
| SCH-07 | a removed member's name can be reused (G12 interim) | members | ✅ | 31 ms |
| SCH-08 | display name max 30 characters (G4) | members | ✅ | 22 ms |
| SCH-09 | title max 100 characters (G6) and must not be blank | items | ✅ | 84 ms |
| SCH-10 | deleted items must record when they were deleted | items | ✅ | 44 ms |
| SCH-11 | archived items must belong to an archive batch | items | ✅ | 38 ms |
| SCH-12 | mode and visibility only accept the glossary values | items | ✅ | 47 ms |
| SCH-13 | need a URL or a description | product links | ✅ | 57 ms |
| SCH-14 | at most 5 positions per item (G8) | product links | ✅ | 110 ms |
| SCH-15 | a price needs a currency, and is a whole non-negative number (G16) | product links | ✅ | 71 ms |
| SCH-16 | URLs must look like http(s) links | product links | ✅ | 58 ms |
| CLM-01 | a second live claim on the same item is rejected | claims (NFR-2: at most one live claim per item) | ✅ | 81 ms |
| CLM-02 | a frozen claim (archived item) also blocks a second claim | claims (NFR-2: at most one live claim per item) | ✅ | 76 ms |
| CLM-03 | after a claim is released, someone else can claim | claims (NFR-2: at most one live claim per item) | ✅ | 90 ms |
| CLM-04 | simultaneous claims: exactly one succeeds | claims (NFR-2: at most one live claim per item) | ✅ | 147 ms |
| CLM-05 | a released claim must record when it was released | claims (NFR-2: at most one live claim per item) | ✅ | 56 ms |
| SCH-17 | deleting an item removes its links, visibility rows and all claims | permanent delete (FR-7.2, G14) | ✅ | 166 ms |
| SMK-01 | all 12 tables exist | test/schema/smoke.test.ts | ✅ | 14 ms |

## Run history (newest first)
<!-- history:start -->
| When | Code version | Result | Env checks | Tests |
|---|---|---|---|---|
| 2026-11-21 17:24 UTC | `72aee5b` | ✅ PASS | 9/9 | 46/46 |
| 2026-11-21 17:06 UTC | `7a10a5d` | ✅ PASS | 9/9 | 23/23 |
| 2026-11-21 17:04 UTC | `d4234dc` + uncommitted changes | ✅ PASS | 9/9 | 23/23 |
<!-- history:end -->
