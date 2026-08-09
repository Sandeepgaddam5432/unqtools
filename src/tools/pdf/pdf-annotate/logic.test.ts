import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import { annotatePdf, buildAnnotationDict, hexToRgb, appendAnnotation } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("buildAnnotationDict", () => {
  it("builds a highlight with quad points", () => {
    const d = buildAnnotationDict("highlight", { x: 10, y: 20, width: 100, height: 12, color: "#ffff00", opacity: 0.5 });
    expect(d.Subtype.toString()).toBe("/Highlight");
    expect(d.QuadPoints.length).toBe(8);
  });

  it("builds a note with contents", () => {
    const d = buildAnnotationDict("note", { x: 5, y: 5, width: 20, height: 20, text: "Hi" });
    expect(d.Subtype.toString()).toBe("/Text");
    expect(String(d.Contents.decodeText())).toBe("Hi");
  });

  it("builds a line with arrow", () => {
    const d = buildAnnotationDict("line", { x: 0, y: 0, width: 50, height: 0, x2: 50, y2: 50, arrow: "end" });
    expect(d.Subtype.toString()).toBe("/Line");
    expect(d.L).toEqual([0, 0, 50, 50]);
  });
});

describe("hexToRgb", () => {
  it("returns pdf-lib RGB", () => {
    const c = hexToRgb("#ff0000");
    expect(c.red).toBe(1);
  });
});

describe("appendAnnotation", () => {
  it("creates an Annots array when missing", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([100, 100]);
    appendAnnotation(page, doc, { Subtype: PDFName.of("Text"), Rect: [0, 0, 10, 10] });
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    const annots = reloaded.getPages()[0].node.get(PDFName.of("Annots"));
    expect(annots instanceof PDFArray).toBe(true);
    expect(annots.size()).toBe(1);
  });
});

describe("annotatePdf", () => {
  it("adds a highlight to the first page", async () => {
    const pdf = await makePdf(2);
    const r = await annotatePdf(pdf, { type: "highlight", x: 10, y: 20, width: 100, height: 12 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.annotationsAdded).toBe(1);
      const doc = await PDFDocument.load(r.output.bytes);
      const annots = doc.getPages()[0].node.get(PDFName.of("Annots"));
      expect(annots instanceof PDFArray && annots.size()).toBe(1);
    }
  });

  it("adds annotations to a page range", async () => {
    const pdf = await makePdf(3);
    const r = await annotatePdf(pdf, { type: "note", x: 5, y: 5, width: 20, height: 20, text: "x", pages: "1,3" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.annotationsAdded).toBe(2);
  });

  it("adds a line with arrow to all pages", async () => {
    const pdf = await makePdf(2);
    const r = await annotatePdf(pdf, { type: "line", x: 0, y: 0, width: 50, height: 0, x2: 50, y2: 50, arrow: true, pages: "1-2" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.annotationsAdded).toBe(2);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await annotatePdf(new Uint8Array([1]), { type: "square", x: 0, y: 0, width: 10, height: 10 });
    expect(r.ok).toBe(false);
  });
});
