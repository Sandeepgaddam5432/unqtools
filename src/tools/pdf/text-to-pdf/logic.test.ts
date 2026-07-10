import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { textToPdf } from "./logic";
const baseOpts = { fontSize: 12, pageSize: "a4" as const, orientation: "portrait" as const, margin: 50 };
describe("textToPdf", () => {
  it("converts simple text to PDF", async () => { const r = await textToPdf("Hello World", baseOpts); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getPageCount()).toBe(1); } });
  it("wraps long lines", async () => { const long = "word ".repeat(200); const r = await textToPdf(long, baseOpts); expect(r.ok).toBe(true); if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBeGreaterThanOrEqual(1); });
  it("creates multiple pages for long text", async () => { const long = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join("\n"); const r = await textToPdf(long, baseOpts); expect(r.ok).toBe(true); if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBeGreaterThan(1); });
  it("handles empty text", async () => { const r = await textToPdf("", baseOpts); expect(r.ok).toBe(false); });
  it("handles whitespace-only text", async () => { const r = await textToPdf("   \n   ", baseOpts); expect(r.ok).toBe(false); });
  it("preserves empty lines", async () => { const r = await textToPdf("Line 1\n\n\nLine 2", baseOpts); expect(r.ok).toBe(true); });
  it("handles letter page size", async () => { const r = await textToPdf("Test", { ...baseOpts, pageSize: "letter" }); expect(r.ok).toBe(true); });
  it("handles landscape orientation", async () => { const r = await textToPdf("Test", { ...baseOpts, orientation: "landscape" }); expect(r.ok).toBe(true); });
  it("clamps font size below 8", async () => { const r = await textToPdf("Test", { ...baseOpts, fontSize: 2 }); expect(r.ok).toBe(true); });
  it("clamps font size above 24", async () => { const r = await textToPdf("Test", { ...baseOpts, fontSize: 100 }); expect(r.ok).toBe(true); });
  it("sets creator metadata", async () => { const r = await textToPdf("Test", baseOpts); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getCreator()).toContain("UnQTools"); } });
  it("handles unicode text", async () => { const r = await textToPdf("Café — naïve résumé", baseOpts); expect(r.ok).toBe(true); });
});
