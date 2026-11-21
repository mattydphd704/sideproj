# Glossary

The project's shared vocabulary and field catalogue. Every term used in the brief, architecture, schema, code and UI should match an entry here. When a term or field changes, update it here first. `DATA_SCHEMA.md` will be built from Part B.

| | |
|---|---|
| **Last updated** | 2026-11-21 (glossary rev 5: admin protocol, ADR-17) |
| **Status** | Reviewed by TPM. Part E decisions applied. |

**Key:**
- **FR-x / NFR-x**: the requirement in `PROJECT_BRIEF.md`.
- **B-xxx**: an item in `BACKLOG.md`.
- **PR-xxx**: an item in `PR_TRACKER.md`.

---

# Part A: Terms

## A1. People and roles

| Term | Definition | Ref |
|---|---|---|
| **Admin** | The single global operator (the TPM) in v1. Creates groups, approves or declines group requests, adds and deletes members, resets PINs, and archives or restores lists. Can also be a member of any group. Works through the **admin protocol** with the **admin key** (ADR-17); there are no admin screens yet (B-017). Per-group admins are in the backlog (B-001). | FR-2 |
| **Visitor** | Someone using the app who isn't a member of any group. A visitor can join with a code or invite link, or submit a group request. | FR-1 |
| **Requester** | A visitor who has submitted a group request. Once the request is approved, they become the new group's first joined member. | FR-1.2 |
| **Member** | A person in a group, identified by their display name. Has exactly one list per group. One person can be a member of several groups. | FR-1 |
| **Pending member** | A member the admin added by name who hasn't visited yet, so has no PIN. They have no list and can't be a recipient, a giver or a visibility target. The first person to open the group and pick that name sets the PIN. | FR-2.2, FR-5.8 |
| **Joined member** | A member who has visited and set a PIN. Only joined members take part in lists, claims and fair share. | FR-5.8 |
| **Owner** | The member whose list an item is on. | FR-3 |
| **Claimer** | The member who claimed an item. | FR-5 |
| **Recipient** | The owner of an item, seen from a giver's side: the person receiving the gift. | FR-5 |
| **Giver** | Any joined member other than the recipient, who could claim the recipient's items. | FR-6 |

## A2. Identity and access

| Term | Definition | Ref |
|---|---|---|
| **Display name** | A member's name as shown to the group. Must be unique within a group, ignoring upper and lower case. | FR-1.3, Q12 |
| **PIN** | A 4-digit code a member creates when joining, shown as they type it. It's needed only for **recovery**, not on normal visits. Stored only as a salted hash. | FR-1.4, NFR-4 |
| **PIN hint** | An optional reminder a member writes when creating their PIN: up to 40 characters, and it must not contain the PIN. Shown on Sign back in only after they pick their name and tap "Show my hint". Cleared by an admin PIN reset. | FR-1.4, G29 |
| **PIN lockout** | After 5 wrong PIN attempts, recovery for that member is locked for 15 minutes. | NFR-4 |
| **PIN reset** | The admin clears a member's PIN. The member sets a new one on their next recovery. | FR-2.6 |
| **Member token** | A random secret stored in the browser that identifies a member on later visits. Each browser or device has its own token, and one member can have several. | FR-1.5 |
| **Recovery** | Restoring a member's identity in a new browser, on the Join screen: choose your own name in the dropdown and enter only your PIN. After a wrong PIN: "I don't have a PIN yet" / "I can't remember my PIN". A new member token is issued. | FR-1.7 |
| **"Is that you?" check** | When a new person types a name already in the group, the Join screen asks whether it's them. Yes leads to that person's PIN; No asks for a distinguishing name (e.g. "Alex B"). | FR-1.11 |
| **Admin area** | *Deferred (B-017).* Admin screens, which would sit behind Cloudflare Access. Until then the admin uses the admin protocol. | FR-2 |
| **Admin credential** | The secret that proves a request comes from the admin. Separate from any member PIN. In v1 this is the **admin key**. | NFR-7 |
| **Admin key** | The admin credential in v1: a secret of at least 32 characters, one per environment, held by the Worker as the secret `ADMIN_KEY` and sent in the `X-Admin-Key` header. Never in the repo, the chat, a command line or the database. Without it, admin endpoints are off. | NFR-7, ADR-17 |
| **Admin protocol** | `giftlist-admin/1`: how the admin reads and changes groups and members without screens. Every change goes plan → review → apply. See `ADMIN_PROTOCOL.md`. | FR-2, ADR-17 |
| **Change set** | One batch of admin operations (e.g. approve a request, create a group, add people), with a `changeId` used once and an optional note. Groups are named by ID, never by code. | ADR-17 |
| **Operation** | One step in a change set: `request.approve`, `request.decline`, `group.create`, `member.add`, `member.remove`, `member.resetPin` or `group.setFairShare`. | ADR-17 |
| **Plan** | The server's check of a change set: what each operation would do, in plain words, plus warnings or errors. Writes nothing except the stored plan. Valid for 24 hours. | ADR-17 |
| **Plan basis** | The state a plan was made against: the version of each group it touches and the status of each request it decides. If either changes, the plan is stale. | ADR-17 |
| **Apply** | Running a reviewed plan: exactly what was reviewed, all or nothing, once only. Refused if the plan is stale, superseded or expired. | ADR-17 |
| **Audit log** | The `admin_changes` table: every change set, its plan, when it was applied and its result. Never holds codes, PINs, hints or the key. | ADR-17 |
| **Surprise rule** | An item's owner never receives any claim information about their own items: whether they're claimed, who claimed them, whether they're purchased, or anything about fair share. The **server** enforces this. | FR-3.4, NFR-5 |

