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
| B-008 | **Group ideas.** Members suggest gifts for someone that aren't on that person's list. Hidden from the recipient, and claimable. | Brief Q15 | |
