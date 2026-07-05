import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Use locally cached Chromium in sandbox; in CI, Playwright finds it automatically
const SANDBOX_EXECUTABLE =
  "/home/z/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const EXECUTABLE = existsSync(SANDBOX_EXECUTABLE) ? SANDBOX_EXECUTABLE : undefined;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.ts/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4322",
    trace: "on-first-retry",
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
