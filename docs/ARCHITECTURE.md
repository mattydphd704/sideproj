# Architecture: Gift List Tracker v1

| | |
|---|---|
| **Status** | v1.1, approved by TPM (v1.1: admin protocol, ADR-17) |
| **Last updated** | 2026-11-21 |
| **Based on** | `PROJECT_BRIEF.md` v0.9, `GLOSSARY.md` rev 3 |
| **Hosting constraint (TPM)** | Cloudflare, using the Free plan or the **Workers Paid** plan ($5 a month) |
| **Revisions** | v0.1 first draft · v0.2 TPM decisions on A1, A2, A4 and A5 recorded; A3 advice added · v1.0 A3 accepted (option 1, with the exact version in backlog B-012); `/j/` short path added (§6.10) · v1.1 admin protocol with an admin key instead of admin screens behind Cloudflare Access (ADR-17, §6.8, AR-09) |

Cloudflare limits quoted here were checked against Cloudflare's docs on 2026-11-21 (sources in §12). Anything marked **[verify]** must be rechecked in the Cloudflare dashboard when the account is set up.

---

## 1. Summary

**Recommendation:** Build everything on Cloudflare: **Workers** runs the app and the API, **Workers Static Assets** serves the web pages, and **D1** (Cloudflare's SQLite database) stores the data. Use the **Free plan for local and dev**, and the **Workers Paid plan ($5 a month) for prod**.

Every v1 requirement can be met on Cloudflare. The Free plan is fine for development. For prod it is **not recommended**, for three reasons:
1. **CPU limit:** Free allows **10 ms of CPU per request**. Product-link auto-fill (PR-002) parses retailer web pages, which can go over that limit and fail with an error.
2. **Daily request cap:** Free allows **100,000 requests a day**. The dashboard checks for updates every 30 seconds, and at holiday peak that could hit the cap, which takes the whole app offline until midnight UTC.
3. **Backups:** Free keeps **7 days** of database point-in-time recovery (D1 Time Travel). Paid keeps **30**.

At v1 scale (fewer than 100 groups), the $5 plan's included usage covers prod with lots of room to spare. See §9.

---

## 2. System overview

```
 ┌──────────────────────── Browser (phone / desktop) ────────────────────────┐
 │  Web app (single-page app)                                                │
 │  Cookies: one HttpOnly member-token cookie per joined group               │
 └───────────────┬───────────────────────────────────────────────────────────┘
                 │ HTTPS
 ┌───────────────▼───────────────────── Cloudflare ──────────────────────────┐
 │                                                                           │
 │  Workers Static Assets  ── serves the web app's HTML/JS/CSS (free, unlimited)
 │                                                                           │
 │  Worker "giftlist-api"  (TypeScript)                                      │
 │   ├─ Router (/api/*)                                                      │
 │   ├─ Auth: member tokens · PIN recovery · group-request tokens            │
 │   ├─ Domain services: groups, members, items, links, claims,              │
 │   │                   fair share, delete/archive/restore                  │
 │   ├─ View builder  ◄── the ONLY code that shapes responses (glossary Part D)
 │   ├─ Auto-fill: fetches retailer pages, guarded and time-limited          │
 │   └─ Scheduled handler (nightly): purge items deleted over 90 days ago    │
 │                                                                           │
 │  D1 (SQLite) ── one database per environment                              │
 │                                                                           │
 │  Admin protocol /api/admin/* ── admin key (X-Admin-Key), ADR-17          │
 └───────────────────────────────────────────────────────────────────────────┘
                 │ outbound HTTPS (auto-fill only)
                 ▼
          Retailer product pages
```

**One deployable unit per environment:** one Worker, which also serves the static assets, plus one D1 database. There are no other servers, queues or storage buckets in v1.

---

## 3. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language for the front end, the back end and tests. Type checking catches mistakes early. |
| API framework | **Hono** | A small router built for Workers. Low CPU overhead, which matters under the Free plan's 10 ms limit. |
| Front end | **React + Vite**, served as a static single-page app | Familiar and quick to build with. Static files are served free and don't count against the request limits. |
| UI styling | Plain CSS with a small set of shared design values (colours, spacing) | Simple UI requirement (FR-4.2). No heavy UI library. |
| Database | **D1** (SQLite) | Relational data, unique indexes for safe claiming, and atomic `batch()` writes. Free tier is generous. |
| Database access | Hand-written SQL, through a small typed query layer | Keeps queries visible and reviewable. Avoids a heavy ORM. |
| Database migrations | `wrangler d1 migrations` | Versioned SQL files checked into the repo, applied the same way to dev and prod. |
| Unit and API tests | **Vitest** with a real local D1 database from wrangler's local runtime (`getPlatformProxy`) | Runs **inside this container, with no Cloudflare account needed**. The Workers test pool was dropped because of a security audit (ADR-13). The Worker itself is checked with `vite dev` and, later, Playwright end-to-end tests. |
| End-to-end tests | **Playwright** (already installed here) | Covers whole user journeys, including the surprise rule and visibility. |
| Local runtime | `wrangler dev` (Miniflare) | The full app runs locally, offline. |
| Admin access | **Admin protocol with an admin key** (ADR-17). Cloudflare Access (AD-04) returns with admin screens (B-017). | No admin screens yet. The key is a Worker secret, never in the database, repo or chat. |

---

## 4. Environments

| Environment | Where | Plan | Data | Who deploys | Purpose |
|---|---|---|---|---|---|
| **local** | This container, using `wrangler dev` and Miniflare | None, no account needed | Local SQLite file and seed data | Engineer | Day-to-day development and all automated tests |
| **dev** | Cloudflare Worker `giftlist-dev` with D1 database `giftlist-dev` | Free, or covered by Paid | Test data only | Engineer, with a scoped API token (AR-01) | Shared test environment for TPM review and PR scenarios |
| **prod** | Cloudflare Worker `giftlist-prod` with D1 database `giftlist-prod` | **Workers Paid, $5/mo** | Real data | **TPM approves every deploy.** Engineer deploys only with explicit go-ahead | Live |

- Dev and prod have **separate** databases, secrets and URLs. Nothing is shared between them.
- The paid plan applies to the whole Cloudflare account. Once prod is on $5, dev gets the same limits at no extra cost.
- URLs: `*.workers.dev` subdomains are free. A custom domain is optional (AR-05).

---

## 5. Compatibility: requirements vs the Cloudflare Free and $5 plans

✅ = fully supported · ⚠️ = works, with a constraint · ❌ = not suitable

| Requirement | How it's built | Free | Paid ($5) | Notes |
|---|---|---|---|---|
| Web-hosted, mobile and desktop (NFR-1) | Single-page app on Workers Static Assets | ✅ | ✅ | Static file requests are free and unlimited. |
| No login, browser remembers member (FR-1.5) | HttpOnly, Secure cookie holding a member token. Only the token's hash is stored in D1. | ✅ | ✅ | |
| PIN recovery and lockout (FR-1.7, NFR-4) | PIN hashed with a server-side secret key (HMAC-SHA-256) plus a per-PIN salt. Failed attempts are counted in D1. | ✅ | ✅ | See §6.2 for why this beats a slow hash on Free. |
| Group code join rate limit (NFR-3) | Attempt counters per IP address and per code in D1 | ✅ | ✅ | Cloudflare's built-in Rate Limiting binding is an alternative. **[verify]** whether it's on Free |
| Group request and approval (FR-1.2) | Request token cookie. The waiting screen checks status. | ✅ | ✅ | |
| Invite links | Share menu or clipboard in the browser | ✅ | ✅ | |
| Multiple groups per browser (FR-1.9) | One cookie per membership | ✅ | ✅ | |
| Admin (FR-2, NFR-7) | Admin protocol on `/api/admin/*`, admin key as a Worker secret (ADR-17) | ✅ | ✅ | Secrets are free on both plans. Cloudflare Access (free Zero Trust plan) is only needed for admin screens later (B-017). |
| Items, links, visibility, stars (FR-3) | D1 tables | ✅ | ✅ | |
| Auto-fill from links (FR-3.1b, PR-002) | Worker `fetch()` → stream HTML → extract Open Graph and schema.org (JSON-LD) data | ⚠️ | ✅ | **Free: the 10 ms CPU limit** can be exceeded on large pages, causing a failure (shown as "auto-fill failed", item still saves). Paid allows up to 30 s by default. |
| Surprise rule and hidden items enforced on the server (NFR-5) | A single view-builder module and tests against every row of glossary Part D | ✅ | ✅ | |
| Atomic claim (NFR-2) | Unique index: at most one active claim per item. Insert is protected by the index. | ✅ | ✅ | |
| Fair-share check (FR-6, NFR-9) | Calculated on the server at claim time | ⚠️ | ⚠️ | D1 has no interactive transactions. See AD-06: the warning is advisory and the claim itself is still atomic. |
| Dashboard auto-refresh every 30 s (FR-4.3) | Lightweight "has anything changed?" endpoint, only when the tab is visible | ⚠️ | ✅ | **Free: 100,000 requests a day**, shared by everyone. Estimate in §9. |
| Archive and restore all at once (FR-7.3, FR-7.4, NFR-11) | D1 `batch()`, which runs all its statements as a single transaction | ✅ | ✅ | |
| 90-day permanent delete job (NFR-10) | Nightly Cron Trigger with an idempotent SQL delete | ✅ | ✅ | Free allows 5 Cron Triggers and we need 1. |
| Backups and disaster recovery | D1 Time Travel (point-in-time restore) | ⚠️ 7 days | ✅ 30 days | Plus a manual export before every prod deploy. |
| Storage | D1 | ✅ 500 MB per DB | ✅ 10 GB per DB | v1 is estimated at under 50 MB. |
| Separate dev, test and prod (NFR-8) | Separate Workers and databases | ✅ | ✅ | Free allows 10 D1 databases. |

**Conclusion:** Nothing in v1 requires anything beyond the $5 plan. The Free plan's limits only affect auto-fill and peak-time refreshing, which is why prod should be on Paid.

---

## 6. Key designs

### 6.1 Identity and sessions
- **Member token:** 32 random bytes, sent as an `HttpOnly; Secure; SameSite=Lax` cookie named `m_<group_id>`. D1 stores only its SHA-256 hash (glossary B3). Lifetime: 400 days, renewed on each use.
- **Recovery:** group code → pick display name → PIN → a new token is issued. Other tokens for that member stay valid (glossary B3).
- **PIN reset (admin):** clears the PIN and revokes all of the member's tokens (G5).
- **Group request token:** stored in the same kind of cookie (`r_<request_id>`). When the request is approved, the server swaps it for a member token on the requester's next check.
- **CSRF protection:** every request that changes data must include a custom header and come from the same origin as the app.

### 6.2 PIN storage
- A 4–6 digit PIN has at most about 1.1 million combinations. If the database leaked, a slow hash such as PBKDF2 would not stop a brute-force attack for long, and on the Free plan slow hashing risks hitting the 10 ms CPU limit.
- **Design:** `pin_hash = HMAC-SHA-256(PIN_PEPPER, salt ‖ pin)`. `PIN_PEPPER` is a secret key stored as a Worker Secret, never in the database. A leaked database alone can't be brute-forced without it. The real protection against online guessing is the lockout (5 attempts, then 15 minutes) and rate limiting by IP address.
- Each environment has its own pepper.

### 6.3 Response shaping (surprise rule and visibility)
- All data sent to a browser goes through **one module**, `views/`. It turns database rows into what a given viewer is allowed to see, following glossary Part D.
- Database queries include the viewer's ID, and filter by visibility **in SQL** wherever possible, so hidden items are never even loaded.
- Fields that must never leave the server (`pin_hash`, `token_hash`, `visible_to` for non-owners, claim data for owners) are removed by type-checked output types, not by convention.
- **Tests:** one test per Part D cell, per viewer role. These are part of the success criteria (brief §9, #5 and #6).

### 6.4 Claiming and fair share
1. Client sends `POST /api/items/:id/claim`, with `{acknowledgeFairShare?: true}` when the user has already seen the warning.
2. The server loads the recipient's items and claims for the group and works out the fair-share threshold (FR-6.3).
3. If the claim would breach the threshold and the user hasn't acknowledged the warning, the server returns **409 `fair_share_warning`** with the numbers for the warning. The client shows it and resends with the acknowledgement if the user chooses "Claim anyway".
4. Insert the claim. **The unique index on `(item_id)` for active or frozen claims guarantees only one person can hold a claim**, even if two people click at once. The loser gets 409 `already_claimed`.
5. `fair_share_override` is recorded for tuning in PR-003.

Steps 2 and 4 aren't in one transaction (AD-06), so a simultaneous claim by someone else could, rarely, make a warning a moment out of date. That's acceptable because the warning is advisory and the nudge on the Claimed list (FR-6.5) recalculates on every page load.

### 6.5 Dashboard refresh
- `GET /api/groups/:id/version` returns the group's `version` number, which goes up on every change in the group. This needs one row read and very little CPU.
- The client checks every 30 s, **only while the tab is visible**, and also whenever the tab regains focus. If the version changed, it fetches the dashboard again.

### 6.6 Delete, archive and restore
- **Soft delete and restore:** a single-row update.
- **Archive:** one D1 `batch()`:
  1. insert the archive batch;
  2. copy each item's current state (`prior_status`, `deleted_days_remaining`) into the batch's entries;
  3. set items to `archived`;
  4. set active claims to `frozen`;
  5. increase the group version.

  Restore archive is the reverse, also in one `batch()`. At v1 scale, a group has well under 1,000 items, within D1's batch limits. **[verify]** the statement limit for each batch.
- **Nightly purge (Cron Trigger at 03:17 UTC):**
  1. Select items with `status='deleted'` and `deleted_at` more than 90 days ago. Archived items are excluded automatically because their status is `archived`.
  2. For each one, write tombstones for claimed items, then delete the claim, links, visibility rows and item.
  3. Running it twice does nothing extra (idempotent).
  4. Log counts.

### 6.7 Auto-fill (PR-002, sized to fit within the plan limits)
- Triggered **after** the item is saved: the client calls `POST /api/links/:id/autofill`. Saving never waits for it.
- **Safety:**
  - Only `https` URLs, and no IP-address hosts.
  - Requests to our own domain are blocked.
  - 5 s timeout, at most 2 MB downloaded, and at most 3 redirects, each one checked again.
  - Workers can't reach private networks, which removes most server-side request forgery risk.
- **Extraction:** Cloudflare's streaming `HTMLRewriter` pulls Open Graph and `<meta>` tags, plus `application/ld+json` blocks that describe a Product or Offer. Only fields the owner hasn't edited are filled in (`user_edited_fields`).
- **Known risk:** some large retailers block requests from cloud servers. The PR-002 experiment will measure success rates by retailer and category. When auto-fill fails, the owner fills in details by hand.

### 6.8 Admin *(revised: ADR-17 supersedes AD-04 for now)*
- **No admin screens yet** (TPM, G34). The admin works through the **admin protocol** (`ADMIN_PROTOCOL.md`): read endpoints plus **plan** and **apply** under `/api/admin/*`.
- **Admin key:** every admin call carries `X-Admin-Key`, compared (hashed, constant time) with the Worker secret `ADMIN_KEY`. If the secret is missing or shorter than 32 characters, every admin endpoint answers `503` (fail closed, like the `PIN_PEPPER` check). 10 wrong keys from one network in 15 minutes block it for the rest of the window.
- **On dev, the key stays off the session's machine:** it's saved as a network secret on the `sideproj` cloud environment for the dev host, and the session's proxy adds the header (AR-09).
- **Plan → apply:** plan checks a change set and stores it (`admin_changes`, migration 0003), writing nothing else. Apply re-checks, refuses if anything differs from the reviewed plan, then runs every statement in one D1 `batch()` that starts with a guard statement. If the state changed in between, the guard fails and D1 rolls the whole batch back.
- **Covered now:** approve or decline requests, create groups, add, remove and reset people, fair-share setting. **Later (protocol 1.1):** archive and restore, once items exist.
- **Audit:** every change set is kept in `admin_changes`, without codes, PINs, hints or the key. `actor` is `admin-key`; with one shared key there's no per-person identity, which suits the single admin (FR-2.7).
- **Later:** admin screens (B-017) can sit behind Cloudflare Access (AD-04, AR-04) and call the same plan and apply endpoints.

### 6.10 URLs and link shortening
- The app uses `giftlist-dev.<account-subdomain>.workers.dev` (and later `giftlist-prod…`).
- **Using TinyURL for the app's home page is fine.**
- **Don't shorten invite links.** An invite link contains the group code, which is the only thing protecting a group (NFR-3). A shortener means:
  - a third party stores the code;
  - short links can be guessed or enumerated;
  - the code survives in the shortener after the group would have rotated it (B-002).

  Instead, the app's **Invite people** button shares the link through the phone's share menu.

- **Rule: invite links use the app's own short path, `/j/<GROUPCODE>` (FR-1.10).**
  - Format: `https://<app-host>/j/K7QM-4XTR`. The dash is optional and the code is case-insensitive. The code is normalised before lookup: uppercase, dash removed.
  - Routing: the Worker serves the single-page app for `/j/*`. The app reads the code from the path and opens the join screen with it filled in. The code is sent to the API only when the user submits the join form, through `POST /api/join`, so simply opening a link doesn't use up a join attempt.
  - An unknown code gives the same response as a wrong one, without revealing whether a group exists, and counts towards the rate limit.
  - The code is never written to logs. The path is logged as `/j/<redacted>`.
  - Third-party shorteners are **not** used for invite links. TinyURL and similar are fine for the app's home page only.

### 6.9 Observability
- Workers Logs: structured JSON logs. **No PINs, tokens or full product URLs in logs.**
- The nightly job logs how many items it deleted. Errors are logged with a request ID.

---

## 7. API outline

Every endpoint returns JSON. "M" means a member token is required for the group, and "A" means the admin key (ADR-17).

| Method and path | Auth | Purpose | FR |
|---|---|---|---|
| `GET /j/:code` | — | Serves the app. The app opens the join screen with the code filled in (no API call until the user submits). | 1.10 |
| `POST /api/join` | — | Join with a group code, display name and PIN, or claim a pending name | 1.3–1.4 |
| `POST /api/groups/lookup` | — | Group code → group ID and name, and member names (pending flagged), for the join and recovery screens. The ID lets the Join screen spot a browser that's already a member. Rate-limited. | 1.7, 2.2 |
| `POST /api/groups/hint` | — | Group code and display name → that joined member's PIN hint, or none. Same rate limits as lookup (G29). | 1.7 |
| `POST /api/recover` | — | Group code, display name and PIN → new token | 1.7 |
| `GET /api/me` | cookies | List my groups (for the group switcher) | 1.9 |
| `POST /api/group-requests` / `GET /api/group-requests/current` | — / request cookie | Submit a group request / check its status | 1.2 |
| `GET /api/groups/:id/version` | M | Lightweight "has anything changed?" check | 4.3 |
| `GET /api/groups/:id/dashboard` | M | Other members' items I'm allowed to see | 4.1 |
| `GET/POST/PATCH/DELETE /api/items…` | M (owner) | Manage my items: create, edit, soft delete, restore, permanent delete, re-add | 3, 7 |
| `POST/PATCH/DELETE /api/items/:id/links…` | M (owner) | Manage an item's links, up to the mode's limit | 3.1a |
| `POST /api/links/:id/autofill` | M (owner) | Auto-fill one link's details | 3.1b |
| `POST /api/items/:id/claim` / `DELETE …/claim` | M | Claim (with fair-share handling) / unclaim | 5, 6 |
| `PATCH /api/claims/:id` | M (claimer) | Mark purchased; clear the updated flag | 5.5, 5.7 |
| `GET /api/groups/:id/claimed` | M | My Claimed list, tombstones and fair-share nudges | 5.3, 6.5 |
| `DELETE /api/tombstones/:id` | M (claimer) | Dismiss a tombstone | 7.2 |
| `GET /api/admin/requests`, `/groups`, `/groups/:id`, `/changes` | A | Read: request queue, groups (with codes and invite links), one group's people and their states, audit log | 2 |
| `POST /api/admin/plan` | A | Check a change set and store the plan; writes nothing else | 2 |
| `POST /api/admin/apply` | A | Apply a reviewed plan, all or nothing, once only | 2 |

---

## 8. Repository layout (proposed)

Simplified to **one package** during setup (2026-11-21). The Cloudflare Vite plugin builds the web app and the Worker together, so separate workspaces weren't needed.
```
/docs                 brief, glossary, architecture, schema, trackers, ADRs
/src/worker           Worker: Hono routes, services, views, scheduled job
/src/web              React single-page app
/src/shared           Shared types and limits (G1–G17)
/migrations           D1 SQL migrations (0001_init.sql …)
/test                 Vitest: schema, API and view tests; /test/e2e for Playwright later
wrangler.jsonc        Worker config (local now; dev and prod environments added at AR-01)
```

---

## 9. Capacity and cost estimate

**Assumptions:** 100 groups with 15 members each on average. At holiday peak, 40% of members are active for 1 hour a day.

| Usage | Peak per day | Free limit | Paid included |
|---|---|---|---|
| Version checks (2 per minute while visible) | 600 members × 60 min × 2 = **72,000** | 100,000 requests a day, **shared with all other API calls** | 10 million a month |
| Other API calls | ~20,000 | (same) | (same) |
| **Total requests** | **~92,000** | ⚠️ ~92% of the daily cap | ✅ ~2.8 million a month at worst |
| D1 rows read | ~5 million | 5 million a day ⚠️ | 25 billion a month ✅ |
| D1 rows written | <10,000 | 100,000 a day ✅ | 50 million a month ✅ |
| Storage | <50 MB | 500 MB ✅ | 10 GB ✅ |

**Prod cost on Paid:** **$5 a month** at this scale, with no overage expected. A custom domain, if you want one, is about $10–$15 a year **[verify]** the current price.

---

## 10. Architecture decisions (ADR summary)

Each one has its own record in `docs/DECISIONS/` (AD-nn = ADR-nn). AD-12 covers the schema conventions.

| ID | Decision | Status |
|---|---|---|
| AD-01 | Cloudflare Workers, Static Assets and D1 as the platform | Proposed |
| AD-02 | Free plan for local and dev, which is the current account. **The TPM upgrades to Workers Paid before the first prod deploy.** This is a prod readiness gate. | **Accepted (A1)** |
| AD-03 | TypeScript, Hono, React + Vite, hand-written SQL, Vitest, Playwright | Proposed |
| AD-04 | Admin sign-in via **Cloudflare Access**. Fallback: our own admin secret | Accepted (A2), **superseded for now by AD-17** |
| AD-17 | Admin protocol (plan → review → apply) with an admin key; no admin screens yet | **Accepted (2026-11-21)** |
| AD-05 | PINs hashed with HMAC-SHA-256 and a secret pepper, not a slow hash | Proposed |
| AD-06 | Fair-share check is advisory and not in the same transaction as the claim. The claim itself is atomic via a unique index. NFR-9 updated to match. Exact version (Durable Object per group) is in backlog B-012 and tested in PR-003. | **Accepted (A3)** |
| AD-10 | URLs: free `*.workers.dev` addresses for dev and for now. No custom domain. Invite links use the app's own `/j/<code>` short path and are never sent through third-party shorteners (§6.10). | **Accepted (A4)** |
| AD-11 | The TPM owns the Cloudflare account. The engineer deploys to dev. Prod deploys need the TPM's go-ahead each time. | **Accepted (A5)** |
| AD-07 | Refresh with a lightweight version check, only while the tab is visible. No real-time connections in v1 | Proposed |
| AD-08 | Auto-fill runs in a separate request after saving, with the safety limits in §6.7 | Proposed |
| AD-09 | All responses built by one view-builder module, following glossary Part D | Proposed |

**Alternative considered:** Durable Objects, with one per group. These would put every change for a group in a strict order, so fair-share checks and claims could happen in one transaction. That would fix AD-06 exactly, but it adds a second storage model and more complexity. We can revisit it if PR-003 shows the warning race matters.

---

## 11. Access requests

None of these have been granted. **I won't use any of them until you approve each one.** Secrets would go through the secure credential form, never chat.

| ID | What | Why | When needed | Scope / risk |
|---|---|---|---|---|
| AR-01 | **Status: granted, and dev is live (2026-11-21):** https://giftlist-dev.mcjdonovan.workers.dev. The token is saved on the `sideproj` cloud environment; see `DEV_ENVIRONMENT.md` and ADR-16. **Earlier status: partly granted.** The TPM connected the Cloudflare connector (2026-11-21). It has been used only for read-only checks so far. Any create, change or deploy action still needs a go-ahead at the first dev deploy. **Original request:** a **Cloudflare account**, plus an **API token** limited to Workers Scripts (edit), D1 (edit) and Account Settings (read) for **dev** only | To deploy `giftlist-dev` and run D1 migrations | When we first deploy to dev, after local development is done | Owned by you. Token limited to dev resources if possible. **Not needed for local development or tests.** |
| AR-02 | **Status: granted 2026-11-21, under ADR-13's dependency policy.** **npm registry** in this container | To install packages: hono, react, vite, wrangler, vitest and `@cloudflare/vitest-pool-workers` | Start of coding | Public packages only. Usually allowed by default. |
| AR-03 | **Outbound HTTPS to retailer sites from this container** | To run the PR-002 auto-fill experiment with real product links | The PR-002 experiment | Read-only fetches to a list of retailer hosts that you approve. |
| AR-04 | **Deferred with the admin screens (B-017, ADR-17).** **Cloudflare Access (Zero Trust)** enabled on the account, with your email as the only allowed admin | Admin sign-in (AD-04) | When admin screens are built | Free plan. You do the setup in the dashboard, and I'll give you the steps. |
| AR-09 | **Status: approved by the TPM 2026-11-21 (option A); waiting for the TPM to set the key.** **Admin key for dev:** the TPM creates a random key of at least 32 characters, sets it as the Worker secret `ADMIN_KEY` on `giftlist-dev`, and saves the same key as a network secret on the `sideproj` cloud environment for host `giftlist-dev.mcjdonovan.workers.dev`, header `X-Admin-Key` | So this session can use the admin protocol on dev (ADR-17) | Now | The key is never in the repo, chat or command line. The engineer never sees it. Prod gets its own key at AR-07. |
| AR-05 | *(Optional)* custom domain on Cloudflare | Nicer URL than `*.workers.dev` | Before prod | Costs about $10–$15 a year. |
| AR-06 | *(Optional, later)* GitHub Actions running tests on pull requests | Automated checks before merging | After v1 is working | No secrets needed for tests. Deploys stay manual. |
| AR-08 | **shadcn/ui build packages** (ADR-15): tailwindcss 4.3.5, @tailwindcss/vite 4.3.5, radix-ui 1.8.1, class-variance-authority 0.7.1, clsx 2.1.1, tailwind-merge 3.7.0, lucide-react 1.70.0, sonner 2.0.8, input-otp 1.5.0, tw-animate-css 1.4.0 | To build the UI | Before the first screen is built | Checked 2026-11-21 without installing: compatible with React 19 and Vite 8, 0 known vulnerabilities, no install scripts, 111 packages including their dependencies. All at least 14 days old. **Awaiting TPM approval.** |
| AR-07 | **Prod deploy rights** | To deploy `giftlist-prod` | Only after the full review and your sign-off | Separate token. Granted per release, or you deploy yourself. |

---

## 12. Sources (Cloudflare docs, checked 2026-11-21)

- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- Workers pricing: https://developers.cloudflare.com/workers/platform/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
- D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- Workers Web Crypto: https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- Zero Trust account limits: https://developers.cloudflare.com/cloudflare-one/account-limits/

## 13. Open items for TPM

| # | Question | Engineer's recommendation |
|---|---|---|
| A1 | Which plan for prod (AD-02)? | **Decided:** Free for dev now. The TPM upgrades to Paid before prod. |
| A2 | Admin sign-in (AD-04)? | **Decided:** Cloudflare Access. **Revised 2026-11-21:** admin protocol with an admin key, no screens yet (ADR-17). |
| A3 | Is the fair-share race acceptable (AD-06)? | **Decided:** yes, using the simplest free option. The exact version is backlog B-012, tested in PR-003. |
| A4 | Custom domain, or `workers.dev` for v1? | **Decided:** `workers.dev`, using TinyURL for the home page if needed. Invite links use the `/j/` short path (§6.10). |
| A5 | Who owns the Cloudflare account and deploys? | **Decided:** as recommended. |
