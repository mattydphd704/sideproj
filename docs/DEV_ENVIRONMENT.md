# Dev Environment

| | |
|---|---|
| **Dev app** | **https://giftlist-dev.mcjdonovan.workers.dev** |
| **Status** | Live since 2026-11-21 (AR-01 approved by the TPM) |
| **Scope** | Section 1, Getting in: Home, Join (one way in: choose your name, PIN, "Is that you?", wrong-PIN help, hint), Start a group, Waiting, Declined, plus the temporary "inside the group" screen |
| **Cloudflare** | Worker `giftlist-dev`, D1 database `giftlist-dev`, account owned by the TPM, Free plan (ADR-02) |
| **Branch deployed** | `claude/sharp-knuth-889h6a-ui-workflow` |

## Test data (same as the prototype, GR-8)
Group **Smith Family**, code **`SMTH-2345`**. Invite link: https://giftlist-dev.mcjdonovan.workers.dev/j/SMTH-2345

| Member | State | PIN | Hint |
|---|---|---|---|
| Sam | Signed in before | 1234 | the old house number |
| Alex | Signed in before | 1234 | none |
| Jo | Signed in before | 2580 | the garden gate |
| Grandma | Added by the organiser, not signed in yet | (you create it) | |
| Uncle Ray | Added by the organiser, not signed in yet | (you create it) | |

Anything you create in dev (new members, groups, requests) is test data and can be reset on request.

## What works differently from the prototype
- It's the **real** server and database. What you do persists, and other browsers see it.
- **Locking really locks.** 5 wrong PINs lock that name for 15 minutes. Ten failed attempts from your network in 15 minutes block further attempts for a while. Ask the engineer to clear it if it gets in the way of testing.
- **Approving "Start a new group" requests:** the admin area isn't built yet. Ask the engineer to approve or decline, which takes a few seconds (`scripts/dev-requests.mjs`). Then tap "Check now", or wait up to 30 seconds.
- **The "inside the group" screen** is still the placeholder (backlog B-016).

## How it's deployed (engineer)
- `npm run deploy:dev`: builds the web app, embeds it in the Worker (ADR-16) and deploys with `wrangler.dev.jsonc`.
- Migrations: `npx wrangler d1 migrations apply DB --config wrangler.dev.jsonc --remote`.
- The secret `PIN_PEPPER` is set only as a Cloudflare secret, never stored in the repo.
- Credentials: a Cloudflare API token saved on the `sideproj` cloud environment (Workers + D1), injected by the session's network proxy. It's never in the repo or the chat.
- Preview URLs are off, so the only address is the one above.

## Checks run on the live app (2026-11-21)
| ID | Check | Result |
|---|---|---|
| DEV-01 | Migrations 0001 and 0002 apply to the remote D1 | ✅ |
| DEV-02 | Foreign keys enforced on real D1 | ✅ |
| DEV-03 | Health (`env: dev`), `/j/SMTH-2345` serves the app, unknown API returns a JSON 404, cross-site POST blocked (403) | ✅ |
| DEV-05 (part) | Phone browser: SC-01 join as a new person, then reload remembers them; SC-05 sign back in as Jo with the hint; SC-13 "Is that you?" → PIN; wrong-code message; 360 px no sideways scroll; dark-mode button visible; no page errors | ✅ |
| DEV-08 | Group request → engineer approves → browser moved into the new group (via API) | ✅ |

Test traces (a "Dev Check" member, a probe group, sign-ins) were removed afterwards.
