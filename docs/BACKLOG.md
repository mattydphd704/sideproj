# Backlog

Ideas and features deliberately deferred past v1. Moving an item into scope requires TPM approval. When an item is promoted, it either gets a PR-nnn entry in `PR_TRACKER.md` or is added to the brief.

| | |
|---|---|
| **Last updated** | 2026-11-21 |

| ID | Item | Source | Notes |
|---|---|---|---|
| B-001 | **Per-group admins.** The global admin delegates admin rights for one group, e.g. "make my sister admin of her group". | Brief Q22 | v1 has a single global admin. The v1 data model won't block this. |
| B-002 | Rotate a group's code, e.g. if it leaks. | Brief Q4 (not selected for v1) | |
| B-003 | Rename a group, or delete a group, from the UI. | Brief Q4 (not selected for v1) | In v1, the admin does this by hand if needed. |
| B-004 | Email or push notifications. | Brief §6 | |
| B-005 | Real-time dashboard updates. | Brief Q14 | v1 auto-refreshes about every 30 seconds. |
| B-006 | Payment or purchase integration with retailers. | Brief §6 | |
| B-007 | Native mobile apps. | Brief §6 | |
| B-009 | **Retention and cleanup.** How long claimed items, tombstones and archived items are kept. | TPM, brief v0.7 | Deferred on purpose. |
| B-010 | **Group and PIN lifecycle.** In v1, groups and PINs persist indefinitely. Revisit expiry, PIN rotation and inactive groups. | TPM, brief v0.7 | TPM flagged that this will need changing. |
| B-011 | **Auto-archive** a group's lists after 12 months. The clock basis is still to be decided. | Brief Q31 | Not in v1. Will be applied retroactively to existing groups, so the v1 archive batches must keep their dates. |
| B-012 | **Exact fair-share check.** Run the fair-share check and the claim together, so near-simultaneous claims can't skip a warning. Likely approach: one Durable Object per group (architecture AD-06, option 3). | TPM A3 | Only if PR-003 testing shows the timing problem matters. Unlikely at launch. |
| B-013 | **Removed members' records (G12).** Decide between keeping a removed member's record (marked `removed`, name freed, PIN and tokens cleared) or deleting it completely, including privacy and retention rules. | Schema G12 | v1 interim: keep it, marked `removed`. Related to B-009 and B-010. |
| B-014 | **Items left with no viewers (G13).** What happens to a "specific members" item when every member it was shared with has been removed. | Schema G13 | v1 interim: only the owner can see it, with a note "No one can see this item". Options for later: switch it to everyone, or ask the owner. |
| B-015 | **Already-signed-in browser opening an invite link (was prototype SC-11).** Today it goes straight into the group with "You're already in…". Revisit once each person's home screen exists, so it lands there. | TPM review round 3 | Behaviour built and tested (UI-03); removed from the prototype as not needed visually. |
| B-016 | **Replace the "inside the group" placeholder with each person's home screen.** Joining, signing in and approved requests currently land on a placeholder. | TPM review round 3 | Comes with Section 2 (My list) and the dashboard. |
| B-008 | **Group ideas.** Members suggest gifts for someone that aren't on that person's list. Hidden from the recipient, and claimable. | Brief Q15 | |
