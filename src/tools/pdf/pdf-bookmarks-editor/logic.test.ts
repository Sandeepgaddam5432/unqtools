import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { setBookmarks, readBookmarks } from "./logic";
async function makePdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) { const p = doc.addPage([200, 200]); p.drawText(".", { x: 0, y: 0, size: 1 }); } return doc.save(); }
describe("setBookmarks", () => {
  it("sets bookmarks on a PDF", async () => { const pdf = await makePdf(5); const r = await setBookmarks(pdf, [{ title: "Chapter 1", page: 1 }, { title: "Chapter 2", page: 3 }]); expect(r.ok).toBe(true); });
  it("errors on empty bookmarks list", async () => { const pdf = await makePdf(3); const r = await setBookmarks(pdf, []); expect(r.ok).toBe(false); });
  it("errors on empty title", async () => { const pdf = await makePdf(3); const r = await setBookmarks(pdf, [{ title: "", page: 1 }]); expect(r.ok).toBe(false); });
  it("errors on page out of range", async () => { const pdf = await makePdf(3); const r = await setBookmarks(pdf, [{ title: "Ch1", page: 9 }]); expect(r.ok).toBe(false); });
  it("errors on page 0", async () => { const pdf = await makePdf(3); const r = await setBookmarks(pdf, [{ title: "Ch1", page: 0 }]); expect(r.ok).toBe(false); });
  it("errors on invalid bytes", async () => { const r = await setBookmarks(new Uint8Array([1]), [{ title: "Ch1", page: 1 }]); expect(r.ok).toBe(false); });
  it("handles single bookmark", async () => { const pdf = await makePdf(2); const r = await setBookmarks(pdf, [{ title: "Start", page: 1 }]); expect(r.ok).toBe(true); });
  it("handles 10 bookmarks", async () => { const pdf = await makePdf(10); const bms = Array.from({ length: 10 }, (_, i) => ({ title: `Page ${i + 1}`, page: i + 1 })); const r = await setBookmarks(pdf, bms); expect(r.ok).toBe(true); });
});
describe("readBookmarks", () => {
  it("reads bookmarks from a PDF without bookmarks", async () => { const pdf = await makePdf(3); const r = await readBookmarks(pdf); expect(r.ok).toBe(true); if (r.ok) expect(r.output.bookmarks).toEqual([]); });
  it("reads bookmarks after setting them", async () => {
    const pdf = await makePdf(5);
    const set = await setBookmarks(pdf, [{ title: "Ch1", page: 1 }, { title: "Ch2", page: 3 }]);
    expect(set.ok).toBe(true);
    if (set.ok) { const r = await readBookmarks(set.output); expect(r.ok).toBe(true); if (r.ok) expect(r.output.bookmarks.length).toBe(2); }
  });
  it("errors on invalid bytes", async () => { const r = await readBookmarks(new Uint8Array([1])); expect(r.ok).toBe(false); });
});
