// Starts the app for end-to-end tests on a fresh, throwaway local database.
// Nothing touches Cloudflare. Used by playwright.config.ts.
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";

const STATE = ".e2e-state";
rmSync(STATE, { recursive: true, force: true });
mkdirSync(STATE, { recursive: true });
if (!existsSync(".dev.vars")) copyFileSync(".dev.vars.example", ".dev.vars");
const m = spawnSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", STATE], { stdio: "inherit" });
if (m.status !== 0) process.exit(m.status ?? 1);
const dev = spawn("npx", ["vite", "dev", "--port", "5288", "--strictPort", "--host", "127.0.0.1"], {
  stdio: "inherit",
  env: { ...process.env, E2E_STATE_DIR: STATE },
});
const stop = () => { dev.kill("SIGTERM"); process.exit(0); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
