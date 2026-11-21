import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// Builds the web app (src/web) and runs the Worker (src/worker) together.
// JSX is handled by Vite itself; @vitejs/plugin-react isn't needed (ADR-13).
export default defineConfig({
  plugins: [cloudflare()],
  oxc: { jsx: { runtime: "automatic" } },
});
