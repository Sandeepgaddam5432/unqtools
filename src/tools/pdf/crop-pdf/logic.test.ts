import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { cropPdf } from "./logic";

async function makePdf(pages: number, w = 595, h = 842): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) { const p = doc.addPage([w, h]); p.drawText(".", { x: 0, y: 0, size: 1 }); }
  return doc.save();
}

describe("cropPdf", () => {
  it("crops all pages with uniform margins", async () => {
    const pdf = await makePdf(3, 595, 842);
    const r = await cropPdf(pdf, { marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output);
      const crop = doc.getPages()[0].getCropBox();
      expect(crop.width).toBe(595 - 144);
      expect(crop.height).toBe(842 - 144);
    }
  });
  it("crops only selected pages", async () => {
    const pdf = await makePdf(3, 595, 842);
    const r = await cropPdf(pdf, { marginTop: 50, marginBottom: 0, marginLeft: 0, marginRight: 0, pages: "1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output);
      expect(doc.getPages()[0].getCropBox().height).toBe(842 - 50);
      expect(doc.getPages()[1].getCropBox().height).toBe(842);
    }
  });
  it("preserves page count", async () => {
    const pdf = await makePdf(5);
    const r = await cropPdf(pdf, { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect((await PDFDocument.load(r.output)).getPageCount()).toBe(5);
  });
  it("errors on zero margins → no-op but valid", async () => {
    const pdf = await makePdf(2);
    const r = await cropPdf(pdf, { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    expect(r.ok).toBe(true);
  });
  it("errors on margins too large", async () => {
    const pdf = await makePdf(1, 200, 200);
    const r = await cropPdf(pdf, { marginTop: 150, marginBottom: 150, marginLeft: 0, marginRight: 0 });
    expect(r.ok).toBe(false);
  });
  it("handles negative margins by clamping to 0", async () => {
    const pdf = await makePdf(1, 595, 842);
    const r = await cropPdf(pdf, { marginTop: -10, marginBottom: -10, marginLeft: -10, marginRight: -10 });
    expect(r.ok).toBe(true);
  });
  it("errors on invalid page range", async () => {
    const pdf = await makePdf(3);
    const r = await cropPdf(pdf, { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, pages: "9" });
    expect(r.ok).toBe(false);
  });
  it("errors on invalid PDF bytes", async () => {
    const r = await cropPdf(new Uint8Array([1, 2, 3]), { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10 });
    expect(r.ok).toBe(false);
  });
});
