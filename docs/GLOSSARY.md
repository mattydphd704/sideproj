# Glossary

The project's shared vocabulary. Every term used in the brief, architecture, schema, code and UI should match an entry here. When a term changes, update it here first.

| | |
|---|---|
| **Last updated** | 2026-11-21 (brief v0.8) |

## Roles and access

| Term | Definition |
|---|---|
| **Admin** | The single global operator (TPM) in v1. Per-group admins are in the backlog (B-001). The only person who creates groups in v1. Can add and delete members in any group and approve or decline group requests. Can also be a member. Signs in to a separate admin area with an admin credential. |
| **Member** | A person in a group, identified by a display name. A member has one list per group. |
| **Pending member** | A member the admin added by name who hasn't opened the app yet, so has no PIN set. The first person to open the group with that name sets the PIN. Until then, they have no list and can't be a recipient, a giver or a visibility target. |
| **Joined member** | A member who has visited and set a PIN. Only joined members take part in lists, claims and fair share. |
| **Visitor** | Someone using the app who isn't a member of any group. |
| **Display name** | A member's name as shown to the group. Must be unique within a group. |
| **PIN** | A 4 to 6 digit code a member creates when joining. It's used only to recover their identity on a new device or after clearing browser data. Stored as a salted hash. |
| **Member token** | A random secret stored in the browser that identifies the member on later visits, so they don't have to enter a PIN. There is one per group membership. |
| **Recovery** | Restoring a member's identity on a new browser by choosing the group, picking their display name and entering their PIN. |

## Groups

| Term | Definition |
|---|---|
| **Group** | A set of members who share lists with each other, such as a family. |
| **Group code** | A hard-to-guess code that lets someone join a group. |
| **Invite link** | A URL with the group code built in, shared from inside a group. Opening it starts the join flow. |
| **Group request** | A visitor's request for a new group. It holds the group name the requester wants, plus their display name and PIN. It's approved or declined by the admin. |
| **Request status** | The state of a group request: `pending`, `approved` or `declined`. |
| **Group switcher** | The UI control that lists every group the browser belongs to and moves between them. |

## Lists and items

| Term | Definition |
|---|---|
| **List** | A member's single, ongoing wish list within a group. |
| **Item** | One thing a member wants, such as "Camera". An item has one or more product links, depending on its mode. |
| **Item mode** | How specific the owner wants the gift to be. One of: |
| ↳ **Exact product** | The giver should buy exactly this product. Allows **one** product link *or* a product description. |
| ↳ **Giver's choice** | The giver picks something that fits. Allows **several** reference links as examples. |
| **Product link** | A URL attached to an item, plus product details that the app fills in from the URL where it can. |
| **Auto-fill** | The app reads a product link and pre-fills details such as product name, price, size and colour. The owner can then edit them. *Scope and method are subject to a test spike: see "Item fields" below.* |
| **Visibility** | Who can see an item: **everyone** in the group, or **only specific members**. Members an item is hidden from see nothing of it, not even a placeholder, and the server never sends it to them. |
| **Star** | A marker an owner puts on an item to show it's important to them. Any number of items can be starred. |
| **Active list** | The live part of a member's list: items that aren't deleted or archived. |
| **Deleted (soft delete)** | An item the owner has deleted. It's greyed out at the bottom of the owner's list for up to 90 days and can be restored. Other members see it flagged "Deleted by owner" and can't claim it. |
| **Deleted by owner** | The flag other members, and the claimer, see on a soft-deleted item. Replaces the earlier "Removed by owner". |
| **Restore** | Moving a soft-deleted item back to the active list. Any existing claim is kept. |
| **Permanent delete** | Removing an item for good, either by the owner or automatically after 90 days in Deleted. Can't be undone. |
| **Tombstone** | What's left on a claimer's Claimed list after a claimed item is permanently deleted: the title and recipient, marked "No longer on <name>'s list". The claimer can dismiss it. |
| **Archive / Archived** | Moving every current item in a group's lists into a read-only, unclaimable "Archived" section. Done by the admin, or automatically. Lists stay in place for new items. |
| **Archive batch** | The record of one archive: its date, who ran it, and each item's state beforehand. Used to restore the archive. |
| **Restore archive** | An admin action that returns every item in an archive batch, and its claims, to the state it was in before archiving. |
| **Auto-archive** | *(Backlog B-011, not in v1.)* Archiving that happens automatically after 12 months. |
| **Re-add** | Creating a fresh, unclaimed copy of an archived item on the owner's active list. |
| **Dashboard** | The main view: every other member's visible items, grouped by member. |

