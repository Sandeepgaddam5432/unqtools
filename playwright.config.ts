import { defineConfig, devices } from "@playwright/test";

const EXECUTABLE =
  "/home/z/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false, // sequential — static server can't handle parallel well
  workers: 1, // single worker — Node static server is single-threaded
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4322",
    trace: "on-first-retry",
    // Use the locally cached Chromium binary (avoids needing `npx playwright install`)
    launchOptions: EXECUTABLE
      ? { executablePath: EXECUTABLE, args: ["--no-sandbox"] }
      : { args: ["--no-sandbox"] },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node tests/static-server.mjs",
    url: "http://localhost:4322",
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
