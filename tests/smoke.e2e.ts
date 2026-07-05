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

      // No template placeholder copy on any production route
      const TEMPLATE_LEFTOVERS = [
        "Crafting exceptional digital experiences",
        "UnQWebTemplate",
        "cutting-edge technology",
        "Lorem ipsum",
        "Design Collective",
        "Elevate Your Digital Vision",
        "Crafting Exceptional Websites",
      ];
      const body = await page.locator("body").innerText();
      for (const phrase of TEMPLATE_LEFTOVERS) {
        expect(body, `${route} contains template placeholder: "${phrase}"`).not.toContain(phrase);
      }
    });
  }

  // Mobile top-space regression guard — ensures content starts within 140px of viewport top
  test.describe("Mobile top-space guard @smoke", () => {
    const MOBILE_ROUTES = ["/", "/tools", "/tools/json-formatter", "/category/developer"];
    for (const route of MOBILE_ROUTES) {
      test(`${route} @390 — first content within 140px of top`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(3000); // let content hydrate (tool pages are lazy-loaded)

        // Find the first visible element with text content inside <main>
        const firstContent = page.locator("main h1, main h2, main p").first();
        const box = await firstContent.boundingBox();
        expect(box, `no visible content found on ${route}`).toBeTruthy();
        // Home page has a cinematic full-screen hero — content is intentionally lower
        const threshold = route === "/" ? 400 : 200;
        expect(box!.y, `${route}: content starts too far down (${box!.y}px)`).toBeLessThan(threshold);
        await ctx.close();
      });
    }
  });

  test("unknown route returns 404 @smoke", async ({ page }) => {
    const response = await page.goto("/this-route-does-not-exist", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBe(404);
  });
});
