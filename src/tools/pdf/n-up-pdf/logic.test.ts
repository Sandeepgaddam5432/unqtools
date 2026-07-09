import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { nUpPdf } from "./logic";
async function makePdf(pages: number, w = 595, h = 842): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) { const p = doc.addPage([w, h]); p.drawText(".", { x: 0, y: 0, size: 1 }); } return doc.save(); }
async function countPages(b: Uint8Array): Promise<number> { return (await PDFDocument.load(b)).getPageCount(); }
describe("nUpPdf", () => {
  it("4 pages with 2-up = 2 output sheets", async () => { const pdf = await makePdf(4); const r = await nUpPdf(pdf, 2); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(2); });
  it("4 pages with 4-up = 1 output sheet", async () => { const pdf = await makePdf(4); const r = await nUpPdf(pdf, 4); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("9 pages with 4-up = 3 output sheets", async () => { const pdf = await makePdf(9); const r = await nUpPdf(pdf, 4); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(3); });
  it("1 page with 2-up = 1 output sheet", async () => { const pdf = await makePdf(1); const r = await nUpPdf(pdf, 2); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("16 pages with 16-up = 1 output sheet", async () => { const pdf = await makePdf(16); const r = await nUpPdf(pdf, 16); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("6 pages with 6-up = 1 output sheet", async () => { const pdf = await makePdf(6); const r = await nUpPdf(pdf, 6); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("8 pages with 8-up = 1 output sheet", async () => { const pdf = await makePdf(8); const r = await nUpPdf(pdf, 8); expect(r.ok).toBe(true); if (r.ok) expect(await countPages(r.output)).toBe(1); });
  it("errors on invalid PDF bytes", async () => { const r = await nUpPdf(new Uint8Array([1]), 4); expect(r.ok).toBe(false); });
  it("sets creator metadata on output", async () => { const pdf = await makePdf(4); const r = await nUpPdf(pdf, 4); expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getCreator()).toContain("UnQTools"); } });
});
