/**
 * UnQTools v6.0 — Screenshot capture for VLM review.
 *
 * Captures 16 screenshots:
 *   - 4 pages (home, tools directory, json-formatter, diff-checker)
 *   - × 2 viewports (desktop 1440×900, mobile 390×844)
 *   - × 2 themes (dark, light)
 *
 * Output: docs/screenshots/v6/*.png
 */
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const EXECUTABLE =
  "/home/z/.cache/ms-playwright/chromium_headless_shell-1148/chrome-linux/headless_shell";

const PAGES = [
  { label: "home", url: "/" },
  { label: "tools-directory", url: "/tools" },
  { label: "tool-json-formatter", url: "/tools/json-formatter" },
  { label: "tool-diff-checker", url: "/tools/diff-checker" },
];

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

const THEMES = ["dark", "light"];

const OUT_DIR = "docs/screenshots/v6";

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });

  for (const page of PAGES) {
    for (const vp of VIEWPORTS) {
      for (const theme of THEMES) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: theme,
          deviceScaleFactor: 2,
        });
        const p = await ctx.newPage();
        // Set theme via localStorage + document attribute (next-themes)
        await p.addInitScript((t) => {
          localStorage.setItem("theme", t);
          // Pre-apply the class so the first paint is correct (no FOUC)
          if (t === "dark") {
            document.documentElement.classList.add("dark");
          }
        }, theme);
        await p.goto(`http://localhost:4322${page.url}`, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        // Wait for React hydration — the SidebarNav renders a mobile menu button
        // that only appears after client JS executes
        await p.waitForSelector("nav, [class*='sidebar'], [class*='bg-card']", { timeout: 10000 }).catch(() => {});
        await p.waitForTimeout(3000); // let next-themes hydrate + animations settle

        // Force-apply theme right before screenshot (next-themes may have cleared it)
        await p.evaluate((t) => {
          document.documentElement.classList.remove("dark", "light");
          if (t === "dark") {
            document.documentElement.classList.add("dark");
          }
        }, theme);
        await p.waitForTimeout(800); // let CSS recompute + repaint

        // For tool pages, click "Load sample" if present
        if (page.url.startsWith("/tools/")) {
          const sampleBtn = p.getByRole("button", { name: /load sample|sample/i }).first();
          if (await sampleBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
            await sampleBtn.click().catch(() => {});
            await p.waitForTimeout(800);
          }
        }

        const filename = `${page.label}-${vp.label}-${theme}.png`;
        await p.screenshot({ path: `${OUT_DIR}/${filename}`, fullPage: false });
        console.log(`  ✓ ${filename}`);
        await ctx.close();
      }
    }
  }

  await browser.close();
  console.log(`\nAll screenshots saved to ${OUT_DIR}/`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
