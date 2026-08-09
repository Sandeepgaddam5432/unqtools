import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addBookmarks, removeBookmarks, readOutlines, writeOutlines } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("writeOutlines + readOutlines", () => {
  it("writes bookmarks and reads them back", async () => {
    const pdf = await makePdf(3);
    const doc = await PDFDocument.load(pdf);
    writeOutlines(doc, [
      { title: "Intro", page: 1 },
      { title: "Chapter 1", page: 2 },
      { title: "Conclusion", page: 3 },
    ]);
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    const bookmarks = readOutlines(reloaded);
    expect(bookmarks.map((b) => b.title)).toEqual(["Intro", "Chapter 1", "Conclusion"]);
    expect(bookmarks[1]!.page).toBe(2);
  });

  it("clamps out-of-range page numbers", async () => {
    const pdf = await makePdf(2);
    const doc = await PDFDocument.load(pdf);
    writeOutlines(doc, [{ title: "Far", page: 99 }]);
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(readOutlines(reloaded)[0]!.page).toBe(2);
  });

  it("removes the outline tree when empty", async () => {
    const pdf = await makePdf(2);
    const doc = await PDFDocument.load(pdf);
    writeOutlines(doc, []);
    const bytes = await doc.save();
    const reloaded = await PDFDocument.load(bytes);
    expect(readOutlines(reloaded)).toEqual([]);
  });
});

describe("addBookmarks / removeBookmarks", () => {
  it("adds bookmarks through the public API", async () => {
    const pdf = await makePdf(4);
    const r = await addBookmarks(pdf, [
      { title: "A", page: 1 },
      { title: "B", page: 3 },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.bookmarks.length).toBe(2);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(readOutlines(doc).length).toBe(2);
    }
  });

  it("removes bookmarks", async () => {
    const pdf = await makePdf(2);
    const added = await addBookmarks(pdf, [{ title: "X", page: 1 }]);
    expect(added.ok).toBe(true);
    if (added.ok) {
      const removed = await removeBookmarks(added.output.bytes);
      expect(removed.ok).toBe(true);
      if (removed.ok) {
        const doc = await PDFDocument.load(removed.output.bytes);
        expect(readOutlines(doc)).toEqual([]);
      }
    }
  });

  it("errors on empty bookmark list", async () => {
    const pdf = await makePdf(2);
    const r = await addBookmarks(pdf, []);
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await addBookmarks(new Uint8Array([1, 2]), [{ title: "x", page: 1 }]);
    expect(r.ok).toBe(false);
  });
});
