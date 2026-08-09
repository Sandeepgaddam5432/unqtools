import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { splitByBookmarks } from "./logic";
import { writeOutlines } from "../pdf-bookmarks/logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("splitByBookmarks", () => {
  it("splits at bookmark boundaries", async () => {
    const pdf = await makePdf(6);
    const doc = await PDFDocument.load(pdf);
    writeOutlines(doc, [
      { title: "Chapter 1", page: 1 },
      { title: "Chapter 2", page: 3 },
      { title: "Chapter 3", page: 5 },
    ]);
    const withBm = await doc.save();
    const r = await splitByBookmarks(withBm, "book");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.parts.length).toBe(3);
      expect(r.output.parts[0]!.startPage).toBe(1);
      expect(r.output.parts[0]!.endPage).toBe(2);
      expect(r.output.parts[1]!.startPage).toBe(3);
      expect(r.output.parts[1]!.endPage).toBe(4);
      expect(r.output.parts[2]!.startPage).toBe(5);
      expect(r.output.parts[2]!.endPage).toBe(6);
      const totalPages = r.output.parts.reduce((a, p) => a + p.pageCount, 0);
      expect(totalPages).toBe(6);
    }
  });

  it("requires at least 2 valid bookmarks", async () => {
    const pdf = await makePdf(4);
    const doc = await PDFDocument.load(pdf);
    writeOutlines(doc, [{ title: "Only", page: 1 }]);
    const r = await splitByBookmarks(await doc.save());
    expect(r.ok).toBe(false);
  });

  it("errors when the PDF has no bookmarks", async () => {
    const r = await splitByBookmarks(await makePdf(3));
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await splitByBookmarks(new Uint8Array([1, 2]));
    expect(r.ok).toBe(false);
  });
});
