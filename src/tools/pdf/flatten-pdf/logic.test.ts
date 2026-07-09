import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { flattenPdf } from "./logic";
async function makePdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) doc.addPage([200, 200]); return doc.save(); }
describe("flattenPdf", () => {
  it("preserves page count", async () => { const pdf = await makePdf(3); const r = await flattenPdf(pdf); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getPageCount()).toBe(3); } });
  it("drops form fields from source PDF", async () => { const pdf = await makePdf(2); const r = await flattenPdf(pdf); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); const form = doc.getForm(); expect(form.getFields().length).toBe(0); } });
  it("sets creator metadata", async () => { const pdf = await makePdf(1); const r = await flattenPdf(pdf); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getCreator()).toContain("UnQTools"); } });
  it("errors on invalid bytes", async () => { const r = await flattenPdf(new Uint8Array([1])); expect(r.ok).toBe(false); });
  it("handles single page", async () => { const pdf = await makePdf(1); const r = await flattenPdf(pdf); expect(r.ok).toBe(true); });
  it("handles 10 pages", async () => { const pdf = await makePdf(10); const r = await flattenPdf(pdf); expect(r.ok).toBe(true); if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBe(10); });
});
