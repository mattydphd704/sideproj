# Test Results

Generated automatically by `npm run verify` (`scripts/verify.mjs`). **Don't edit by hand.** What each test means is described in [TEST_PLAN.md](TEST_PLAN.md).

## Latest run

| | |
|---|---|
| **Result** | ✅ **PASS**: stable baseline |
| **When** | 2026-11-21 17:04 UTC |
| **Code version** | `d4234dc` (plus uncommitted changes) |
| **Environment** | Node v22.23.5, local (this container), no Cloudflare account used |
| **Environment checks** | 9 of 9 passed |
| **Automated tests** | 23 of 23 passed |

### Environment checks
| ID | Check | Result | Detail |
|---|---|---|---|
| ENV-01 | Clean install from lockfile (npm ci) | ✅ | 102 packages installed |
| ENV-02 | Security audit (npm audit) | ✅ | 0 vulnerabilities |
| ENV-03 | Type check (src) | ✅ | no type errors |
| ENV-04 | Production build | ✅ | web app + Worker built |
| ENV-05 | Migrations apply to an empty database | ✅ | 25 SQL statements applied |
| ENV-06 | Automated test suite (Vitest) | ✅ | 23/23 tests passed |
| ENV-07 | API health check reaches the database | ✅ | {"ok":true,"env":"local"} |
| ENV-08 | Invite path /j/<code> serves the app (FR-1.10) | ✅ | HTTP 200 |
| ENV-09 | Unknown API path returns a JSON 404 | ✅ | HTTP 404 {"error":"not_found"} |

### Automated tests
| ID | Test | Area | Result | Time |
|---|---|---|---|---|
| SCH-01 | are enforced (a member must belong to a real group) | foreign keys | ✅ | 15 ms |
| SCH-02 | group code must be exactly 8 characters (G2) | groups | ✅ | 12 ms |
| SCH-03 | group codes are unique | groups | ✅ | 22 ms |
| SCH-04 | group name max 60 characters (G1) | groups | ✅ | 20 ms |
| SCH-05 | display names are unique in a group, ignoring case (Q12) | members | ✅ | 32 ms |
| SCH-06 | the same name is fine in a different group | members | ✅ | 41 ms |
| SCH-07 | a removed member's name can be reused (G12 interim) | members | ✅ | 30 ms |
| SCH-08 | display name max 30 characters (G4) | members | ✅ | 20 ms |
| SCH-09 | title max 100 characters (G6) and must not be blank | items | ✅ | 59 ms |
| SCH-10 | deleted items must record when they were deleted | items | ✅ | 44 ms |
| SCH-11 | archived items must belong to an archive batch | items | ✅ | 32 ms |
| SCH-12 | mode and visibility only accept the glossary values | items | ✅ | 44 ms |
| SCH-13 | need a URL or a description | product links | ✅ | 71 ms |
| SCH-14 | at most 5 positions per item (G8) | product links | ✅ | 115 ms |
| SCH-15 | a price needs a currency, and is a whole non-negative number (G16) | product links | ✅ | 71 ms |
| SCH-16 | URLs must look like http(s) links | product links | ✅ | 60 ms |
| CLM-01 | a second live claim on the same item is rejected | claims (NFR-2: at most one live claim per item) | ✅ | 106 ms |
| CLM-02 | a frozen claim (archived item) also blocks a second claim | claims (NFR-2: at most one live claim per item) | ✅ | 85 ms |
| CLM-03 | after a claim is released, someone else can claim | claims (NFR-2: at most one live claim per item) | ✅ | 94 ms |
| CLM-04 | simultaneous claims: exactly one succeeds | claims (NFR-2: at most one live claim per item) | ✅ | 125 ms |
| CLM-05 | a released claim must record when it was released | claims (NFR-2: at most one live claim per item) | ✅ | 56 ms |
| SCH-17 | deleting an item removes its links, visibility rows and all claims | permanent delete (FR-7.2, G14) | ✅ | 149 ms |
| SMK-01 | all 12 tables exist | test/schema/smoke.test.ts | ✅ | 9 ms |

## Run history (newest first)
<!-- history:start -->
| When | Code version | Result | Env checks | Tests |
|---|---|---|---|---|
| 2026-11-21 17:04 UTC | `d4234dc` + uncommitted changes | ✅ PASS | 9/9 | 23/23 |
<!-- history:end -->
