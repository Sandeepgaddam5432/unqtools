import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addMargins, toPoints } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("toPoints", () => {
  it("converts mm/in/pt", () => {
    expect(toPoints(25.4, "mm")).toBeCloseTo(72, 1);
    expect(toPoints(1, "in")).toBe(72);
    expect(toPoints(36, "pt")).toBe(36);
  });
  it("clamps negatives", () => {
    expect(toPoints(-5, "mm")).toBe(0);
  });
});

describe("addMargins", () => {
  it("grows the page and keeps content visible", async () => {
    const pdf = await makePdf(1);
    const r = await addMargins(pdf, { top: 10, bottom: 10, left: 10, right: 10, unit: "mm" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      const page = doc.getPages()[0]!;
      const media = page.getMediaBox();
      const crop = page.getCropBox();
      const mm10 = (10 * 72) / 25.4;
      expect(media.width).toBeCloseTo(200 + 2 * mm10, 1);
      expect(media.height).toBeCloseTo(300 + 2 * mm10, 1);
      expect(crop.width).toBe(200);
      expect(crop.height).toBe(300);
    }
  });

  it("applies to selected pages only", async () => {
    const pdf = await makePdf(2);
    const r = await addMargins(pdf, { top: 20, bottom: 0, left: 0, right: 0, unit: "pt", pages: "1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pagesModified).toBe(1);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPages()[0].getMediaBox().height).toBe(300 + 20);
      expect(doc.getPages()[1].getMediaBox().height).toBe(300);
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await addMargins(new Uint8Array([1, 2]), { top: 5, bottom: 5, left: 5, right: 5 });
    expect(r.ok).toBe(false);
  });

  it("invalid page range errors", async () => {
    const pdf = await makePdf(2);
    const r = await addMargins(pdf, { top: 5, bottom: 5, left: 5, right: 5, pages: "9" });
    expect(r.ok).toBe(false);
  });
});
