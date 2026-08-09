import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { nUpPdf, gridFor, planLayout } from "./logic";
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

describe("n-up advanced (grid, layout, options)", () => {
  it("gridFor picks the most square grid", () => {
    
    expect(gridFor(4)).toEqual({ cols: 2, rows: 2 });
    expect(gridFor(2)).toEqual({ cols: 2, rows: 1 });
    expect(gridFor(1)).toEqual({ cols: 1, rows: 1 });
    expect(gridFor(6).cols * gridFor(6).rows).toBe(6);
    expect(gridFor(99).cols * gridFor(99).rows).toBeLessThanOrEqual(16);
  });

  it("planLayout assigns row order and column order differently", () => {
    
    const row = planLayout(8, 4, "row");
    const col = planLayout(8, 4, "column");
    expect(row[0]).toEqual({ sheet: 0, cell: 0 });
    expect(row[4]).toEqual({ sheet: 1, cell: 0 });
    expect(col[1]).toEqual({ sheet: 0, cell: 2 }); // column order: next goes down first col
  });

  it("supports custom sheet size and borders", async () => {
    const pdf = await makePdf(4);
    const res = await nUpPdf(pdf, { pagesPerSheet: 4, sheet: "custom", customWidth: 400, customHeight: 600, borders: true });
    expect(res.ok).toBe(true);
    if (res.ok) expect((await PDFDocument.load(res.output)).getPageCount()).toBe(1);
  });

  it("supports sheet numbers and A3", async () => {
    const pdf = await makePdf(5);
    const res = await nUpPdf(pdf, { pagesPerSheet: 4, sheet: "a3", sheetNumbers: true });
    expect(res.ok).toBe(true);
    if (res.ok) expect((await PDFDocument.load(res.output)).getPageCount()).toBe(2);
  });

  it("rejects invalid custom size", async () => {
    const pdf = await makePdf(2);
    const res = await nUpPdf(pdf, { pagesPerSheet: 2, sheet: "custom", customWidth: 0, customHeight: 0 });
    expect(res.ok).toBe(false);
  });
});
