# Dev Environment

| | |
|---|---|
| **Dev app** | **https://giftlist-dev.mcjdonovan.workers.dev** |
| **Status** | Live since 2026-11-21 (AR-01 approved by the TPM). **Test data cleared 2026-11-21 at the TPM's request:** the database is empty (schema and migrations kept). |
| **Scope** | Section 1, Getting in: Home, Join (one way in: choose your name, PIN, "Is that you?", wrong-PIN help, hint), Start a group, Waiting, Declined, plus the temporary "inside the group" screen |
| **Cloudflare** | Worker `giftlist-dev`, D1 database `giftlist-dev`, account owned by the TPM, Free plan (ADR-02) |
| **Branch deployed** | `claude/beautiful-brown-z7s8tq` (Section 1 + admin protocol, ADR-17) |
| **Admin** | Admin protocol on `/api/admin/*` (`ADMIN_PROTOCOL.md`). **Off until the TPM sets the dev admin key** (AR-09, steps below). |

## Test data: currently cleared
The dev database has **no groups or members** right now, so code `SMTH-2345` won't work until the data is re-seeded (steps below). This is the data set to bring back (the same as the prototype, GR-8):

Group **Smith Family**, code **`SMTH-2345`**. Invite link once seeded: https://giftlist-dev.mcjdonovan.workers.dev/j/SMTH-2345

| Member | State | PIN | Hint |
|---|---|---|---|
| Sam | Signed in before | 1234 | the old house number |
| Alex | Signed in before | 1234 | none |
| Jo | Signed in before | 2580 | the garden gate |
| Grandma | Added by the organiser, not signed in yet | (you create it) | |
| Uncle Ray | Added by the organiser, not signed in yet | (you create it) | |

Anything you create in dev (new members, groups, requests) is test data and can be reset on request.

## How to bring the test data back (engineer)
The dev `PIN_PEPPER` secret was never stored outside Cloudflare, so re-seeding **rotates it**. That's fine in dev, but it invalidates any PINs created in dev since the last seed.

```bash
umask 077 && node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))" > /tmp/dev-pepper
```

```bash
node scripts/dev-seed.mjs /tmp/dev-pepper /tmp/dev-seed.sql
```

```bash
npx wrangler d1 execute DB --config wrangler.dev.jsonc --remote --file /tmp/dev-seed.sql
```

```bash
npx wrangler secret put PIN_PEPPER --config wrangler.dev.jsonc < /tmp/dev-pepper
```

```bash
rm -f /tmp/dev-pepper /tmp/dev-seed.sql
```

The Cloudflare commands need `CLOUDFLARE_API_TOKEN` (any placeholder in this cloud environment, where the proxy adds the real token) and `CLOUDFLARE_ACCOUNT_ID`.

**To clear the data again:** delete the rows from every table, leaving the schema. The statement used on 2026-11-21 was: `UPDATE group_requests SET group_id = NULL; UPDATE groups SET request_id = NULL; DELETE FROM tombstones; DELETE FROM claims; DELETE FROM product_links; DELETE FROM item_visibility; DELETE FROM archive_batch_items; DELETE FROM items; DELETE FROM archive_batches; DELETE FROM member_tokens; DELETE FROM members; DELETE FROM groups; DELETE FROM group_requests; DELETE FROM rate_limits;`

**Cloudflare throttling:** after many database calls in a short time, Cloudflare answers with code 971 ("Please wait"). Wait about 30 seconds and retry.

## What works differently from the prototype
- It's the **real** server and database. What you do persists, and other browsers see it.
- **Locking really locks.** 5 wrong PINs lock that name for 15 minutes. Ten failed attempts from your network in 15 minutes block further attempts for a while. Ask the engineer to clear it if it gets in the way of testing.
- **Approving "Start a new group" requests:** tell the engineer in the Claude session. They plan the approval with the admin protocol, show you the plan, and apply it when you say so. Then tap "Check now", or wait up to 30 seconds. (`scripts/dev-requests.mjs` is retired, ADR-17.)
- **The "inside the group" screen** is still the placeholder (backlog B-016).

## Admin key for dev (TPM, once; AR-09)
The engineer never sees this key. You set it in two places:
1. **Make a key:** generate a random password of at least 32 characters in your password manager (letters and numbers only is fine).
2. **On the Worker:** Cloudflare dashboard → Workers & Pages → `giftlist-dev` → Settings → Variables and Secrets → Add → type **Secret**, name **`ADMIN_KEY`**, value: the key → Deploy.
3. **On the cloud environment:** the engineer opens the secure credential form for host `giftlist-dev.mcjdonovan.workers.dev`, header **`X-Admin-Key`**, no prefix. Paste the same key there. The session's proxy then adds it to the engineer's requests to dev.

To rotate it, repeat steps 1–3 with a new key. To switch admin off on dev, delete the `ADMIN_KEY` secret (every admin call then answers 503).

## How it's deployed (engineer)
- `npm run deploy:dev`: builds the web app, embeds it in the Worker (ADR-16) and deploys with `wrangler.dev.jsonc`.
- Migrations: `npx wrangler d1 migrations apply DB --config wrangler.dev.jsonc --remote`.
- The secrets `PIN_PEPPER` and `ADMIN_KEY` are set only as Cloudflare secrets, never stored in the repo.
- Admin work: `npm run admin -- <command>` (dev is the default; see `ADMIN_PROTOCOL.md` §8).
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
