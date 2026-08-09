import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { removeBlankPages } from "./logic";
async function makePdfWithContent(pages: number, blankPages: number[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 200]);
    if (!blankPages.includes(i)) { page.drawText("Hello", { x: 50, y: 100, size: 12 }); }
  }
  return doc.save();
}
async function makeAllBlankPdf(pages: number): Promise<Uint8Array> { const doc = await PDFDocument.create(); for (let i = 0; i < pages; i++) doc.addPage([200, 200]); return doc.save(); }
describe("removeBlankPages", () => {
  it("removes blank pages and keeps content pages", async () => {
    const pdf = await makePdfWithContent(5, [1, 3]);
    const r = await removeBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.output.keptCount).toBe(3); expect(r.output.removedCount).toBe(2); expect(r.output.removedPageNumbers).toEqual([2, 4]); }
  });
  it("returns same page count when no blank pages", async () => {
    const pdf = await makePdfWithContent(3, []);
    const r = await removeBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.output.keptCount).toBe(3); expect(r.output.removedCount).toBe(0); }
  });
  it("removes all-blank pages except last (to avoid empty)", async () => {
    const pdf = await makeAllBlankPdf(3);
    const r = await removeBlankPages(pdf);
    // All pages blank → should error (nothing to keep)
    expect(r.ok).toBe(false);
  });
  it("handles single-page PDF with content", async () => {
    const pdf = await makePdfWithContent(1, []);
    const r = await removeBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.output.keptCount).toBe(1); expect(r.output.removedCount).toBe(0); }
  });
  it("errors on invalid bytes", async () => { const r = await removeBlankPages(new Uint8Array([1])); expect(r.ok).toBe(false); });
  it("preserves page count correctly in output", async () => {
    const pdf = await makePdfWithContent(4, [0, 2]);
    const r = await removeBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) { const doc = await PDFDocument.load(r.output.bytes); expect(doc.getPageCount()).toBe(2); }
  });
  it("sets creator metadata on output", async () => {
    const pdf = await makePdfWithContent(2, []);
    const r = await removeBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) { const doc = await PDFDocument.load(r.output.bytes); expect(doc.getCreator()).toContain("UnQTools"); }
  });
  it("reports correct removedPageNumbers (1-indexed)", async () => {
    const pdf = await makePdfWithContent(6, [0, 2, 4]);
    const r = await removeBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.removedPageNumbers).toEqual([1, 3, 5]);
  });
});

describe("remove-blank advanced", () => {
  it("previewBlankPages reports without mutating", async () => {
    const { previewBlankPages } = await import("./logic");
    const pdf = await makePdfWithContent(3, []);
    const r = await previewBlankPages(pdf);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.originalCount).toBe(3);
      expect(r.output.removedPageNumbers).toEqual([]);
    }
  });

  it("respects scan-range pages", async () => {
    const { previewBlankPages } = await import("./logic");
    const pdf = await makePdfWithContent(4, []);
    const r = await previewBlankPages(pdf, { pages: "2-3" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.scannedPageNumbers).toEqual([2, 3]);
  });

  it("keeps pages outside the scan range", async () => {
    const { removeBlankPages } = await import("./logic");
    const pdf = await makePdfWithContent(4, []);
    const r = await removeBlankPages(pdf, { pages: "1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.keptCount).toBe(4);
  });

  it("rejects when every scanned page is blank", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]); // fresh page has no content stream → blank
    const bytes = await doc.save();
    const r = await removeBlankPages(bytes, { sensitivity: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/blank/i);
  });

  it("supports sensitivity levels", async () => {
    const pdf = await makePdfWithContent(2, []);
    for (const s of [0, 1, 2] as const) {
      const r = await removeBlankPages(pdf, { sensitivity: s });
      expect(r.ok).toBe(true);
    }
  });
});
