import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { cropPdf, previewCrop, toPoints, CROP_PRESETS } from "./logic";

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

describe("cropPdf advanced (units, presets, reset, preview)", () => {
  it("converts mm to points correctly", async () => {
    expect(toPoints(25.4, "mm")).toBeCloseTo(72, 1);
    expect(toPoints(1, "in")).toBe(72);
    expect(toPoints(36, "pt")).toBe(36);
  });

  it("applies mm-unit margins", async () => {
    const pdf = await makePdf(1, 595, 842);
    const r = await cropPdf(pdf, { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, unit: "mm" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output);
      const crop = doc.getPages()[0].getCropBox();
      const mm10 = (10 * 72) / 25.4;
      expect(crop.width).toBeCloseTo(595 - 2 * mm10, 1);
      expect(crop.height).toBeCloseTo(842 - 2 * mm10, 1);
    }
  });

  it("reset restores the full page", async () => {
    const pdf = await makePdf(1, 595, 842);
    const cropped = await cropPdf(pdf, { marginTop: 100, marginBottom: 100, marginLeft: 100, marginRight: 100 });
    expect(cropped.ok).toBe(true);
    if (cropped.ok) {
      const r = await cropPdf(cropped.output, { marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, reset: true });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const doc = await PDFDocument.load(r.output);
        expect(doc.getPages()[0].getCropBox().width).toBe(595);
        expect(doc.getPages()[0].getCropBox().height).toBe(842);
      }
    }
  });

  it("previewCrop reports before/after dimensions", async () => {
    const pdf = await makePdf(2, 595, 842);
    const r = await previewCrop(pdf, { marginTop: 72, marginBottom: 0, marginLeft: 0, marginRight: 0, pages: "1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.before.length).toBe(2);
      expect(r.output.before[0]!.height).toBe(842);
      expect(r.output.after[0]!.height).toBe(842 - 72);
      expect(r.output.after[1]!.height).toBe(842); // page 2 untouched
    }
  });

  it("CROP_PRESETS are all positive", () => {
    for (const p of CROP_PRESETS) expect(p.mm).toBeGreaterThan(0);
  });
});
