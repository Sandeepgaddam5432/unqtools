import { test, expect } from "@playwright/test";

/**
 * CLS gate — measure Cumulative Layout Shift on representative pages.
 * Target: < 0.1 (realistic for this stack — Framer Motion animations may
 * contribute small shifts). Report real numbers.
 */

const PAGES = [
  { route: "/", label: "home" },
  { route: "/tools", label: "tools-directory" },
  { route: "/tools/json-formatter", label: "tool-json-formatter" },
  { route: "/tools/diff-checker", label: "tool-diff-checker" },
  { route: "/tools/color-picker", label: "tool-color-picker" },
];

for (const page of PAGES) {
  test(`${page.label} — CLS < 0.1 @cls`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const p = await context.newPage();

    let cls = 0;
    await p.exposeFunction("noop", () => {});
    const obs = await p.evaluate(() => {
      return new Promise((resolve) => {
        let cls = 0;
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) cls += entry.value || 0;
          }
          resolve(cls);
        });
        obs.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(cls), 2000);
      });
    });
    cls = obs;

    await p.goto(page.route, { waitUntil: "domcontentloaded" });
    await p.waitForSelector("main, nav, h1", { timeout: 10_000 });
    // Wait for animations + hydration to settle
    await p.waitForTimeout(3000);

    // Final CLS measurement
    cls = await p.evaluate(() => {
      return new Promise((resolve) => {
        let cls = 0;
        const obs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) cls += entry.value || 0;
          }
          resolve(cls);
        });
        obs.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(cls), 500);
      });
    });

    // Report real number — target 0.1 but don't weaken if over
    expect(cls, `${page.label}: CLS ${cls.toFixed(4)} (target < 0.1)`).toBeLessThan(0.1);

    await context.close();
  });
}
