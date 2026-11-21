# ADR-16: Dev deploy embeds the web app in the Worker

- **Status:** Accepted (dev only)
- **Date:** 2026-11-21
- **Decided by:** Engineer, reported to the TPM; reversible

## Context
Architecture §2 serves the web app with **Workers Static Assets**. Wrangler uploads those files with a short-lived upload key in the `Authorization` header. In this cloud development environment, the network proxy adds the TPM's Cloudflare API token to every request to `api.cloudflare.com`, replacing that upload key, so the asset upload is refused (401). All other Cloudflare calls (Worker upload, D1, secrets) work.

## Decision
For the **dev** deploy only, the built web app (one HTML, one JS and one CSS file) is embedded in the Worker as a generated module (`scripts/embed-assets.mjs` → `src/worker/generated/assets.ts`, not committed). `src/worker/embedded.ts` serves `/api/*` through the normal app and every other path from the embedded files, with a single-page-app fallback to `index.html`. Config: `wrangler.dev.jsonc`. Command: `npm run deploy:dev`.

## Consequences
- The same app and behaviour, with no asset upload needed from this environment.
- Page loads count as Worker requests (Static Assets requests are free). That's irrelevant at dev scale, but it matters for the Free plan's daily cap.
- **Prod should use Static Assets as designed** (architecture §2), deployed from a machine or CI without this proxy (AR-07). Revisit before the first prod deploy.
