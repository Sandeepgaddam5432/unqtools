import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addPageBorder, borderRects, hexToRgb } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("border pure helpers", () => {
  it("borderRects returns 4 rects inside the page", () => {
    const rects = borderRects(200, 300, 12, 2);
    expect(rects.length).toBe(4);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
    // top and bottom spans full width
    expect(rects[0]!.width).toBe(200 - 24);
    expect(rects[1]!.width).toBe(200 - 24);
  });

  it("borderRects clamps inset to page bounds", () => {
    const rects = borderRects(100, 100, 200, 2);
    for (const r of rects) expect(r.width).toBeGreaterThan(0);
  });

  it("hexToRgb parses colors", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb("00ff00").g).toBe(1);
  });
});

describe("addPageBorder", () => {
  it("adds solid border to all pages", async () => {
    const pdf = await makePdf(2);
    const r = await addPageBorder(pdf, { width: 2, color: "#000000", inset: 12 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pagesBordered).toBe(2);
      expect((await PDFDocument.load(r.output.bytes)).getPageCount()).toBe(2);
    }
  });

  it("adds dashed border", async () => {
    const pdf = await makePdf(1);
    const r = await addPageBorder(pdf, { width: 3, style: "dashed", color: "#336699" });
    expect(r.ok).toBe(true);
  });

  it("adds double border", async () => {
    const pdf = await makePdf(1);
    const r = await addPageBorder(pdf, { width: 4, style: "double" });
    expect(r.ok).toBe(true);
  });

  it("applies to a page range only", async () => {
    const pdf = await makePdf(3);
    const r = await addPageBorder(pdf, { pages: "2" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pagesBordered).toBe(1);
  });

  it("clamps extreme widths", async () => {
    const pdf = await makePdf(1);
    const r = await addPageBorder(pdf, { width: 999 });
    expect(r.ok).toBe(true);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await addPageBorder(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
