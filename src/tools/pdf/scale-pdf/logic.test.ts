import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { scalePdf } from "./logic";
async function makePdf(pages: number, w = 595, h = 842): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) { const p = doc.addPage([w, h]); p.drawText(".", { x: 0, y: 0, size: 1 }); } return doc.save(); }
describe("scalePdf", () => {
  it("scales all pages to 50%", async () => {
    const pdf = await makePdf(2, 595, 842); const r = await scalePdf(pdf, { scale: 0.5 });
    expect(r.ok).toBe(true); if (r.ok) { const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(Math.round(width)).toBe(298); expect(Math.round(height)).toBe(421); }
  });
  it("scales all pages to 200%", async () => {
    const pdf = await makePdf(1, 200, 200); const r = await scalePdf(pdf, { scale: 2 });
    expect(r.ok).toBe(true); if (r.ok) { const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(width).toBe(400); expect(height).toBe(400); }
  });
  it("scales only selected pages", async () => {
    const pdf = await makePdf(2, 200, 200); const r = await scalePdf(pdf, { scale: 2, pages: "1" });
    expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getPages()[0].getSize().width).toBe(400); expect(doc.getPages()[1].getSize().width).toBe(200); }
  });
  it("errors on scale below 25%", async () => { const pdf = await makePdf(1); const r = await scalePdf(pdf, { scale: 0.1 }); expect(r.ok).toBe(false); });
  it("errors on scale above 400%", async () => { const pdf = await makePdf(1); const r = await scalePdf(pdf, { scale: 5 }); expect(r.ok).toBe(false); });
  it("errors on invalid page range", async () => { const pdf = await makePdf(2); const r = await scalePdf(pdf, { scale: 1, pages: "9" }); expect(r.ok).toBe(false); });
  it("errors on invalid bytes", async () => { const r = await scalePdf(new Uint8Array([1]), { scale: 1 }); expect(r.ok).toBe(false); });
  it("100% scale is a no-op but valid", async () => { const pdf = await makePdf(1, 200, 200); const r = await scalePdf(pdf, { scale: 1 }); expect(r.ok).toBe(true); });
});
