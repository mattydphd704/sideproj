# Branch Register

Every work branch in this project, what it's for, and its status. Rules: ADR-14.

| Branch | Purpose | Cut from | Status |
|---|---|---|---|
| `claude/sharp-knuth-889h6a` | **Base / integration branch.** Holds approved, passing work: planning docs, project setup, database, identity (steps 1–3). | — | Active. Changes only with TPM approval. |
| `claude/sharp-knuth-889h6a-step4-views` | Step 4: items, claims, and what each viewer sees (VIS, ITM, CLM tests). | `2ca0f3d` | **Paused** at `d67cd5c` (ADR-14 only, no step 4 code yet). Preserved for later. |
| `claude/sharp-knuth-889h6a-ui-workflow` | **UI and user workflow:** screens, flows, wording and states, documented first (`docs/UI_WORKFLOW.md`) for TPM approval, then built in React. | `d67cd5c` | **Active.** Work happens in its own conversation. |
| `main` | Untouched until the TPM decides how releases reach it. | — | — |
