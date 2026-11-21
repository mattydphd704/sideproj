import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

// Builds the web app (src/web) and runs the Worker (src/worker) together.
// JSX is handled by Vite itself; @vitejs/plugin-react isn't needed (ADR-13).
export default defineConfig({
  plugins: [
    tailwindcss(),
    // E2E tests point the local database at a throwaway folder (see test/e2e).
    cloudflare(process.env.E2E_STATE_DIR ? { persistState: { path: process.env.E2E_STATE_DIR } } : {}),
  ],
  oxc: { jsx: { runtime: "automatic" } },
});