## A3. Groups

| Term | Definition | Ref |
|---|---|---|
| **Group** | A set of members who share lists with each other, such as a family. Groups persist indefinitely in v1 (B-010). | FR-1 |
| **Group name** | The group's human-readable name, such as "Smith Family". | FR-2.1 |
| **Group code** | A hard-to-guess code that lets someone join a group. | FR-1.1, NFR-3 |
| **Invite link** | A URL with the group code built in, in the format `https://<app-host>/j/<GROUPCODE>`. It's shared from inside a group using the phone's share menu or copy-to-clipboard. Opening it starts the join flow with the code already filled in. Never sent through a third-party URL shortener. | FR-1.2, FR-1.10 |
| **Short path (`/j/`)** | The app's own short URL prefix for invite links. It accepts the code with or without the dash, in any case. | FR-1.10 |
| **Group request** | A visitor's request for a new group. It includes the group name they want, plus their own display name and PIN. The admin approves or declines it. | FR-1.2 |
| **Waiting for approval** | The screen a requester sees while their request is pending. It checks back automatically. | FR-1.2 |
| **Group switcher** | The UI control that lists every group this browser belongs to and moves between them. | FR-1.9 |
| **Dashboard** | The main view inside a group: every other member's items that the viewer is allowed to see, grouped by member. Refreshes automatically about every 30 seconds and when the page regains focus. | FR-4 |

## A4. Lists and items

