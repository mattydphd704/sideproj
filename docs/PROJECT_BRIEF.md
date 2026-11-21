# Project Brief: Gift List Tracker (working title)

| | |
|---|---|
| **Status** | DRAFT v0.9, ready for TPM approval |
| **Last updated** | 2026-11-21 |
| **Phase** | Outline (no architecture or code yet) |

### Revision history
| Version | Change |
|---|---|
| v0.1 | First draft from the TPM's requirements. |
| v0.2 | Added the TPM's answers to Q1, Q2, Q4 and Q5: claims hidden from the owner, PIN recovery, operator-only group creation, admin scope. Added new follow-up questions Q19 to Q23. |
| v0.3 | Q20 and Q21 resolved. Proposed an in-app group request flow with no email (Q19). Added invite links. TPM is reviewing the remaining defaults one by one. |
| v0.4 | Q19, Q3, Q6, Q7 resolved. Q8: item modes (Exact product / Giver's choice), multiple links per item and auto-fill (a spike, PR-002). Q9: partial claims tracked as PR-001. Q10: claim, unclaim and purchased. Q11: claims kept and changes flagged. Created `GLOSSARY.md` and `PR_TRACKER.md`. |
| v0.5 | Q12, Q13, Q14, Q22, Q23, Q24, Q25 resolved. Created `BACKLOG.md`. |
| v0.6 | Q15, Q16, Q18, Q26 resolved. Added the admin "expire lists" action and unlimited item stars. Nothing blocks architecture except TPM approval. |
| v0.7 | Added fair-share alerts (FR-6). Replaced "expire lists" with soft delete, permanent delete and archive (FR-7). Groups and PINs persist. Auto-archive after 12 months. Q27 resolved. New questions Q28 to Q31. |
| v0.8 | FR-6 marked as initial logic to be tuned in test (PR-003). The admin can restore archived lists using archive metadata. Q27 to Q30 resolved. Auto-archive (Q31) moved to the backlog (B-011). Created `BUGS.md`. |
| v0.9 | Glossary field decisions G1 to G11 applied. Giver's choice items have up to 5 links. Each group has a currency. |

## 1. Problem

Groups of people, such as families or friends, swap gifts. Each person wants to share a wish list. Everyone else wants to see what is still available and avoid buying the same gift twice. Existing tools make people sign up for accounts, which is a barrier for casual, occasional use.

## 2. Goal for v1

A web-hosted app where a group shares gift lists and coordinates who buys what. No sign-up or login. A shared **group code** grants access, and the browser remembers who you are. A personal PIN is used only to recover your identity on a new device.

## 3. Roles

| Role | Description |
|---|---|
| **Admin (operator)** | The TPM. The only person who can create groups in v1. Can add and delete members in any group, and can be a member of a group with their own list. Signs in to a separate admin area with a secret admin credential. |
| **Member** | Joins a group by entering its group code, a display name and a PIN. Can see every other member of the group by name. |
| **Visitor** | Someone without a group code. Can submit a "Create new group" request for the admin to handle. |

## 4. Functional requirements

### FR-1: Groups and access
- FR-1.1: Only the admin creates groups. Creating a group generates its **group code**.
- FR-1.2: **Group request flow (confirmed). Everything happens in the app.**
  1. A visitor chooses **"Create new group"** and enters a group name, their display name and a PIN. This is the same set-up as joining, so the requester is fully set up as the group's first member.
  2. Their browser shows a **"Waiting for approval"** screen and checks back automatically. The visitor doesn't need to do anything else.
  3. The request appears in the admin's queue. The admin chooses **Approve** or **Decline**.
  4. On approval, the requester's browser moves straight into the new group on their next visit, or immediately if the page is open. The requester never handles a code.
  5. Inside every group, an **"Invite people"** button shares a join link that has the group code built in, using the phone's share menu or copy-to-clipboard. Recipients tap the link, enter a name and PIN, and they're in. Typing the code by hand still works as a fallback.
  - The app sends no email and collects no contact details.
- FR-1.3: Anyone with a group code can join that group.
- FR-1.4: On joining, the member enters a **display name** and creates a **PIN**.
- FR-1.5: The browser (cookie or local storage) remembers the member, so they don't need to enter their PIN on normal visits.
- FR-1.6: The PIN screen tells the user something like: *"You won't need this PIN every time. You'll only need it if you open your list on another device or after clearing your browser's cookies or cache."*
- FR-1.7: **Recovery:** On a new device, a member enters the group code, picks their name and enters their PIN to restore their identity.
- FR-1.8: Members can see the names of all other members of their group.
- FR-1.9: **Multiple groups.** One browser can belong to several groups. The member can see all their groups and switch between them. Each group has its own separate lists, claims and PIN.

### FR-2: Admin
- FR-2.1: The admin can create groups. A group's name is set at creation.
- FR-2.2: The admin can **manually add** members to a group by name. An added member shows as **pending** until someone opens the group with that name and sets its PIN. After that, the PIN is required to take over that name.
- FR-2.3: The admin can **delete** members from a group. The member's items are deleted, and any claims they made are released, so those items become available again.
- FR-2.4: The admin can approve or decline "Create new group" requests from a queue.
- FR-2.5: The admin can also be an ordinary member of a group, with their own list and claims.
- FR-2.6: The admin can reset a member's PIN, for example if they've forgotten it.
- FR-2.8: **Archive lists.** The admin can archive every list in a group at once, and **restore** an archive. See FR-7.3 and FR-7.4.
- FR-2.9: **Groups and PINs persist indefinitely in v1.** Lifecycle rules are in the backlog (B-010).
- FR-2.7: v1 has a single global admin. Per-group admins are in the backlog (B-001).
- Not in v1: rotating a group code, renaming a group, deleting a group from the UI. These are in `BACKLOG.md`.

### FR-3: My list
- FR-3.1: Each member has **one ongoing list per group**, with no occasions or events. A member can add gift items to their own list. Each item includes a link to a specific product.
- FR-3.1a: **Item mode.** When adding an item (e.g. "Camera"), the owner chooses:
  - **Exact product**: "Get me this specific product." Allows **one** product link *or* one product description.
  - **Giver's choice**: "Pick one you like. Here are some examples." Allows **up to 5** reference links.
- FR-3.1b: **Auto-fill.** When a link is added, the app fills in as many product details as it can, such as product name, price, size, colour and image. The owner can edit them. If auto-fill fails, the owner can still save the item and enter details by hand. *Scope is set by the PR-002 spike, and the field list is tracked in `GLOSSARY.md`.*
- FR-3.2: For each item, the owner chooses its visibility: **everyone in the group**, or **only specific members**. Members an item is hidden from see **nothing** of it, not even a placeholder.
- FR-3.3: A member can edit and delete their own items.
- FR-3.5: **Stars.** A member can star any number of their items to mark them as most important. Other members see the star. The dashboard may sort starred items first.
- FR-3.4: **The owner never sees claim information about their own items:** not whether an item is claimed, nor who claimed it. *(Confirmed by TPM.)*

### FR-4: Group dashboard
- FR-4.1: One dashboard shows every other member's visible items, grouped by member.
- FR-4.2: The UI is simple.
- FR-4.3: The dashboard refreshes automatically about every 30 seconds, and whenever the page regains focus.

### FR-5: Claiming
- FR-5.1: A member can claim an available item on another member's list, to buy or reserve it.
- FR-5.2: A claimed item appears **greyed out** to other viewers (never to its owner), along with the name of the member who claimed it.
- FR-5.3: A claimed item is added to the claimer's **"Claimed" list**, sorted by recipient name.
- FR-5.4: A claimer can **unclaim** an item, which makes it available again.
- FR-5.5: A claimer can mark a claimed item as **purchased**. Only the claimer can see this flag. Other members see only "Claimed by <name>", and the recipient sees nothing.
- FR-5.6: One claim per item in v1. Partial claims for items with a quantity are being tested separately as **PR-001**.
- FR-5.7: If the owner **edits** a claimed item, the claim stays and the claimer sees an **updated** flag. If the owner **deletes** a claimed item, see FR-7.
- FR-5.8: **Only joined members take part.** Pending members, who were added by the admin but have never visited, have no list and can't be chosen as recipients. They also can't be picked in an item's "only specific members" visibility, and they don't count towards fair share.

### FR-6: Fair-share alerts
The goal is to stop one member from claiming most of a person's list and leaving nothing for everyone else.

> **Status: ships in v1 as initial logic, to be refined.** We'll test it as scenario **PR-003** in the test environment and tune it there. The threshold settings are configurable rather than hard-coded, so we can adjust the logic without a schema change.

- FR-6.1: **Waiting givers.** For a recipient R, these are the members of R's group who could give to R but haven't claimed anything for R yet. That excludes R and the current claimer. Only **joined** members count. A pending member who has never visited is neither a giver nor a recipient (see FR-5.8).
- FR-6.2: **Available items.** These are R's items that are unclaimed, not deleted and not archived.
- FR-6.3: **Floating threshold.** A claim **breaches fair share** if, once it's made, either of these is true:
  - **(a)** the number of available items is less than the number of waiting givers, multiplied by a buffer (default **1.0**, a setting the admin can change); or
  - **(b)** any waiting giver would have **no** available items they're allowed to see, because of item visibility.

  The threshold floats: it's recalculated from the current list size, group size and claims every time it's checked. *Example: Sam has 6 items and 4 other members. Alex has claimed 2 and the other 3 haven't claimed anything. If Alex claims a 3rd item, 3 items are left for 3 waiting givers, which is fine. If Alex claims a 4th, 2 items are left for 3 givers, which breaches fair share and triggers the alert.*
- FR-6.4: **Alert on claim.** Before a claim that breaches fair share goes through, the claimer sees a warning, for example: *"You've claimed 4 of Sam's 6 items. 3 other people haven't picked anything for Sam yet. Consider leaving more for them."* The claimer can **Claim anyway** or **Cancel**. This is a warning, not a block. The check runs on **every** claim, so each further claim that still breaches fair share shows the warning again. Choosing "Claim anyway" doesn't silence later warnings.
- FR-6.5: **Ongoing nudge.** While the condition holds, the claimer's Claimed list shows a banner on that recipient's section suggesting they release some claims, with an **Unclaim** button on each item. The condition can start holding later, for example when a new member joins, the owner deletes items, or someone else claims.
- FR-6.6: The surprise rule still applies. The recipient never sees fair-share information.

### FR-7: Deleting, archiving and restoring items
*"The list is the list."* Members never delete their whole list. They manage individual items.

- FR-7.1: **Soft delete.** When the owner deletes an item:
  - For the owner, it moves to a **Deleted** section at the bottom of their list, greyed out, for up to **90 days**. The owner can **Restore** it to the active list, or **Permanently delete** it.
  - For other members, it shows greyed out and flagged **"Deleted by owner"**, and can't be claimed.
  - An existing claim **stays** and is flagged **"Deleted by owner"** on the claimer's Claimed list. If the owner restores the item, the claim is still there, and the owner still can't see it.
- FR-7.2: **Permanent delete** happens when the owner chooses it, or automatically after 90 days in Deleted. *Recommended logic:*
  - The item disappears from the owner's list and from every other member's dashboard.
  - **No claim:** the item, its links and its visibility settings are removed completely.
  - **Has a claim:** the claimer keeps a read-only **tombstone** on their Claimed list, made of the item title and recipient, marked *"No longer on Sam's list"*. They may already have bought it. The claimer can **Dismiss** it. All other item data, including links, is removed.
  - It can't be undone.
- FR-7.3: **Archive.** When the admin archives a group's lists, every current item in every list in that group, deleted ones included, moves to an **Archived** section. Each archive is recorded as an **archive batch**: its date, who ran it, and each item's state beforehand (active or deleted, plus any days left in its 90-day deleted period).
  - Members see these items labelled **"Archived"**. They're read-only and can't be claimed.
  - Lists stay in place and members keep adding new items as usual.
  - Claims on archived items are frozen, and they appear under "Archived" on the claimer's Claimed list.
  - An owner can **Re-add** an archived item to their active list as a fresh, unclaimed copy.
  - The 90-day deletion clock **pauses** while an item is archived. The scheduled deletion job ignores archived items.
- FR-7.4: **Restore archive.** The admin can restore an archive batch for a group. Every item in the batch goes back to its state before archiving: active items to the active list, deleted items to Deleted with their remaining days, and claims reattached. When there are several batches, the admin chooses one by date.
  - *Edge case, to test:* If the owner already re-added a copy, restoring creates a duplicate. In v1 both are kept, and the owner can delete one.
- *Auto-archive is not in v1. It's in the backlog (B-011) and will be applied retroactively later.*
- FR-7.5: How long claimed items, tombstones and archived items are kept is decided later (B-009).

## 5. Non-functional requirements

- NFR-1: Works on mobile and desktop browsers (responsive layout).
- NFR-2: Two members can't claim the same item at once: the claim operation must be atomic.
- NFR-3: Group codes are hard to guess. The app rate-limits attempts to join with a code.
- NFR-4: **PIN security.** PINs are 4 to 6 digits, stored only as salted hashes, never in plain text. After 5 wrong attempts, recovery for that member locks for 15 minutes.
- NFR-5: **Server-side enforcement.** Claim data is never sent to an item's owner, and restricted items are never sent to members they're hidden from. Hiding them in the UI is not enough.
- NFR-6: The app stores as little personal data as possible: display names, item details and links only. No email addresses, phone numbers or passwords.
- NFR-7: The admin area is protected by a secret credential that is separate from member PINs.
- NFR-9: Fair-share checks and claims run in the same database transaction, so the warning reflects the true state at the moment of claiming.
- NFR-10: A scheduled job permanently deletes items once their 90 days in Deleted are up. It skips archived items and is idempotent: running it twice has the same effect as running it once.
- NFR-11: Archive and restore each run as a single transaction, so a group is never left half-archived.
- NFR-8: Separate dev/test and prod environments. Nothing is deployed to prod without TPM sign-off.

## 6. Out of scope for v1

- User accounts, passwords, email or social login for members
- Groups created by members themselves (members can only request one)
- Rotating group codes, renaming groups, deleting groups from the UI
- Email or push notifications
- Group gifts where several members split one item (but see PR-001 for partial claims)
- Payment or purchase integration with retailers
- Native mobile apps

## 7. Key technical implication

"No back-end user management" does **not** mean "no back end". Lists and claims must be shared across many people's devices, so the app needs a **server-side datastore**. What we drop is accounts. Each member's identity is an anonymous token stored in their browser, with a PIN as the recovery key.

## 8. Open questions

### Resolved

| # | Question | Decision |
|---|---|---|
| Q1 | Can the owner see claims on their own items? | **No.** All claim information is hidden from the owner. |
| Q2 | How does a member recover their identity? | **The member creates a PIN when they join.** They only need it on a new device or after clearing cookies. |
| Q4 | What can the admin do? | **Add members, delete members, and be a member themselves.** |
| Q5 | Who can create groups? | **Only the admin (TPM).** Visitors can submit a "Create new group" request for the admin to handle. |
| Q20 | How does a member added by the admin set their PIN? | **On their first visit.** They show as "pending" until then. |
| Q21 | What happens to a deleted member's data? | **Their items are deleted, and their claims are released.** |
| Q19 | How does a group requester get access, with no email? | **In-app approval flow plus invite links** (FR-1.2). |
| Q3 | Is a hosted server and database acceptable? | **Yes.** |
| Q6 | Can one browser belong to several groups? | **Yes.** The member sees all their groups and can switch between them. |
| Q7 | Occasion-based lists or one ongoing list? | **One ongoing list** per member per group. |
| Q8 | Item fields? | **Exact product and Giver's choice modes, multiple links, auto-fill.** The auto-fill spike is PR-002, and fields are tracked in `GLOSSARY.md`. |
| Q9 | Partial claims? | **To be tested separately as PR-001.** One claim per item in the meantime. |
| Q10 | Unclaim and purchased? | **Claim, unclaim and mark as purchased.** |
| Q11 | Owner edits or deletes a claimed item? | **The claim stays, and the claimer sees the change flagged.** Deletion is covered in FR-7. |
| Q12 | Duplicate display names? | **Must be unique within a group.** |
| Q14 | Dashboard freshness? | **Auto-refresh about every 30 seconds and when the page regains focus.** Claims are conflict-safe. |
| Q13 | What do members an item is hidden from see? | **Nothing.** The item is fully hidden. |
| Q22 | Per-group admins? | **Moved to the backlog (B-001).** v1 has a single global admin. |
| Q23 | PIN format? | **4 to 6 digits. 5 wrong attempts locks recovery for 15 minutes. The admin can reset a PIN.** |
| Q24 | Who sees the purchased flag? | **Only the claimer.** |
| Q15 | Can members suggest gifts for others? | **Moved to the backlog (B-008).** |
| Q16 | Expected scale? | **Small: fewer than 100 groups, fewer than 50 members each.** |
| Q18 | How long is data kept? | **Groups and PINs persist.** The admin can archive lists, and lists auto-archive after 12 months. Cleanup rules are in the backlog (B-009, B-010). |
| Q27 | Delete or archive? | **Soft delete for 90 days, then permanent delete with a tombstone for claimers. Archive is a separate action** (FR-7). Agreed by TPM. |
| Q28 | Do pending members count? | **No.** Only joined members can be recipients, givers or visibility targets (FR-5.8). |
| Q29 | Fair-share alert: warning or block? | **Warning, on every claim that breaches fair share.** The logic will be tuned in test (PR-003). |
| Q30 | Can owners re-add archived items? | **Yes**, to their active list as a fresh copy. |
| Q31 | When does the auto-archive clock start? | **Not in v1.** Moved to the backlog (B-011) and to be applied retroactively later. |
| Q26 | Item priority? | **Stars.** A member can star as many items as they want. |
| Q25 | What does "PR" mean? | **Both.** Each candidate feature gets a PR-nnn ID in `PR_TRACKER.md` and is delivered as its own GitHub pull request, linked from the tracker. The engineer opens a pull request only when the TPM asks. |

### Remaining open items

| # | Question | Engineer's assumption, pending TPM confirmation |
|---|---|---|
| Q17 | Stack, hosting, budget, domain, timeline? | The engineer proposes options in `ARCHITECTURE.md`, sized for small scale (Q16). |

## 9. Success criteria for v1

1. The admin can create a group and share the code in under a minute.
2. A new member can join and add their first item in under two minutes, with no account.
3. A member can recover their identity on a second device using their name and PIN.
4. No two members can claim the same item, including under simultaneous clicks.
5. A list's owner never receives claim information about their own items. This is verified at the API level.
6. Restricted items are never sent to members they're hidden from. This is verified at the API level.
7. A claim that breaches fair share always shows the warning, including in tests with mixed item visibility.
8. Soft-deleted items can be restored within 90 days and are permanently deleted after that, with tombstones kept for claimers.
9. Archiving and then restoring a group returns every item and claim to exactly its state before archiving.
10. Everything passes in dev/test, then gets TPM review, before any prod deploy.

## 10. Next steps

1. TPM **approves this brief**. Q17 (stack and hosting) is answered in the architecture doc.
2. Engineer drafts `ARCHITECTURE.md`, including stack and hosting options for Q17, and any access requests.
3. Engineer drafts `DATA_SCHEMA.md`, then `DECISIONS/` and `CHANGELOG.md`. Bugs are tracked in `docs/BUGS.md`.
4. No code until the TPM has approved the architecture and schema.
