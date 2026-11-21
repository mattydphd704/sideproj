# ADR-14: Branching workflow

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM ("create a branch in this track; do not proceed outside of the branch")

## Context
Until now, all work was committed to the project's development branch, `claude/sharp-knuth-889h6a`. The TPM wants each piece of work kept on its own branch.

## Decision
1. **Base branch:** `claude/sharp-knuth-889h6a` is the integration branch for the project. It only changes when the TPM approves merging a work branch into it.
2. **Work branches:** each step or PR-nnn gets its own branch, cut from the latest base branch and named `claude/sharp-knuth-889h6a-<topic>`. The first is `claude/sharp-knuth-889h6a-step4-views` (step 4: items, claims and what each viewer sees), cut from `2ca0f3d`.
3. **In a chat working on a branch, all commits and pushes go to that branch only.** Nothing is committed or pushed to the base branch, `main` or any other branch without the TPM's explicit go-ahead.
4. **Every commit on a work branch** follows the testing rules: `npm run verify` passes, and `docs/TEST_RESULTS.md` is committed.
5. **Merging:** when a step is done, the engineer reports and the TPM decides. Either the TPM asks for a pull request into the base branch, which the engineer opens for TPM review and never merges itself, or the branch stays open for more work.
6. **`main`** is untouched until the TPM decides how releases reach it.

## Consequences
Each step can be reviewed, tested and discarded independently. The base branch always holds approved, passing work.