| Term | Definition | Ref |
|---|---|---|
| **List** | A member's single, ongoing wish list within a group. *"The list is the list"*: a list is never deleted as a whole. A list has three sections: **Active**, **Deleted** and **Archived**. | FR-3.1, FR-7 |
| **Active list** | The live section of a list: items that aren't deleted or archived. | FR-7 |
| **Item** | One thing a member wants, such as "Camera". An item has one or more product links, depending on its mode. | FR-3 |
| **Item mode** | How specific the owner wants the gift to be. Either **Exact product** or **Giver's choice**. | FR-3.1a |
| ↳ **Exact product** | "Get me this specific product." Allows exactly **one** product link, which can be a URL or a description. | FR-3.1a |
| ↳ **Giver's choice** | "Pick one you like. Here are some examples." Allows **up to 5** reference links. | FR-3.1a |
| **Product link** | One URL or product description attached to an item, with product details that are filled in automatically or entered by hand. | FR-3.1a |
| **Auto-fill** | The app reads a product link and pre-fills product details. The owner can edit anything it fills in. Saving the item never waits for auto-fill. The method and fields are being worked out in an experiment, PR-002. | FR-3.1b |
| **Visibility** | Who can see an item: **Everyone** in the group, or **Only specific members**, chosen from the joined members. Members an item is hidden from see nothing of it, not even a placeholder. | FR-3.2, Q13 |
| **Star** | A marker an owner puts on an item to show it's important to them. Any number of items can be starred. Visible to everyone who can see the item. | FR-3.5 |
| **Item status** | Where an item is in its lifecycle: `active`, `deleted` or `archived`. See C1. | FR-7 |
| **Delete (soft delete)** | The owner removes an item from the active list. It goes to the Deleted section, greyed out, for up to **90 days**. Other members see it flagged **"Deleted by owner"** and can't claim it. Any claim on it stays. | FR-7.1 |
| **Restore (item)** | Moving a soft-deleted item back to the active list. Any claim on it is kept, and the surprise rule still applies. | FR-7.1 |
| **Permanent delete** | Removing an item for good, either because the owner chooses to or automatically after 90 days in Deleted. It disappears for everyone. Can't be undone. | FR-7.2 |
| **Tombstone** | What a claimer keeps after an item they'd claimed is permanently deleted: the item's title and the recipient's name, marked *"No longer on <name>'s list"*. The claimer can dismiss it. | FR-7.2 |
| **Archive** | The admin moves every current item in all of a group's lists, including deleted ones, into the read-only, unclaimable Archived section. Lists stay in place for new items. Admin only in v1. | FR-7.3 |
| **Archive batch** | The record of one archive: its date, who ran it, and each item's state beforehand. Used to restore the archive. | FR-7.3 |
| **Restore archive** | An admin action that puts every item in an archive batch, and every claim on those items, back exactly as it was before archiving. Deleted items return with the days they had left. | FR-7.4 |
| **Re-add** | The owner copies an archived item to their active list as a fresh, unclaimed item. | FR-7.3, Q30 |
| **Auto-archive** | *(Backlog B-011, not in v1.)* Archiving that happens automatically after 12 months. | B-011 |

## A5. Claims

| Term | Definition | Ref |
|---|---|---|
| **Claim** | A member reserving another member's item to give it to them. An item has at most one active claim *(partial claims are being tested as PR-001)*. | FR-5 |
| **Unclaim** | The claimer releasing a claim, which makes the item available again. | FR-5.4 |
| **Purchased** | A flag the claimer sets on their claim to record that they've bought the gift. Visible **only to the claimer**. | FR-5.5, Q24 |
| **Claimed list** | A member's view of everything they've claimed, grouped and sorted by recipient name. Has sections for active claims, archived claims and tombstones. | FR-5.3 |
| **Greyed out** | How a claimed or soft-deleted item appears to members other than its owner. Claimed items also show "Claimed by <name>". | FR-5.2 |
| **Updated flag** | A marker shown to the claimer when the owner edits an item after it was claimed. It clears once the claimer has seen it. | FR-5.7 |
| **Deleted by owner** | The flag that other members, and the claimer, see on a soft-deleted item. | FR-7.1 |
| **Available item** | An item that is active, unclaimed and not deleted or archived. | FR-6.2 |

## A6. Fair share (initial logic, to be tuned in test: PR-003)

