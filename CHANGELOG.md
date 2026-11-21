# Changelog

All notable changes to this project. Format: [Keep a Changelog](https://keepachangelog.com/). Versions follow semantic versioning once code ships.

## [Unreleased]

### Added: planning phase (2026-11-21)
- `docs/PROJECT_BRIEF.md` v1.0: requirements, with questions Q1 to Q31 resolved.
- `docs/GLOSSARY.md`: terms, field catalogue, lifecycles, what each viewer sees, decisions G1 to G17.
- `docs/ARCHITECTURE.md` v1.0: Cloudflare Workers + D1 design, plan compatibility, access requests.
- `docs/DATA_SCHEMA.md` v1.0: 12 tables, key queries, lifecycle mapping.
- `docs/DECISIONS/`: ADR-01 to ADR-12.
- `docs/PR_TRACKER.md` (PR-001 to PR-003), `docs/BACKLOG.md` (B-001 to B-014), `docs/BUGS.md`.

### Added: project setup and database (2026-11-21)
- Dependencies under the ADR-13 policy: exact versions, lockfile checksums, versions at least 14 days old, no install scripts, `npm audit` clean (0 vulnerabilities).
- Worker (Hono) with `/api/health`, a placeholder nightly job, and the `/j/*` invite path served by the app.
- Placeholder React web app.
- `migrations/0001_init.sql`: all 12 tables from `DATA_SCHEMA.md` v1.0.
- 23 schema tests: foreign keys, length limits (G1, G4, G6), unique display names, group codes, link limits (G8), price and currency (G16), URL format, one live claim per item including 5 simultaneous claims, and cascade on permanent delete (G14).
- Fixed BUG-001 (audit findings) and worked around BUG-002 (npm crash).
