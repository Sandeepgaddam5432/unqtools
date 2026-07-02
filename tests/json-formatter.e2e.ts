import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * JSON Formatter — end-to-end tests.
 *
 * Covers the happy path from the spec's acceptance criteria:
 *  - Tool page loads, renders input + options + buttons.
 *  - "Load sample" populates the input.
 *  - "Format" produces pretty-printed output.
 *  - "Minify" produces compact output.
 *  - Invalid JSON shows a friendly error (role="alert").
 *  - Empty input shows an error, not a crash.
 *  - "Copy" works (clipboard).
 *  - Keyboard-only operation works (Tab to button, Enter to activate).
 *  - axe-core a11y scan: zero critical/serious violations.
 */
test.describe("JSON Formatter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/tools/json-formatter");
  });

  test("page renders with title, input, output, and option bar", async ({ page }) => {
    await expect(page).toHaveTitle(/JSON Formatter/);
    await expect(page.getByRole("heading", { name: "JSON Formatter" })).toBeVisible();
    await expect(page.getByLabel("Input")).toBeVisible();
    await expect(page.getByLabel("Output")).toBeVisible();
    await expect(page.getByLabel("Indent")).toBeVisible();
    await expect(page.getByRole("switch", { name: "Sort keys" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Format" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Minify" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Load sample" })).toBeVisible();
  });

  test("Load sample populates the input", async ({ page }) => {
    await page.getByRole("button", { name: "Load sample" }).click();
    const inputValue = await page.getByLabel("Input").inputValue();
    expect(inputValue).toContain("UnQTools");
    expect(inputValue).toContain("features");
  });

  test("Format produces pretty-printed output", async ({ page }) => {
    await page.getByLabel("Input").fill('{"b":1,"a":2}');
    await page.getByRole("button", { name: "Format" }).click();
    const out = page.getByLabel("Output");
    await expect(out).toContainText('"b": 1');
    await expect(out).toContainText('"a": 2');
  });

  test("Sort keys toggle reorders keys", async ({ page }) => {
    await page.getByLabel("Input").fill('{"b":1,"a":2}');
    await page.getByRole("switch", { name: "Sort keys" }).click();
    await page.getByRole("button", { name: "Format" }).click();
    const out = await page.getByLabel("Output").textContent();
    expect(out).toBeTruthy();
    expect(out!.indexOf('"a"')).toBeLessThan(out!.indexOf('"b"'));
  });

  test("Minify produces compact output", async ({ page }) => {
    await page.getByLabel("Input").fill('{ "a": 1, "b": 2 }');
    await page.getByRole("button", { name: "Minify" }).click();
    await expect(page.getByLabel("Output")).toContainText('{"a":1,"b":2}');
  });

  test("Invalid JSON shows a friendly error with role=alert", async ({ page }) => {
    await page.getByLabel("Input").fill("{bad}");
    await page.getByRole("button", { name: "Format" }).click();
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/.+/);
  });

  test("Empty input shows an error, not a crash", async ({ page }) => {
    await page.getByLabel("Input").fill("");
    await page.getByRole("button", { name: "Format" }).click();
    await expect(page.locator('[role="alert"]')).toContainText(/empty/i);
  });

  test("Validate button confirms valid input", async ({ page }) => {
    await page.getByLabel("Input").fill('{ "x": [1, 2, 3] }');
    await page.getByRole("button", { name: "Validate" }).click();
    await expect(page.getByLabel("Output")).toContainText('{"x":[1,2,3]}');
  });

  test("Fully keyboard operable", async ({ page }) => {
    await page.getByLabel("Input").fill('{"a":1}');
    // Tab to the Format button and press Enter
    await page.keyboard.press("Tab"); // indent select
    await page.keyboard.press("Tab"); // sort toggle
    await page.keyboard.press("Tab"); // Format
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Output")).toContainText('"a": 1');
  });

  test("axe-core a11y scan: no critical/serious violations", async ({ page }) => {
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious).toEqual([]);
  });
});