| Term | Definition | Ref |
|---|---|---|
| **Fair share** | The rule that one member shouldn't claim so many of a person's items that others have nothing left to give that person. | FR-6 |
| **Waiting giver** | For a recipient, a joined member who isn't the recipient or the current claimer and hasn't claimed anything for that recipient yet. | FR-6.1 |
| **Fair-share threshold** | A limit that's recalculated on every claim. A claim breaches it if, once the claim is made: **(a)** the available items number fewer than waiting givers × buffer, or **(b)** any waiting giver has no available item they're allowed to see. | FR-6.3 |
| **Fair-share buffer** | The multiplier in rule (a). Defaults to 1.0, and the admin can change it. | FR-6.3 |
| **Fair-share alert** | A warning shown before **every** claim that breaches the threshold, with **Claim anyway** or **Cancel**. It's a warning, not a block, and it's **advisory**: near-simultaneous claims can occasionally skip it (NFR-9, B-012). | FR-6.4, Q29 |
| **Fair-share nudge** | A banner on the claimer's Claimed list, for a recipient they're over the threshold for, suggesting they unclaim some items. | FR-6.5 |

## A7. Process and environments

| Term | Definition |
|---|---|
| **PR-nnn** | A candidate feature tracked in `PR_TRACKER.md`. Each one is built and tested as its own scenario and delivered as its own GitHub pull request. |
| **B-nnn** | A deferred item tracked in `BACKLOG.md`. |
| **BUG-nnn** | A defect tracked in `BUGS.md`. |
| **Dev/test** | The environments where all building and testing happen. |
| **Prod** | The live environment. Deploying to it requires a full review and TPM sign-off. |
| **Spike** | A short, time-boxed experiment to answer a technical question before we commit to a design. |
| **AP-n** | A rule of the admin protocol (`ADMIN_PROTOCOL.md` §1). |

---

# Part B: Field catalogue

These are **logical** fields, meaning the information we need to capture, not the final database columns. `DATA_SCHEMA.md` will turn them into tables, types and indexes.

**Columns:**
- **Set by:** who or what provides the value. `User` is the person entering it, `System` is generated by the app, `Auto-fill` is extracted from a link, `Admin` is set by the admin.
- **Visible to:** who can ever receive the value from the server. This is how the surprise rule and visibility rules are enforced.

## B1. Group

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `group_id` | id | Yes | System | Internal | | |
| `name` | text | Yes | Admin, or Requester through a request | Members, Admin | 1–60 characters (G1). | FR-2.1 |
| `group_code` | text | Yes | System | Members, Admin | 8 characters from an alphabet without look-alike characters, shown as `XXXX-XXXX` (G2). Unique. Join attempts are rate-limited. | NFR-3 |
| `fair_share_buffer` | decimal | Yes | Admin | Admin | Default 1.0. Set per group. | FR-6.3, G3 |
| `currency` | ISO 4217 code | Yes | Admin, or Requester through a request | Members, Admin | Chosen when the group is created. Used when auto-fill doesn't find a currency. | G9 |
| `created_at` | timestamp | Yes | System | Admin | | |
| `created_by` | ref → Admin or Group request | Yes | System | Admin | Shows whether the admin created the group directly or approved a request. | FR-1.2 |
| `last_archived_at` | timestamp | No | System | Admin | Kept so auto-archive (B-011) can be applied retroactively later. | B-011 |

## B2. Member

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `member_id` | id | Yes | System | Internal | | |
| `group_id` | ref → Group | Yes | System | Internal | | |
| `display_name` | text | Yes | User, or Admin when adding | Members, Admin | 1–30 characters (G4). Unique within the group, ignoring upper and lower case. Leading and trailing spaces are removed. | Q12 |
| `status` | enum | Yes | System | Members, Admin | `pending` or `joined`. See C2. | FR-5.8 |
| `pin_hash` | hash | Once joined | User (hashed by System) | **Never sent anywhere** | 4 digits before hashing, stored with a salt. Empty while pending, or after a PIN reset. | NFR-4 |
| `pin_hint` | text | No | User | **Only to someone who picks that name on Sign back in** (via "Show my hint") | Up to 40 characters; must not contain the PIN; cleared on PIN reset. | G29 |
| `failed_pin_attempts` | integer | Yes | System | Internal | Goes back to 0 after a successful recovery. | NFR-4 |
| `locked_until` | timestamp | No | System | Internal | Set after the 5th wrong attempt, to now + 15 minutes. | NFR-4 |
| `is_admin` | boolean | Yes | System | Internal | True when this membership belongs to the admin. | FR-2.5 |
| `added_by` | enum | Yes | System | Admin | `self` (joined with a code or link), `admin` (added by hand) or `request` (the requester of an approved group request). | FR-2.2 |
| `joined_at` | timestamp | No | System | Admin | When the PIN was first set. | |
| `last_seen_at` | timestamp | No | System | Admin | | |
| `created_at` | timestamp | Yes | System | Admin | | |

