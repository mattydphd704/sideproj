# ADR-09: One view-builder module shapes all responses

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM
- **Ref:** ARCHITECTURE.md AD-09

## Context
The surprise rule and item visibility must be enforced on the server (NFR-5).

## Decision
All responses are built from database rows by `views/`, following glossary Part D, with typed output and a test for each cell.

## Consequences
There's one place to review for leaks. New endpoints must use it.
