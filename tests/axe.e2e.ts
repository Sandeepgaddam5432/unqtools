import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

const routes = JSON.parse(readFileSync("tests/routes.json", "utf-8"));
// Use the generated route list (single source of truth — never hardcode routes).
// Filter to representative subset for speed (all 38 would be slow in CI).
const AXE_ROUTES = routes.filter((r: string) =>
  r === "/" ||
  r === "/tools" ||
  r.startsWith("/tools/") ||
  r.startsWith("/category/")
).slice(0, 15);

/**
 * axe-core a11y gate — every representative page × light + dark theme.
 * Zero critical/serious violations required.
 */
for (const route of AXE_ROUTES) {
  test.describe(`${route} — axe-core`, () => {
    test(`light theme — no critical/serious violations @axe`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("theme", "light");
        document.documentElement.classList.remove("dark");
      });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("main, nav, h1", { timeout: 10_000 });
      await page.waitForTimeout(1000);
      // Force light theme
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
      await page.waitForTimeout(300);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(serious, `${route} (light): ${serious.length} critical/serious violations`).toEqual([]);
    });

    test(`dark theme — no critical/serious violations @axe`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("theme", "dark");
        document.documentElement.classList.add("dark");
      });
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("main, nav, h1", { timeout: 10_000 });
      await page.waitForTimeout(1000);
      // Force dark theme
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.waitForTimeout(300);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(serious, `${route} (dark): ${serious.length} critical/serious violations`).toEqual([]);
    });
  });
}