## B3. Member token (one per browser or device)

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `token_hash` | hash | Yes | System | **Never sent anywhere** | The browser holds the raw token in a cookie. The server stores only its hash. | FR-1.5 |
| `member_id` | ref → Member | Yes | System | Internal | | |
| `created_at` / `last_used_at` | timestamp | Yes | System | Internal | | |
| `revoked_at` | timestamp | No | System | Internal | Set when the member is deleted, and on a PIN reset, which signs the member out everywhere (G5). | FR-2.6 |

## B4. Group request

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `request_id` | id | Yes | System | Internal | | |
| `requested_group_name` | text | Yes | Requester | Admin, Requester | Same rules as the group's `name`. | FR-1.2 |
| `requested_currency` | ISO 4217 code | Yes | Requester | Admin, Requester | Becomes the group's `currency` when the request is approved. | G9 |
| `requester_display_name` | text | Yes | Requester | Admin, Requester | Same rules as `display_name`. | FR-1.2 |
| `requester_pin_hash` | hash | Yes | Requester (hashed) | **Never sent anywhere** | Moved to the new member when the request is approved. | FR-1.2 |
| `requester_pin_hint` | text | No | Requester | Nobody until approval | Moved to the new member when the request is approved. | G29 |
| `request_token_hash` | hash | Yes | System | **Never sent anywhere** | Lets the requester's browser check its status and move into the group automatically. | FR-1.2 |
| `status` | enum | Yes | System, Admin | Admin, Requester | `pending`, `approved` or `declined`. See C5. | FR-1.2 |
| `created_at` / `decided_at` | timestamp | Yes / No | System | Admin | | |
| `group_id` | ref → Group | When approved | System | Internal | The group created by approving the request. | |

## B5. Item

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `item_id` | id | Yes | System | Internal | | |
| `owner_member_id` | ref → Member | Yes | System | Viewers of the item | The owner must be a joined member. | FR-5.8 |
| `title` | text | Yes | User | Viewers of the item | 1–100 characters (G6), e.g. "Camera". | FR-3.1 |
| `mode` | enum | Yes | User | Viewers of the item | `exact_product` or `givers_choice`. | FR-3.1a |
| `notes` | text | No | User | Viewers of the item | Item-level notes, e.g. "any brand, under $300". Up to 500 characters. | G7 |
| `visibility` | enum | Yes | User | Owner | `everyone` or `specific_members`. Default `everyone`. | FR-3.2 |
| `visible_to` | list of refs → Member | If `specific_members` | User | **Owner only** | At least one joined member, never the owner. Other viewers aren't told who else can see the item. | FR-3.2, Q13 |
| `starred` | boolean | Yes | User | Viewers of the item | Default false. | FR-3.5 |
| `status` | enum | Yes | System | Viewers of the item | `active`, `deleted` or `archived`. See C1. | FR-7 |
| `deleted_at` | timestamp | When deleted | System | Owner | Starts the 90-day countdown. | FR-7.1 |
| `archive_batch_id` | ref → Archive batch | When archived | System | Internal | | FR-7.3 |
| `readded_from_item_id` | ref → Item | No | System | Internal | Set on an item copied by Re-add. Lets us spot duplicates after Restore archive. | FR-7.4 |
| `created_at` | timestamp | Yes | System | Viewers of the item | | |
| `content_updated_at` | timestamp | Yes | System | Internal | Changes only when the item's content, or one of its product links, is edited. Drives the claimer's updated flag. | FR-5.7 |

"Viewers of the item" means the owner, plus the joined members the item's visibility allows.

