import { test, expect } from "@playwright/test";

/**
 * Reduced-motion gate — verify Framer Motion respects prefers-reduced-motion: reduce.
 * Checks that animation/transition durations are effectively 0 under reduced motion.
 */

const PAGES = [
  "/",
  "/tools",
  "/tools/json-formatter",
  "/tools/diff-checker",
  "/components",
  "/animations",
];

for (const route of PAGES) {
  test(`${route} — reduced-motion disables animations @motion`, async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main, nav, h1", { timeout: 10_000 });
    await page.waitForTimeout(1500);

    // Check that no element has a transition/animation duration > 0.02s (20ms)
    // Under prefers-reduced-motion: reduce, Framer Motion should respect it
    const maxDuration = await page.evaluate(() => {
      let max = 0;
      const all = document.querySelectorAll("*");
      for (const el of all) {
        const cs = window.getComputedStyle(el);
        const animDur = parseFloat(cs.animationDuration) || 0;
        const transDur = parseFloat(cs.transitionDuration) || 0;
        const dur = Math.max(animDur, transDur);
        if (dur > max) max = dur;
      }
      return max;
    });

    // Acceptance: all transitions/animations ≤ 0.02s under reduced motion.
    // (Framer Motion's useReducedMotion + CSS media queries should handle this.)
    // NOTE: Some template animations may not respect this — we report the real number.
    expect(maxDuration, `${route}: max animation duration ${maxDuration}s under reduced-motion (should be ≤ 0.02s)`).toBeLessThanOrEqual(
      0.02,
    );

    await context.close();
  });
}
