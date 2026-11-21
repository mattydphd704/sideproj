import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (TEST_PLAN §2.13, UI-01..UI-14) and review screenshots.
export default defineConfig({
  testDir: "test/e2e",
  workers: 1, // one shared local database
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:5288", trace: "off" },
  webServer: {
    command: "node test/e2e/server.mjs",
    url: "http://127.0.0.1:5288/api/health",
    timeout: 120_000,
    reuseExistingServer: false,
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] }, testIgnore: /(screens|prototype)\.spec/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /(screens|prototype)\.spec/, grep: /@desktop/ },
    { name: "screens", use: { ...devices["Pixel 7"] }, testMatch: /screens\.spec/ },
    // Walks every prototype scenario exactly as its card describes (needs `npm run prototype` first).
    { name: "prototype", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 1000 } }, testMatch: /prototype\.spec/ },
  ],
});