## B6. Product link

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `link_id` | id | Yes | System | Internal | | |
| `item_id` | ref → Item | Yes | System | Internal | | |
| `position` | integer | Yes | System | Viewers of the item | The display order. | |
| `url` | URL | Either `url` or `description` | User | Viewers of the item | Only `http` or `https` links. Up to 2,000 characters. | FR-3.1a |
| `description` | text | Either `url` or `description` | User | Viewers of the item | For a product with no link. Up to 500 characters (G11). | FR-3.1a |
| `product_name` | text | No | Auto-fill, editable | Viewers of the item | | FR-3.1b |
| `price` | integer, in the currency's smallest unit (e.g. cents) | No | Auto-fill, editable | Viewers of the item | Stored as a whole number so totals are exact: $19.99 is stored as `1999` (G16). | FR-3.1b |
| `currency` | ISO 4217 code | If `price` is set | Auto-fill, editable | Viewers of the item | The price's **own** currency, shown as-is with no conversion. The group's `currency` is used only when none is found (G9, G16). | FR-3.1b |
| `image_url` | URL | No | Auto-fill | Viewers of the item | | FR-3.1b |
| `retailer` | text | No | Auto-fill | Viewers of the item | Taken from the link's domain. | FR-3.1b |
| `size` | text | No | Auto-fill, editable | Viewers of the item | Matters more for some product categories, e.g. clothing. | FR-3.1b |
| `color` | text | No | Auto-fill, editable | Viewers of the item | | FR-3.1b |
| `notes` | text | No | User | Viewers of the item | Notes about this one link, e.g. "the 64 GB version". | |
| `autofill_status` | enum | Yes | System | Owner | `not_applicable`, `pending`, `succeeded`, `partial` or `failed`. | FR-3.1b |
| `autofill_fetched_at` | timestamp | No | System | Internal | | |
| `user_edited_fields` | list | No | System | Internal | Fields the owner has overridden, so a later auto-fill never overwrites them. | FR-3.1b |

**Rules by item mode:**
- **Exact product:** exactly **1** link, which has either a `url` or a `description`.
- **Giver's choice:** 1 to **5** links (G8). Each link has a `url` or a `description`.

The auto-fill experiment (PR-002) will confirm which detail fields matter for each product category.

## B7. Claim

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `claim_id` | id | Yes | System | Internal | | |
| `item_id` | ref → Item | Yes | System | **Never the owner** | At most one active claim per item, enforced by the database. | FR-5, NFR-2 |
| `claimer_member_id` | ref → Member | Yes | System | Joined members who can see the item, **except the owner** | Shown as "Claimed by <name>". | FR-5.2, FR-3.4 |
| `status` | enum | Yes | System | Claimer | `active`, `frozen` (the item is archived) or `released`. See C3. | FR-5.4, FR-7.3 |
| `purchased` | boolean | Yes | Claimer | **Claimer only** | Default false. | FR-5.5, Q24 |
| `purchased_at` | timestamp | No | System | Claimer only | | |
| `claimed_at` | timestamp | Yes | System | Claimer | | |
| `released_at` | timestamp | No | System | Internal | Kept for history, never shown (G10). | FR-5.4 |
| `last_seen_item_version_at` | timestamp | Yes | System | Internal | When the updated flag was last cleared. The flag shows while this is earlier than the item's `content_updated_at`. | FR-5.7 |
| `fair_share_override` | boolean | Yes | System | Internal | True if the claimer chose "Claim anyway". Used to tune fair share in PR-003. | FR-6.4 |

## B8. Tombstone

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `tombstone_id` | id | Yes | System | Internal | | |
| `claimer_member_id` | ref → Member | Yes | System | Claimer only | | FR-7.2 |
| `recipient_name_snapshot` | text | Yes | System | Claimer only | A copy of the recipient's display name at the time of deletion. | FR-7.2 |
| `item_title_snapshot` | text | Yes | System | Claimer only | A copy of the item title at the time of deletion. | FR-7.2 |
| `was_purchased` | boolean | Yes | System | Claimer only | Copied from the claim. | FR-7.2 |
| `created_at` / `dismissed_at` | timestamp | Yes / No | System | Claimer | How long tombstones are kept is decided later (B-009). | B-009 |

