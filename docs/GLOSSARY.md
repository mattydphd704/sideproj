# Glossary

The project's shared vocabulary. Every term used in the brief, architecture, schema, code and UI should match an entry here. When a term changes, update it here first.

| | |
|---|---|
| **Last updated** | 2026-11-21 (brief v0.6) |

## Roles and access

| Term | Definition |
|---|---|
| **Admin** | The single global operator (TPM) in v1. Per-group admins are in the backlog (B-001). The only person who creates groups in v1. Can add and delete members in any group and approve or decline group requests. Can also be a member. Signs in to a separate admin area with an admin credential. |
| **Member** | A person in a group, identified by a display name. A member has one list per group. |
| **Pending member** | A member the admin added by name who hasn't opened the app yet, so has no PIN set. The first person to open the group with that name sets the PIN. |
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
| **Expire lists** | An admin action that clears every list in a group while keeping the group, its members and their PINs. Used to reset between occasions. |
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
| **Removed by owner** | The state shown on a claimer's Claimed list when the owner deletes an item that was claimed. |

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
