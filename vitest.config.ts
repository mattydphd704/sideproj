import { defineConfig } from "vitest/config";

// Tests run in Node. Database tests use a real local D1 (SQLite) provided by
// wrangler's local runtime (see test/helpers/db.ts). No Cloudflare account needed.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