## B9. Archive batch

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `archive_batch_id` | id | Yes | System | Admin | | FR-7.3 |
| `group_id` | ref → Group | Yes | System | Admin | | |
| `archived_at` / `archived_by` | timestamp / ref → Admin | Yes | System | Admin | Members see the date as "Archived <date>". | FR-7.3 |
| `restored_at` / `restored_by` | timestamp / ref → Admin | No | System | Admin | Empty until the batch is restored. | FR-7.4 |
| *Per item, recorded at archive time:* `item_id`, `prior_status` (`active` or `deleted`), `deleted_days_remaining` | | Yes | System | Internal | Restore archive puts each item back to its `prior_status`. `deleted_days_remaining` freezes the 90-day countdown while archived. It's stored here rather than on the item (schema §3.5). | FR-7.4 |

## B10. Settings and admin

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `ADMIN_KEY` *(Worker secret, replaces `admin_credential_hash`)* | secret | Yes, for admin | TPM | **Never sent anywhere** | At least 32 characters, one per environment. Not stored in the database. Rotated by setting a new Worker secret and network secret. | NFR-7, ADR-17 |
| `soft_delete_days` | integer | Yes | Config | Internal | 90. A setting, not hard-coded. | FR-7.1 |
| `pin_max_attempts` / `pin_lockout_minutes` | integer | Yes | Config | Internal | 5 / 15. | NFR-4 |
| `dashboard_refresh_seconds` | integer | Yes | Config | Internal | 30. | FR-4.3 |
| `fair_share_buffer_default` | decimal | Yes | Config | Internal | 1.0. Used when a new group is created. | FR-6.3 |

---

## B11. Admin change (audit log)
One row per change set (`admin_changes`, migration 0003).

| Field | Type | Req'd | Set by | Visible to | Rules and notes | Ref |
|---|---|---|---|---|---|---|
| `id` | text | Yes | Admin | Admin | The `changeId`: 1–64 letters, numbers, dots, dashes, underscores. Used once. | AP-5 |
| `note` | text | No | Admin | Admin | Up to 200 characters. | |
| `ops_json` | JSON | Yes | Admin | Admin | The operations as planned. Groups by ID, never by code. | AP-8 |
| `plan_id` / `plan_json` | id / JSON | Yes | System | Admin | The current plan and its step summaries, as reviewed. Replaced if planned again. | AP-3, AP-6 |
| `basis_json` | JSON | Yes | System | Internal | Group versions and request statuses the plan was based on. | AP-3 |
| `status` | enum | Yes | System | Admin | `planned` or `applied`. See C6. | |
| `actor` | text | Yes | System | Admin | `admin-key` in v1. | ADR-17 |
| `planned_at` / `applied_at` | timestamp | Yes / No | System | Admin | | |
| `result_json` | JSON | When applied | System | Admin | Step summaries and new group IDs. Never codes, PINs, hints or the key. | AP-8 |

---

# Part C: Status lifecycles

### C1. Item status
```
            delete                 permanent delete (owner, or 90 days)
  active ──────────► deleted ─────────────────────────────► (gone; claimer gets a tombstone if claimed)
     ▲    ◄──────────    │
     │     restore       │
     │ archive           │ archive
     ▼                   ▼
  archived (prior_status=active)    archived (prior_status=deleted, countdown frozen)
     │ restore archive → returns to its prior_status
     └─ re-add → a NEW active item (no claim)
```

### C2. Member status
`pending` (added by the admin) → `joined` (PIN set on first visit) → *deleted by the admin* (items deleted, claims released, tokens revoked).
A member who joins with a code or invite link is created directly as `joined`.

### C3. Claim status
`active` ⇄ `frozen` (when the item is archived, and back again when the archive is restored)
`active` → `released` (the claimer unclaims, or the claimer is deleted by the admin)
`active` or `frozen` → *tombstone* (when the item is permanently deleted)
`purchased` is a separate true-or-false flag that can be set on an `active` or `frozen` claim.

