# Admin Protocol: `giftlist-admin/1`

| | |
|---|---|
| **Status** | v1.0, approved by TPM (option A, 2026-11-21). Built and tested locally (ADM-01 to ADM-17). |
| **Last updated** | 2026-11-21 |
| **Decision** | [ADR-17](DECISIONS/ADR-17.md): admin work goes through this protocol, protected by an admin key. No admin screens for now (backlog B-017). |
| **Code** | `src/worker/admin/protocol.ts` (plan and apply), `src/worker/routes/admin.ts` (endpoints and key check), `scripts/admin.mjs` (command line), `migrations/0003_admin_changes.sql` (audit log) |
| **Tests** | `test/api/admin.test.ts`; see TEST_PLAN §2.10 |

This is how the admin (the TPM) **reviews, approves and builds groups and the people in them** without any admin screens. You say what you want in the Claude session; the engineer turns it into a **change set**, the server **plans** it and shows exactly what would happen, you **review** it, and nothing changes until you say **apply**.

```
 TPM (chat) ──▶ engineer writes a change set ──▶ PLAN (server checks it; writes nothing)
                                                      │
                                 TPM reviews the plan ◀┘
                                                      │ "apply"
                                                      ▼
            APPLY (all of it or none of it; refused if anything changed since the plan)
                                                      │
                                                      ▼
                       Audit log (admin_changes) + new groups' codes and invite links
```

---

## 1. Rules

| # | Rule |
|---|---|
| AP-1 | **Reading never changes anything.** `requests`, `groups`, `group` and `changes` can be run at any time. |
| AP-2 | **Every change goes through plan → review → apply.** There is no way to change data without a stored, reviewed plan. |
| AP-3 | **Apply runs exactly what was reviewed.** Apply takes only the change set's ID and the plan's ID. The server re-checks the stored operations and refuses (`plan_stale`) if the result would differ in any way from the plan you saw. |
| AP-4 | **All or nothing.** Every operation in a change set runs in one D1 `batch()`, which is one transaction. The batch starts with a guard statement that fails if anything changed between the checks and the batch, which rolls the whole batch back. |
| AP-5 | **Once only.** A change set ID can be applied once. Applying it again returns the first result (`replayed: true`) and changes nothing. A used change set ID can't be planned again. |
| AP-6 | **Plans expire after 24 hours.** Plan again to get a fresh one. Planning the same change set ID again replaces the earlier plan (`plan_superseded` for the old one). |
| AP-7 | **Strict checking.** Unknown operations, unknown fields, bad references and out-of-range values are refused when planning, with the exact place (e.g. `ops[2].currency`). |
| AP-8 | **Groups are named by ID, never by code.** A group's code is the only thing protecting it (NFR-3), so codes never appear in change sets, the audit log or logs. They're returned only by `groups`, `group` and `apply`, and the engineer passes them to you in chat. |
| AP-9 | **Requests need an `expect` guard.** Approving or declining names the request's group name and requester, so a mistyped ID can't act on the wrong request. |
| AP-10 | **Fail closed.** Without an admin key of at least 32 characters configured on the server, every admin endpoint answers `503 admin_disabled`. |

---

## 2. Authentication: the admin key
- Every `/api/admin/*` call needs the header **`X-Admin-Key`**, matching the Worker secret **`ADMIN_KEY`**. Each environment has its own key.
- Wrong or missing key → `401 admin_unauthorized`. **10 wrong keys from one network in 15 minutes** block that network for the rest of the window (`429`), even with the right key.
- **On dev, the key never touches this session's machine.** The TPM saves it twice: as the `ADMIN_KEY` secret on the `giftlist-dev` Worker, and as a network secret on the `sideproj` cloud environment for host `giftlist-dev.mcjdonovan.workers.dev`, header `X-Admin-Key`. The session's proxy adds the header to requests to that host. The key is never in the repo, the chat or a command line. (AR-09)
- Locally, the key comes from `.dev.vars` (`ADMIN_KEY`, see `.dev.vars.example`); it's a placeholder, not a secret.
- The key is compared by hashing both sides (constant time) and is never logged.
- Admin calls also send `X-Giftlist-Client: 1`, like every other request that changes data (CSRF rule, architecture §6.1).

---

## 3. Reading

