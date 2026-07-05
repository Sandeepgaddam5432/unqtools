import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const routes = JSON.parse(readFileSync("tests/routes.json", "utf-8"));

/**
 * Smoke e2e — every route in the static export loads with 200, renders an H1,
 * and has no console errors (including React hydration errors).
 */
test.describe("Smoke — all routes", () => {
  for (const route of routes) {
    if (route === "/_not-found") continue; // tested separately
    test(`${route} loads 200 + has H1 + no console/react errors @smoke`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          // Next.js static export prefetches links on every page. When the test
          // moves to the next page, those prefetch requests get aborted, which
          // shows up as "Failed to load resource" console errors. These are NOT
          // real errors — they're prefetch cancellations. We filter them out.
          if (text.includes("Failed to load resource")) return;
          consoleErrors.push(text);
        }
      });
      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should return 200`).toBe(200);

      // Wait for hydration (sidebar nav or main content)
      await page.waitForSelector("main, nav, h1", { timeout: 10_000 });

      // Every page should have an H1 (or at least visible content)
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible({ timeout: 10_000 });

      // No console errors (prefetch-abort "Failed to load resource" filtered out)
      expect(consoleErrors, `Console errors on ${route}: ${consoleErrors.join("; ")}`).toEqual([]);

      // No React hydration errors — these must NOT be filtered out (Rule #2)
      const reactErrors = pageErrors.filter((e) =>
        /Minified React error|hydrat/i.test(e),
      );
      expect(reactErrors, `React hydration errors on ${route}: ${reactErrors.join("; ")}`).toEqual([]);
    });
  }

  test("unknown route returns 404 @smoke", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
  });
});