### C4. Auto-fill status
`not_applicable` (description only) · `pending` → `succeeded` / `partial` / `failed`

### C5. Group request status
`pending` → `approved` (the group is created and the requester becomes its first joined member) / `declined`

### C6. Admin change status
`planned` (stored for review; replaced if planned again; expires after 24 hours) → `applied` (final; applying again returns the same result).

---

# Part D: What each viewer sees for an item

The server builds each response from this table. Nothing outside a viewer's column is ever sent to them.

| Item state | Owner sees | Claimer sees | Other members who can see the item | Members the item is hidden from |
|---|---|---|---|---|
| Active, unclaimed | Normal | — | Normal, with a **Claim** button | Nothing |
| Active, claimed | Normal *(no claim info)* | On their Claimed list, with their private **Purchased** toggle | Greyed out, "Claimed by <name>" | Nothing |
| Edited after a claim | Normal | **Updated** flag | Greyed out, "Claimed by <name>" | Nothing |
| Deleted (soft) | Deleted section, greyed out, with **Restore** and **Permanently delete** | "Deleted by owner" | Greyed out, "Deleted by owner", can't be claimed | Nothing |
| Permanently deleted | Gone | Tombstone: "No longer on <name>'s list" | Gone | Nothing |
| Archived | Archived section, with **Re-add** | Archived section of their Claimed list | "Archived", can't be claimed | Nothing |

---

# Part E: Decisions log

The TPM confirmed these field-level decisions on 2026-11-21.

| # | Point | Decision |
|---|---|---|
| G1 | Maximum length of a group name | 60 characters |
| G2 | Group code format | 8 characters without look-alike characters (no O/0 or I/1), shown as `XXXX-XXXX` |
| G3 | Fair-share buffer scope | Per group, defaulting to 1.0 |
| G4 | Maximum length of a display name | 30 characters |
| G5 | PIN reset | Signs the member out on all their devices |
| G6 | Maximum length of an item title | 100 characters |
| G7 | Item-level notes | Yes, up to 500 characters, separate from each link's notes |
| G8 | Maximum links on a Giver's choice item | **5** (the TPM changed this from the proposed 10) |
| G9 | Fallback currency | One currency per group, set when the group is created |
| G10 | History of released claims | Kept internally and never shown |
| G11 | Maximum length of a product description | 500 characters |

| G12 | Removed members' records | Backlog B-013. Interim: keep, marked `removed` |
| G13 | Items left with no viewers | Backlog B-014. Interim: owner only |
| G14 | Claim history when an item is permanently deleted | Deleted with the item. The tombstone remains. |
| G15 | Join rate limits | 10 per IP address per 15 minutes; 30 per group code per hour |
| G16 | Price storage | Whole number of the smallest unit, plus the price's own currency code. Shown without conversion. Group currency is the fallback. |
| G17 | `http://` links | Saved, but never auto-filled |
| G29 | PIN hint | Optional, up to 40 characters, can't contain the PIN, shown on request on Sign back in, cleared by a PIN reset (TPM UI review round 1) |
| G30 | Extra protection for 4-digit PINs | *Pending TPM:* after 3 lockouts in 24 hours, lock until the organiser resets the PIN |
| G31 | Keep the "Already here" names line on the Join screen | *Pending TPM:* keep it |
| G34 | Admin screens in v1 | **Not now** (TPM, 2026-11-21). Admin work goes through the admin protocol with an admin key (ADR-17). Screens and Cloudflare Access move to backlog B-017. |
| G35 | Two groups with the same name | Allowed. Codes and IDs keep them apart; planning warns. |
| G36 | Range of the fair-share buffer | 0.5 to 3, set per group with `group.setFairShare` (or when creating the group). |
| G37 | Are change set files kept in the repo? | No. They're working files; the audit log in the database is the record. They name people, and the repo isn't the place for that. |
