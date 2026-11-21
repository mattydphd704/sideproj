# Bug Tracker

| | |
|---|---|
| **Last updated** | 2026-11-21 |

**Severity:** `S1` blocks testing or loses data · `S2` major feature broken · `S3` minor problem or has a workaround · `S4` cosmetic

**Status:** `open` → `in-progress` → `fixed` (in dev) → `verified` (TPM or tests confirm) · `wontfix` · `duplicate`

**Environment:** `dev` / `test` / `prod`

| ID | Title | Severity | Status | Env | Found | Fixed in | Notes |
|---|---|---|---|---|---|---|---|
| BUG-001 | 6 high-severity npm audit advisories in `@cloudflare/vitest-pool-workers` dependencies | S2 | verified | local | 2026-11-21, engineer | Setup commit | Package removed (ADR-13). `npm audit` reports 0 vulnerabilities. Dev tool only, never shipped. |
| BUG-003 | At 360 px wide, a long group name in the "Join {groupName}" button overflows by 12 px, causing sideways scrolling (NFR-1). Buttons don't wrap text by default. | S3 | fixed | local | 2026-11-21, test UI-12 | UI build commit | The Join button now wraps long names onto two lines. Found by UI-12 before anyone saw it. The first guess (PIN boxes) was checked with a measurement and ruled out. |
| BUG-002 | npm 10.9 crashes (`edgesOut`) resolving vitest's optional peers | S3 | verified | local | 2026-11-21, engineer | Setup commit | Workaround: `legacy-peer-deps=true`, with peers listed explicitly (ADR-13). Revisit on an npm upgrade. |

---

## Bug template

```
### BUG-nnn: <short title>
- Severity / Status / Env:
- Found: <date, by>
- Requirement: <FR or NFR id, if any>
- Steps to reproduce:
  1.
- Expected:
- Actual:
- Fix: <commit or PR link, date>
- Verified by: <test name or TPM, date>
```
