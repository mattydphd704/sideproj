# Branch Register

Every work branch in this project, what it's for, and its status. Rules: ADR-14.

| Branch | Purpose | Cut from | Status |
|---|---|---|---|
| `claude/sharp-knuth-889h6a` | **Base / integration branch.** Holds approved, passing work: planning docs, project setup, database, identity (steps 1–3). | — | Active. Changes only with TPM approval. |
| `claude/sharp-knuth-889h6a-step4-views` | Step 4: items, claims, and what each viewer sees (VIS, ITM, CLM tests). | `2ca0f3d` | **Paused** at `d67cd5c` (ADR-14 only, no step 4 code yet). Preserved for later. |
| `claude/sharp-knuth-889h6a-ui-workflow` | **UI and user workflow:** task map (`UI_TASK_MAP.md`), interaction maps (`UI_INTERACTION_MAPS.md`), Section 1 built and reviewed, prototype, dev deploy. | `d67cd5c` | **Done to `8b62977`**; work continues on the branch below. |
| `claude/beautiful-brown-z7s8tq` | **Admin protocol** (ADR-17) on top of all the UI-workflow work, plus handbook fixes. **Deployed to Cloudflare dev.** The name was assigned by the Claude session rather than following ADR-14's pattern. | `8b62977` (fast-forward of the UI-workflow branch) | **Active.** |
| `main` | Untouched until the TPM decides how releases reach it. | — | — |
