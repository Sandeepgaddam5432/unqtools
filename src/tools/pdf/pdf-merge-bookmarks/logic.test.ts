import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfsWithBookmarks } from "./logic";
import { writeOutlines, readOutlines } from "../pdf-bookmarks/logic";

async function makePdf(pages: number, withBm = false): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  if (withBm) {
    writeOutlines(doc, [
      { title: "Intro", page: 1 },
      { title: "Chapter", page: 2 },
    ]);
  }
  return doc.save();
}

describe("mergePdfsWithBookmarks", () => {
  it("merges files and creates file-level bookmarks", async () => {
    const r = await mergePdfsWithBookmarks([
      { name: "a.pdf", bytes: await makePdf(2) },
      { name: "b.pdf", bytes: await makePdf(3) },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.totalPages).toBe(5);
      expect(r.output.files).toBe(2);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(5);
      const outlines = readOutlines(doc);
      expect(outlines.some((o) => o.title === "a")).toBe(true);
      expect(outlines.some((o) => o.title === "b")).toBe(true);
    }
  });

  it("re-anchors internal bookmarks with offsets", async () => {
    const r = await mergePdfsWithBookmarks([
      { name: "one.pdf", bytes: await makePdf(3, true) },
      { name: "two.pdf", bytes: await makePdf(2, true) },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const doc = await PDFDocument.load(r.output.bytes);
      const outlines = readOutlines(doc);
      // "one.pdf › Chapter" should now point to page 2 (offset 0).
      expect(outlines.some((o) => o.title.includes("one / Chapter") && o.page === 2)).toBe(true);
      // "two.pdf › Chapter" should now point to page 5 (offset 3 + 2).
      expect(outlines.some((o) => o.title.includes("two / Chapter") && o.page === 5)).toBe(true);
    }
  });

  it("errors without files", async () => {
    const r = await mergePdfsWithBookmarks([]);
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await mergePdfsWithBookmarks([{ name: "bad.pdf", bytes: new Uint8Array([1, 2]) }]);
    expect(r.ok).toBe(false);
  });
});
