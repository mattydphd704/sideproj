# PR Tracker

Candidate features that are built and tested as their own scenario, with a test suite around them, before they're accepted into v1 scope. Each PR-nnn is delivered as its own GitHub pull request, which is linked in the table below. The engineer opens a pull request only when the TPM asks.

| | |
|---|---|
| **Last updated** | 2026-11-21 |

**Status values:** `proposed` → `scoped` → `in-dev` → `in-test` → `accepted` / `rejected`

| ID | Title | Status | Source | Branch / GitHub PR | Decision |
|---|---|---|---|---|---|
| PR-001 | Partial claims on items with a quantity | proposed | Brief Q9 | — | — |
| PR-002 | Auto-fill product details from links | proposed | Brief Q8 | — | — |
| PR-003 | Fair-share alert tuning | proposed | Brief FR-6 | — | Ships in v1 with initial logic; tune in test |

---

## PR-001: Partial claims

**Idea.** An item can have a quantity greater than 1, such as "3 books from a series". Several members can each claim part of it until it's fully claimed.

**Baseline v1 behaviour, while this is being tested:** One claim per item.

**Scenarios to test:**
1. An item with quantity 3. Member A claims 1 and member B claims 2. The item shows as fully claimed, and both claimers appear to other members.
2. Two members try to claim the last unit at the same moment. Exactly one succeeds.
3. A claimer releases their units. The remaining quantity becomes available again.
4. The owner lowers the quantity below the number already claimed. What happens? *(Decision needed.)*
5. Surprise rule: the owner sees nothing about the partial claims.

**Open:** How is the UI shown on mobile? Does the Claimed list show per-unit claims?

---

## PR-002: Auto-fill product details from links

**Idea.** When a member pastes a product link, the app fills in the product name, price, image, size, colour and so on, and the member edits the result.

**Why it's a spike:** Retailers vary widely. Some block automated requests, and some only expose structured data such as Open Graph or schema.org metadata. We need to know which product categories and retailers give useful data before we commit to a design.

**Needs access (not yet requested):** The server will need outbound HTTP to arbitrary retailer sites. A third-party product-data API might also be an option. I'll make a formal access request at the architecture stage.

**Scenarios to test:**
1. A sample of links across categories (electronics, clothing, books, toys, home) and major retailers. Record which fields were extracted.
2. A link that fails or is blocked. The member can still save the item and fill in the details by hand.
3. Slow responses. Saving the item must never wait on auto-fill.
4. Security: guard against server-side request forgery (SSRF), for example by blocking internal IP addresses, and enforce limits on response size and time.

**Output:** Updated "Item fields" table in `GLOSSARY.md`.

---

## PR-003: Fair-share alert tuning

**Idea.** FR-6 ships in v1 with initial logic. We test it in the test environment and tune the threshold and the wording of the alert.

**Baseline v1 behaviour:** A warning appears on every claim that breaches fair share. The threshold is: available items < waiting givers × buffer (1.0), or any waiting giver has no available item they're allowed to see.

**Scenarios to test:**
1. Small group (3 members), short list (2 items).
2. Large group (15 members), long list (40 items).
3. Mixed visibility: one waiting giver can only see 1 item, and it's claimed.
4. A new member joins after claims were made. The nudge appears for existing over-claimers.
5. The owner deletes items, which pushes a claimer over the threshold.
6. Rapid repeated claims: the warning appears every time.
7. Different buffer values (0.5, 1.0, 1.5).

**Output:** The tuned threshold rule and default settings, written back into brief FR-6.
