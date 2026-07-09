import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { generateContactSheet } from "./logic";
async function makePdf(pages: number, w = 595, h = 842): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) { const p = doc.addPage([w, h]); p.drawText(".", { x: 0, y: 0, size: 1 }); } return doc.save(); }
async function countPages(b: Uint8Array): Promise<number> { return (await PDFDocument.load(b)).getPageCount(); }
describe("generateContactSheet", () => {
  it("4 pages with 2x2 grid = 1 sheet", async () => { const pdf = await makePdf(4); const r = await generateContactSheet(pdf, 2, true); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("9 pages with 3x3 grid = 1 sheet", async () => { const pdf = await makePdf(9); const r = await generateContactSheet(pdf, 3, false); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("10 pages with 3x3 grid = 2 sheets", async () => { const pdf = await makePdf(10); const r = await generateContactSheet(pdf, 3, true); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(2); });
  it("16 pages with 4x4 grid = 1 sheet", async () => { const pdf = await makePdf(16); const r = await generateContactSheet(pdf, 4, false); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("25 pages with 5x5 grid = 1 sheet", async () => { const pdf = await makePdf(25); const r = await generateContactSheet(pdf, 5, true); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("1 page = 1 sheet", async () => { const pdf = await makePdf(1); const r = await generateContactSheet(pdf, 2, true); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("errors on invalid bytes", async () => { const r = await generateContactSheet(new Uint8Array([1]), 2, true); expect(r.ok).toBe(false); });
  it("sets creator metadata", async () => { const pdf = await makePdf(4); const r = await generateContactSheet(pdf, 2, false); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getCreator()).toContain("UnQTools"); } });
  it("handles showLabels = false", async () => { const pdf = await makePdf(4); const r = await generateContactSheet(pdf, 2, false); expect(r.ok).toBe(true); });
});
