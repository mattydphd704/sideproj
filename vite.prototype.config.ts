import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// Builds the clickable prototype (src/prototype) as one JS and one CSS file,
// which scripts/build-prototype.mjs inlines into a single HTML page. No Worker, no server.
export default defineConfig({
  plugins: [tailwindcss()],
  oxc: { jsx: { runtime: "automatic" } },
  build: {
    outDir: "dist/prototype",
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: { input: "prototype.html" },
  },
});
