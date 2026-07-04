import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const routes = JSON.parse(readFileSync("tests/routes.json", "utf-8"));
// Test a representative subset (all 55 × 4 viewports = 220 tests would be too slow)
const OVERFLOW_ROUTES = [
  "/",
  "/tools",
  "/tools/json-formatter",
  "/tools/diff-checker",
  "/tools/color-picker",
  "/tools/word-character-counter",
  "/tools/image-compressor",
  "/category/developer",
  "/category/text",
  "/about",
  "/components",
  "/animations",
];
const VIEWPORTS = [
  { width: 320, height: 568, label: "320" },
  { width: 390, height: 844, label: "390" },
  { width: 768, height: 1024, label: "768" },
  { width: 1440, height: 900, label: "1440" },
];

/**
 * Zero-overflow gate — representative pages × 320/390/768/1440.
 * Asserts document.documentElement.scrollWidth <= viewport width.
 * No overflow-x: hidden band-aids.
 */
test.describe("Overflow — representative pages × 4 viewports", () => {
  for (const route of OVERFLOW_ROUTES) {
    for (const vp of VIEWPORTS) {
      test(`${route} @${vp.label} no horizontal overflow @overflow`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route, { waitUntil: "networkidle", timeout: 15_000 });
        await page.waitForSelector("main, nav, h1", { timeout: 10_000 });
        await page.waitForTimeout(2000); // let layout + hydration settle

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        // 1px tolerance for sub-pixel rounding
        expect(scrollWidth, `${route} @${vp.label}: scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`).toBeLessThanOrEqual(
          clientWidth + 1,
        );
      });
    }
  }
});