| Command | Endpoint | Returns |
|---|---|---|
| `requests [pending\|approved\|declined\|all]` | `GET /api/admin/requests?status=` | Group requests (default: pending): ID, group name, requester, currency, status, when sent and decided. No PIN data. |
| `groups` | `GET /api/admin/groups` | Every group: ID, name, **code**, **invite link**, currency, how it was created, joined and not-joined-yet counts. |
| `group <groupId>` | `GET /api/admin/groups/:id` | One group (code, invite link, currency, fair-share setting) and everyone in it with their **state**: `joined`, `not_joined_yet`, `locked` (with the time it ends), or `pin_reset_waiting`, plus who added them, whether they have a hint, how many devices are signed in, and when they joined and were last seen. |
| `changes` | `GET /api/admin/changes` | The audit log: the last 50 change sets, their status and step summaries. |

---

## 4. Change sets

```json
{
  "protocol": "giftlist-admin/1",
  "changeId": "2026-11-21-jones",
  "note": "Set up the Jones family",
  "ops": [
    { "op": "request.approve", "requestId": "…", "expect": { "groupName": "Pat's Family", "requester": "Pat" }, "ref": "pat" },
    { "op": "member.add", "group": "@pat", "names": ["Robin"] },
    { "op": "group.create", "ref": "jones", "name": "Jones Family", "currency": "USD" },
    { "op": "member.add", "group": "@jones", "names": ["Grandma", "Uncle Ray"] },
    { "op": "member.resetPin", "group": "<groupId>", "name": "Jo" },
    { "op": "member.remove", "group": "<groupId>", "name": "Sam" },
    { "op": "group.setFairShare", "group": "<groupId>", "buffer": 1.5 }
  ]
}
```

| Field | Rule |
|---|---|
| `protocol` | Must be `giftlist-admin/1`. |
| `changeId` | 1–64 letters, numbers, dots, dashes or underscores. Chosen by the engineer, e.g. `2026-11-21-jones`. Used once. |
| `note` | Optional, up to 200 characters. Shown in the audit log. |
| `ops` | 1 to 50 operations, run in order. |
| `group` | A group's ID (from `groups`), or `@ref` for a group created earlier in the same change set. |
| `ref` | Optional on `group.create` and `request.approve`: 1–30 lowercase letters, numbers or dashes, unique in the change set. |

### 4.1 Operations

| Operation | Fields | What it does | Refused when |
|---|---|---|---|
| `request.approve` | `requestId`, `expect {groupName, requester}`, `ref?` | Creates the group (`created_via = 'request'`) with the requester as its first **joined** member, using the PIN and hint they chose. Their waiting screen moves them in automatically (FR-1.2). | Request not found, not pending, already used in this change set, or `expect` doesn't match |
| `request.decline` | `requestId`, `expect` | Marks the request declined; the requester's waiting screen shows "Your request wasn't approved". | Same as approve |
| `group.create` | `name`, `currency`, `ref?`, `fairShareBuffer?` | Creates a group (`created_via = 'admin'`) with a new code (G2). | Name empty or over 60 characters; currency not 3 letters. *A duplicate name is allowed, with a warning (G35).* |
| `member.add` | `group`, `names` (1–50) | Adds each person as **not joined yet** (`pending`, FR-2.2). The first person to choose that name on the Join screen sets its PIN. | A name is over 30 characters, is listed twice, or is already used in the group (ignoring case) |
| `member.remove` | `group`, `name` | FR-2.3, schema §4.5: deletes their items (with links and visibility), gives everyone who had claimed one of those items a "no longer on the list" note (tombstone), releases their own claims (`claimer_removed`), signs them out everywhere, and marks them `removed` with PIN and hint cleared. Their name can be used again (G12 interim). | Nobody with that name; the group was created in this change set. *Warns if nobody who has joined would be left.* |
| `member.resetPin` | `group`, `name` | FR-2.6, G5: clears the PIN and hint, **lifts any lock**, signs them out on every device. The next PIN they enter on the Join screen becomes the new one (G25). | The person hasn't joined yet (no PIN to reset). *Warns if the PIN was already reset.* |
| `group.setFairShare` | `group`, `buffer` | Sets the group's fair-share buffer (FR-6.3, G3). | Not a number from **0.5 to 3** (G36) |
| *`group.archive`, `group.restore`* | | *Planned for when items exist (Sections 2–4), as protocol version 1.1.* | |

Every change to an existing group increases its `version` once, so members' screens refresh (ADR-07).

---

## 5. Plan

`POST /api/admin/plan` with the change set as the body.

