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
      // Wait long enough for Framer Motion stagger entrance animations to finish.
      // /tools page has 32 tool cards animating opacity 0→1 with ~50ms stagger + ~600ms duration,
      // so the last card finishes around 2.2s after load. Catching a card mid-animation
      // produces an effective color with reduced contrast (e.g. muted-foreground #6e6c66
      // at 86.6% opacity blends with the cream background to #7f7d77, which fails the
      // 4.5:1 threshold at 3.91:1). 3000ms gives comfortable headroom.
      await page.waitForTimeout(3000);
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
      // See light-theme test above for why this wait must be long enough for
      // Framer Motion stagger entrance animations to fully complete.
      await page.waitForTimeout(3000);
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
