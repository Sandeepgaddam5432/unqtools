import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { resizePdfPages } from "./logic";
async function makePdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) { const p = doc.addPage([200, 300]); p.drawText(".", { x: 0, y: 0, size: 1 }); } return doc.save(); }
describe("resizePdfPages", () => {
  it("resizes all pages to A4 portrait", async () => {
    const pdf = await makePdf(2); const r = await resizePdfPages(pdf, { preset: "a4", orientation: "portrait" });
    expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); const { width, height } = doc.getPages()[0].getSize(); expect(width).toBe(595.28); expect(height).toBe(841.89); }
  });
  it("resizes to A4 landscape", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "a4", orientation: "landscape" });
    expect(r.ok).toBe(true); if (r.ok) { const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(width).toBe(841.89); expect(height).toBe(595.28); }
  });
  it("resizes to custom dimensions", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "custom", customWidth: 400, customHeight: 600, orientation: "portrait" });
    expect(r.ok).toBe(true); if (r.ok) { const { width, height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(width).toBe(400); expect(height).toBe(600); }
  });
  it("resizes only selected pages", async () => {
    const pdf = await makePdf(3); const r = await resizePdfPages(pdf, { preset: "letter", orientation: "portrait", pages: "1" });
    expect(r.ok).toBe(true); if (r.ok) { const doc = await PDFDocument.load(r.output); expect(doc.getPages()[0].getSize().width).toBe(612); expect(doc.getPages()[1].getSize().width).toBe(200); }
  });
  it("errors on custom without dimensions", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "custom", orientation: "portrait" }); expect(r.ok).toBe(false);
  });
  it("errors on invalid page range", async () => {
    const pdf = await makePdf(2); const r = await resizePdfPages(pdf, { preset: "a4", orientation: "portrait", pages: "9" }); expect(r.ok).toBe(false);
  });
  it("errors on invalid bytes", async () => {
    const r = await resizePdfPages(new Uint8Array([1]), { preset: "a4", orientation: "portrait" }); expect(r.ok).toBe(false);
  });
  it("resizes to Legal", async () => {
    const pdf = await makePdf(1); const r = await resizePdfPages(pdf, { preset: "legal", orientation: "portrait" });
    expect(r.ok).toBe(true); if (r.ok) { const { height } = (await PDFDocument.load(r.output)).getPages()[0].getSize(); expect(height).toBe(1008); }
  });
});
