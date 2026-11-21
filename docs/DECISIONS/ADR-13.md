# ADR-13: Dependency supply-chain policy

- **Status:** Accepted
- **Date:** 2026-11-21
- **Decided by:** TPM ("proceed with security-preferred recs"). Grants access request AR-02.

## Context
The project needs public npm packages: the app libraries plus build and test tools. The TPM asked whether to copy the packages into the repo for safety.

Committing `node_modules` would add hundreds of megabytes of files, some of them compiled for one operating system only, and would make diffs hard to review. Only `hono`, `react` and `react-dom` end up in the deployed app, and they're bundled at build time. Nothing calls npm at runtime.

## Decision
1. **Commit `package-lock.json`.** It records each package's exact version and SHA-512 checksum, so any mismatch fails the install.
2. **Install only with `npm ci`.** Never `npm install` except in a reviewed commit that intentionally changes dependencies.
3. **Pin exact versions** in `package.json` (`save-exact=true` in `.npmrc`). No version ranges.
4. **Wait 14 days before adopting a release.** We pick the newest version that has been published for at least 14 days, so malicious or broken releases have time to be found and pulled.
5. **No install scripts:** `ignore-scripts=true` in `.npmrc`. Packages can't run code when they're installed. Any exception must be logged here.
6. **Run `npm audit`** after every dependency change. Findings go to `docs/BUGS.md`.
7. **Wrangler usage stats off:** `send_metrics: false`.
8. **Keep the dependency list minimal.** Every new package goes to the TPM for approval first, as an access request.
9. **Don't commit `node_modules`.** A `vendor/` copy of the app packages stays available as an option if the TPM later wants it.

## Approved packages (initial set, 2026-11-21)
| Package | Version | Role |
|---|---|---|
| hono | 4.13.16 | Runtime: API router |
| react, react-dom | 19.3.1 | Runtime: web app |
| vite | 8.3.6 | Dev: build tool |
| @cloudflare/vite-plugin | 1.67.0 | Dev: runs the Worker inside Vite |
| wrangler | 4.158.0 | Dev: local runtime, migrations and deploys. Deploys gated by AR-01. |
| typescript | 6.0.3 | Dev: type checking. The newer 7.x line was avoided until the tooling around it is proven. |
| @cloudflare/workers-types | 5.20261106.1 | Dev: types |
| @types/react, @types/react-dom | 19.3.0 | Dev: types |
| vitest | 4.1.12 | Dev: tests. 4.x is required by the Workers test pool. |
| @playwright/test | 1.63.0 | Dev: end-to-end tests, matching the browser already installed in the container |

`@vitejs/plugin-react` was left out because Vite handles JSX on its own and the plugin isn't needed.

## Exceptions and changes during setup (2026-11-21)
1. **Removed `@cloudflare/vitest-pool-workers`.** The first `npm audit` found 6 high-severity advisories (sharp, undici, zod), all inside this one package's bundled copy of an older wrangler and miniflare. Following this policy, the package was dropped rather than overridden. Tests now run in Node against a real local D1 database from the approved wrangler (`getPlatformProxy`). Result: `npm audit` reports **0 vulnerabilities**, from 98 packages. See BUG-001.
2. **`legacy-peer-deps=true` in `.npmrc`.** npm 10.9 crashes with an internal error (`edgesOut`) when resolving vitest's optional peer packages. This setting only stops npm from auto-installing peer packages. Every peer we need is listed explicitly, and the lockfile checksums still apply. See BUG-002.
3. **`ignore-scripts=true` needed no exceptions.** Everything installed and ran without install scripts.
4. **Pending request:** `@types/node` (type definitions only, no runtime code) so the type checker can cover test files. Until it's approved, `npm run typecheck` covers `src/` only, and tests are still type-checked when Vitest runs them.

## Consequences
We get the same packages on every machine, and tampering is detected. We run up to 2 weeks behind the newest releases, and security patches can be fast-tracked with TPM approval. Some packages may need their install script; any such exception is recorded here.