## Claims

| Term | Definition |
|---|---|
| **Claim** | A member reserving another member's item to give it to them. One item can have only one active claim *(partial claims are being tested separately, see PR-001)*. |
| **Claimer** | The member who claimed an item. |
| **Recipient** | The owner of a claimed item, meaning the person receiving the gift. |
| **Unclaim** | The claimer releasing a claim, which makes the item available again. |
| **Purchased** | A flag the claimer sets on their claim to record that they've bought the gift. Visible **only to the claimer**. |
| **Claimed list** | A member's view of everything they've claimed, sorted by recipient name. |
| **Greyed out** | How a claimed item appears to other members, along with the claimer's name. Never shown to the recipient. |
| **Surprise rule** | An item's owner never receives any claim information about it. The server enforces this. |
| **Updated flag** | A marker shown to the claimer when the owner edits an item after it was claimed. |
| **Fair share** | The rule that one member shouldn't claim so many of a person's items that others have nothing left to give that person. |
| **Waiting giver** | For a recipient, a joined member of the group (not the recipient and not the claimer) who hasn't claimed anything for that recipient yet. |
| **Available item** | An item that is unclaimed, not deleted and not archived. |
| **Fair-share threshold** | A floating limit that's breached when the available items number fewer than waiting givers × buffer, or when any waiting giver has no available item they're allowed to see. |
| **Fair-share buffer** | The multiplier in the threshold. Defaults to 1.0, and the admin can change it. The fair-share logic is initial and will be tuned in test (PR-003). |
| **Fair-share alert** | The warning shown before **every** claim that breaches the threshold, with "Claim anyway" or "Cancel". |
| **Fair-share nudge** | The banner on a claimer's Claimed list while they're over the threshold for a recipient, suggesting they unclaim some items. |

## Item fields (working list, to be refined by the auto-fill test spike)

These are the fields we expect to capture or auto-fill for each **product link**. The spike will show which fields matter for which product categories. Update this table with the results.

| Field | Required | Source | Notes |
|---|---|---|---|
| `url` | Yes (or `description`) | User | In Exact product mode, either a URL or a description is allowed. |
| `description` | Yes (or `url`) | User | Free-text product description, for when there's no link. |
| `product_name` | No | Auto-fill, editable | |
| `price` | No | Auto-fill, editable | Plus currency. |
| `image_url` | No | Auto-fill | |
| `retailer` | No | Auto-fill | Derived from the domain. |
| `size` | No | Auto-fill, editable | Relevance depends on category, e.g. clothing or shoes. |
| `color` | No | Auto-fill, editable | |
| `notes` | No | User | Anything else, e.g. "any colour except pink". |

Item-level fields (on the item, not each link): `title` (required), `mode`, `visibility`, `starred` (true or false).

## Process

| Term | Definition |
|---|---|
| **PR-nnn** | A candidate feature with an ID in `docs/PR_TRACKER.md`. Each one is built and tested as its own scenario and delivered as its own GitHub pull request, linked from the tracker. |
| **Dev/test** | Where all building and testing happen. |
| **Prod** | The live environment. Deploying to it requires full TPM review and sign-off. |
| **Spike** | A short, time-boxed experiment to answer a technical question before we commit to a design. |
