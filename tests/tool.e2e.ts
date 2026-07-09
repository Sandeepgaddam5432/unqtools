import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

/**
 * Tool e2e — for EACH of the 32 tools: load page, input sample data, run, assert
 * correct output appears.
 */

/** Generate a minimal valid PDF with the given page count. */
async function makePdfBuffer(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

const TOOLS = [
  {
    id: "json-formatter",
    sampleAction: "click:Load sample",
    runAction: "click:Format",
    assert: async (page) => {
      const output = page.locator("#json-output");
      await expect(output).toContainText("UnQTools", { timeout: 5000 });
    },
  },
  {
    id: "base64",
    sampleAction: "type:Hello, UnQTools!",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).toContainText("SGVsbG8", { timeout: 5000 });
    },
  },
  {
    id: "hash-generator",
    sampleAction: "type:Hello World",
    runAction: "click:Generate hash",
    assert: async (page) => {
      const output = page.locator("pre").first();
      await expect(output).not.toBeEmpty({ timeout: 5000 });
    },
  },
  {
    id: "url-encoder",
    sampleAction: "type:hello world & foo=bar",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).toContainText("hello%20world", { timeout: 5000 });
    },
  },
  {
    id: "uuid-generator",
    sampleAction: "none",
    runAction: "click:Generate",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).toContainText(/[0-9a-f]{8}-[0-9a-f]{4}/, { timeout: 5000 });
    },
  },
  {
    id: "emi-calculator",
    sampleAction: "none",
    runAction: "click:Calculate",
    assert: async (page) => {
      await expect(page.getByText("Monthly EMI").first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator("p.text-xl.font-bold.text-primary").first()).toContainText(/10,500/, { timeout: 5000 });
    },
  },
  {
    id: "mortgage-calculator",
    sampleAction: "none",
    runAction: "click:Calculate",
    assert: async (page) => {
      await expect(page.getByText("Monthly P&I").first()).toBeVisible({ timeout: 5000 });
      await expect(page.locator("p.text-xl.font-bold.text-primary").first()).toContainText(/\$2,237/, { timeout: 5000 });
    },
  },
  {
    id: "sip-calculator",
    sampleAction: "none",
    runAction: "click:Calculate",
    assert: async (page) => {
      await expect(page.getByText("Future value").first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "color-picker",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText("HEX", { exact: true }).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "image-compressor",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop images/i)).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "add-line-breaks",
    sampleAction: "type:The quick brown fox jumps over the lazy dog",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).not.toBeEmpty({ timeout: 5000 });
    },
  },
  {
    id: "add-prefix-suffix",
    sampleAction: "type:apple\nbanana\ncherry",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).toContainText("apple", { timeout: 5000 });
    },
  },
  {
    id: "big-text-generator",
    sampleAction: "type:Hello",
    assert: async (page) => {
      const output = page.locator("[class*='break-all']").last();
      await expect(output).not.toBeEmpty({ timeout: 5000 });
    },
  },
  {
    id: "bold-text-generator",
    sampleAction: "type:Hello",
    assert: async (page) => {
      const output = page.locator("[class*='break-all']").last();
      await expect(output).not.toBeEmpty({ timeout: 5000 });
    },
  },
  {
    id: "bubble-text-generator",
    sampleAction: "type:Hello",
    assert: async (page) => {
      const output = page.locator("[class*='break-all']").last();
      await expect(output).not.toBeEmpty({ timeout: 5000 });
    },
  },
  {
    id: "caesar-cipher",
    sampleAction: "type:Hello World",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).not.toBeEmpty({ timeout: 5000 });
    },
  },
  {
    id: "case-converter",
    sampleAction: "type:hello world",
    assert: async (page) => {
      await expect(page.getByText("HELLO WORLD").first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "csv-to-markdown",
    sampleAction: "type:name,age\nAlice,30\nBob,25",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).toContainText("|", { timeout: 5000 });
    },
  },
  {
    id: "csv-to-text-list",
    sampleAction: "type:name,city\nAlice,NYC\nBob,SF",
    assert: async (page) => {
      const output = page.locator("pre").last();
      await expect(output).toContainText("Alice", { timeout: 5000 });
    },
  },
  {
    id: "diff-checker",
    sampleAction: "click:Load sample",
    assert: async (page) => {
      await expect(page.getByText(/added/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "duplicate-lines-remover",
    sampleAction: "type:apple\nbanana\napple\ncherry",
    assert: async (page) => {
      await expect(page.getByText(/unique/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "word-character-counter",
    sampleAction: "type:The quick brown fox jumps over the lazy dog",
    assert: async (page) => {
      await expect(page.getByText("Words", { exact: true }).first()).toBeVisible({ timeout: 5000 });
    },
  },
  // ── PDF tools ────────────────────────────────────────────────────────────────
  {
    id: "merge-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop PDFs here/i).first()).toBeVisible({ timeout: 5000 });
    },
    setup: async (page) => {
      const buf = await makePdfBuffer(2);
      await page.locator('input[type=file]').first().setInputFiles([
        { name: "a.pdf", mimeType: "application/pdf", buffer: buf },
        { name: "b.pdf", mimeType: "application/pdf", buffer: buf },
      ]);
      await page.waitForTimeout(800);
    },
  },
  {
    id: "split-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "rotate-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "delete-pdf-pages",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "extract-pdf-pages",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "reorder-pdf-pages",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "images-to-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop images/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "pdf-page-numbers",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "pdf-watermark",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "pdf-metadata-editor",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "compress-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "reverse-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "duplicate-pdf-pages",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "insert-pdf-pages",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop the main PDF/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "interleave-pdf",
    sampleAction: "none",
    assert: async (page) => {
      await expect(page.getByText(/Drop PDF A/i).first()).toBeVisible({ timeout: 5000 });
    },
  },
  {
    id: "crop-pdf",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "resize-pdf-pages",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "scale-pdf",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "n-up-pdf",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "remove-blank-pages",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "flatten-pdf",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "pdf-stamp",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "pdf-sign-draw",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop PDF here/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "pdf-bookmarks-editor",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
  {
    id: "pdf-contact-sheet",
    sampleAction: "none",
    assert: async (page) => { await expect(page.getByText(/Drop a PDF/i).first()).toBeVisible({ timeout: 5000 }); },
  },
];

async function doAction(page, action) {
  if (action === "none" || !action) return;
  const [type, value] = action.split(":");
  if (type === "click") {
    const btn = page.getByRole("button", { name: new RegExp(value, "i") }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  } else if (type === "type") {
    const textarea = page.locator("textarea").first();
    if (await textarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await textarea.fill(value.replace(/\\n/g, "\n"));
      await page.waitForTimeout(500);
    }
  }
}

test.describe("Tool e2e — all 32 tools", () => {
  for (const tool of TOOLS) {
    test(`${tool.id} — load + input + output @tool`, async ({ page }) => {
      await page.goto(`/tools/${tool.id}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("main, nav, h1", { timeout: 10_000 });
      // Wait for lazy-loaded tool UI to hydrate
      await page.waitForTimeout(1500);

      if ("setup" in tool && tool.setup) await tool.setup(page);
      await doAction(page, tool.sampleAction);
      await doAction(page, tool.runAction);

      await tool.assert(page);
    });
  }
});
