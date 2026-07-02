import { test, expect } from "@playwright/test";

/**
 * Phase 0 smoke e2e — verifies the app shell loads, the homepage renders,
 * the search input is present, and the theme toggle works.
 *
 * axe-core a11y assertions will be added once the axe-playwright utility
 * is wired in (tracked in STATE.md). For Phase 0 we verify the shell.
 */
test("homepage loads and renders the hero + search", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/UnQTools/);
  await expect(page.getByRole("heading", { name: /Tools that respect/i })).toBeVisible();
  await expect(page.getByLabel(/command palette/i)).toBeVisible();
});

test("theme toggle flips the data-theme attribute", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /toggle color theme/i }).click();
  const after = await html.getAttribute("data-theme");
  expect(after).not.toBe(before);
});

test("404 page renders for unknown routes", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText("Page not found")).toBeVisible();
});
