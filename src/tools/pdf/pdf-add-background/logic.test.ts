import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  addBackground,
  colorBackgroundOperators,
  prependContentStream,
  hexToRgb,
} from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i + 1}`, { x: 10, y: 10, size: 8 });
  }
  return doc.save();
}

const tinyPng = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  )
);

describe("background pure helpers", () => {
  it("colorBackgroundOperators emits a fill rect with GS_bg", () => {
    const ops = colorBackgroundOperators(200, 300, "#ff0000");
    expect(ops).toContain("GS_bg");
    expect(ops).toContain("1.0000 0.0000 0.0000 rg");
    expect(ops).toContain("200 300 re f");
  });

  it("hexToRgb handles 3-digit and 6-digit hex", () => {
    const c = hexToRgb("#f00");
    expect(c.r).toBe(1);
    expect(c.g).toBe(0);
    const d = hexToRgb("336699");
    expect(d.r).toBeCloseTo(0x33 / 255, 3);
    expect(d.b).toBeCloseTo(0x99 / 255, 3);
  });

  it("prependContentStream adds a stream at the front", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([100, 100]);
    page.drawText("hi", { x: 5, y: 5, size: 8 });
    prependContentStream(page, doc, "q 1 0 0 rg 0 0 100 100 re f Q\n");
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    const contents = reloaded.getPages()[0].node.get(PDFName.of("Contents"));
    expect(contents).toBeDefined();
  });
});

describe("addBackground", () => {
  it("fills all pages with a color", async () => {
    const pdf = await makePdf(3);
    const r = await addBackground(pdf, { mode: "color", color: "#ffeeaa", opacity: 0.5 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pagesModified).toBe(3);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("applies color to a page range only", async () => {
    const pdf = await makePdf(4);
    const r = await addBackground(pdf, { mode: "color", color: "#00ff00", pages: "1,3" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pagesModified).toBe(2);
  });

  it("embeds an image background", async () => {
    const pdf = await makePdf(1);
    const r = await addBackground(pdf, { mode: "image", imageBytes: tinyPng, imageFit: "fit", opacity: 0.4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pagesModified).toBe(1);
  });

  it("tiles an image background", async () => {
    const pdf = await makePdf(1);
    const r = await addBackground(pdf, { mode: "image", imageBytes: tinyPng, imageFit: "tile", opacity: 0.3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pagesModified).toBe(1);
  });

  it("underlays a page from another PDF", async () => {
    const main = await makePdf(2);
    const under = await makePdf(3);
    const r = await addBackground(main, { mode: "page", underlayBytes: under, underlayPage: 2, opacity: 0.5 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pagesModified).toBe(2);
  });

  it("errors without an image in image mode", async () => {
    const pdf = await makePdf(1);
    const r = await addBackground(pdf, { mode: "image" });
    expect(r.ok).toBe(false);
  });

  it("errors with a bad underlay page", async () => {
    const main = await makePdf(1);
    const under = await makePdf(2);
    const r = await addBackground(main, { mode: "page", underlayBytes: under, underlayPage: 9 });
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await addBackground(new Uint8Array([1, 2, 3]), { mode: "color" });
    expect(r.ok).toBe(false);
  });
});