**Success (200):** the plan is stored in the audit log as `planned`.
```json
{
  "ok": true, "changeId": "2026-11-21-jones", "planId": "WJxFZPC3CT-4RKCM2se7lw", "expiresAt": "2026-11-22T23:46:00.000Z",
  "steps": [
    { "index": 0, "op": "group.create", "summary": "+ Create group \"Jones Family\" (USD); its code is made when applied" },
    { "index": 1, "op": "member.add", "summary": "+ Add Grandma and Uncle Ray to new group \"Jones Family\" (not joined yet; each sets a PIN on their first visit)" },
    { "index": 2, "op": "member.remove", "summary": "− Remove Sam from \"Smith Family\": deletes 4 items, releases 2 claims Sam made, leaves 1 \"no longer on the list\" note for people who claimed Sam's items, signs Sam out on 2 devices. Their name can be used again." }
  ],
  "warnings": []
}
```

**Problems (422 `plan_invalid`):** nothing is stored. `errors` lists each problem by operation index, and `steps` shows the operations that were fine.

**Step symbols:** `+` adds, `−` removes, `✓` approves, `✗` declines, `↺` resets, `⚖` changes a setting. Warnings start with `!`.

**What the plan records (its basis):** the `version` of every existing group it touches, and the status of every request it decides. Apply compares against these.

---

## 6. Apply

`POST /api/admin/apply` with `{ "changeId": "…", "planId": "…" }`.

**Success (200):**
```json
{
  "applied": true, "replayed": false, "changeId": "2026-11-21-jones", "appliedAt": "2026-11-21T23:47:00.000Z",
  "steps": ["+ Create group \"Jones Family\" (USD); its code is made when applied", "…"],
  "newGroups": [{ "id": "…", "name": "Jones Family", "code": "K7QM-4XTR", "inviteUrl": "https://giftlist-dev.mcjdonovan.workers.dev/j/K7QM-4XTR" }]
}
```

| Result | Meaning | What to do |
|---|---|---|
| `200` | Applied, or `replayed: true` if it had already been applied (same result, nothing changed again) | Share the new groups' invite links |
| `404 no_plan` | No plan with that change set ID | Plan it first |
| `409 plan_stale` | Something changed since the plan (someone joined, a request was decided, a member changed). **Nothing was applied.** | Plan again and review the new plan |
| `409 plan_superseded` | The change set was planned again since this plan | Apply the newest plan |
| `409 plan_expired` | The plan is over 24 hours old | Plan again |
| `409 already_applied` | The change set was applied from a different plan | Use a new change set ID |

**How "all or nothing" works:**
1. Apply re-runs the checks on the stored operations and compares the result with the reviewed plan and its basis. Any difference → `plan_stale`.
2. It builds one D1 `batch()`. The **first statement is a guard**: it marks the change set `applied` only if the change set is still `planned` with this plan ID and every group version and request status still matches the basis. Otherwise it writes `NULL` into a `NOT NULL` column, which fails the batch, and D1 rolls back every statement in it.
3. So a change that lands between step 1 and step 2, or a second apply racing the first, can't half-apply anything.

---

## 7. Audit log (`admin_changes`, migration 0003)

| Column | Holds |
|---|---|
| `id` | The change set ID |
| `note` | The change set's note |
| `ops_json` | The operations exactly as planned (groups by ID) |
| `plan_id`, `plan_json` | The current plan's ID and its step summaries, as reviewed |
| `basis_json` | Group versions and request statuses the plan was based on |
| `status` | `planned` or `applied` |
| `actor` | `admin-key` (ADR-17) |
| `planned_at`, `applied_at` | Times (Unix ms) |
| `result_json` | Step summaries and the IDs of new groups. **Never codes, PINs, hints or the key** (test ADM-14). |

Change set files are working files in the session's scratchpad, **not committed** to the repo (G37); the audit log is the record.

---

## 8. Using it from the Claude session

You don't need to write JSON. A typical exchange:

1. **You:** "Who's waiting for a group?" → engineer runs `requests` and lists them.
2. **You:** "Approve Pat's, and add Robin to it. Also make a Jones Family group in USD with Grandma and Uncle Ray." → engineer writes the change set and runs `plan`, then shows you the steps and any warnings.
3. **You:** "Apply." → engineer runs `apply` and gives you each new group's code and invite link.

Command line, for reference (`--env dev` is the default; `--json` prints the raw response):
```bash
npm run admin -- requests
```
```bash
npm run admin -- groups
```
```bash
npm run admin -- group <groupId>
```
```bash
npm run admin -- plan path/to/changeset.json
```
```bash
npm run admin -- apply <changeId> <planId>
```
```bash
npm run admin -- changes
```

---

## 9. Versioning
The `protocol` field names the version. Additive changes (new operations, such as `group.archive` and `group.restore`) become `giftlist-admin/1.1` and keep accepting `/1` change sets. Anything that changes the meaning of an existing operation needs a new major version and an ADR.
