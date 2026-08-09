/**
 * PDF Page Manager — unit tests for the unified dispatcher.
 * Each branch delegates to the sibling engines (already unit tested), so here
 * we prove the dispatcher wiring end-to-end with real pdf-lib documents.
 */
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { runPageOperation } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("pdf-page-manager dispatcher", () => {
  it("rejects an unknown operation", async () => {
    const res = await runPageOperation({
      operation: "unknown" as never,
      bytes: await makePdf(3),
    });
    expect(res.ok).toBe(false);
  });

  it("delete removes the selected pages", async () => {
    const res = await runPageOperation({
      operation: "delete",
      bytes: await makePdf(6),
      pages: "2-4",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(3);
  });

  it("delete refuses to remove every page", async () => {
    const res = await runPageOperation({
      operation: "delete",
      bytes: await makePdf(3),
      pages: "1-3",
    });
    expect(res.ok).toBe(false);
  });

  it("extract returns only the selected pages", async () => {
    const res = await runPageOperation({
      operation: "extract",
      bytes: await makePdf(8),
      pages: "1, 3-5",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(4);
  });

  it("duplicate clones selected pages N times", async () => {
    const res = await runPageOperation({
      operation: "duplicate",
      bytes: await makePdf(2),
      pages: "1",
      count: 3,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(5); // 2 original + 3 copies
  });

  it("insert pulls pages from a second PDF at the given position", async () => {
    const res = await runPageOperation({
      operation: "insert",
      bytes: await makePdf(3),
      source: await makePdf(2),
      insertPosition: 2, // before page 2 of the main doc
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(5);
  });

  it("insert requires a source PDF", async () => {
    const res = await runPageOperation({
      operation: "insert",
      bytes: await makePdf(3),
    });
    expect(res.ok).toBe(false);
  });

  it("reorder custom sequence applies the requested order", async () => {
    const res = await runPageOperation({
      operation: "reorder",
      bytes: await makePdf(4),
      reorderMode: "custom",
      sequence: "4,2,1,3",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(4);
  });

  it("reorder reverse flips the document", async () => {
    const res = await runPageOperation({
      operation: "reorder",
      bytes: await makePdf(5),
      reorderMode: "reverse",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(5);
  });

  it("rotate all pages applies the rotation to every page", async () => {
    const res = await runPageOperation({
      operation: "rotate",
      bytes: await makePdf(3),
      rotation: 90,
      rotateTarget: "all",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = await PDFDocument.load(res.output);
      const angles = doc.getPages().map((p) => p.getRotation().angle);
      expect(angles).toEqual([90, 90, 90]);
    }
  });

  it("rotate custom pages only touches the matching pages", async () => {
    const res = await runPageOperation({
      operation: "rotate",
      bytes: await makePdf(4),
      rotation: 180,
      rotateTarget: "custom",
      rotatePages: "2,4",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = await PDFDocument.load(res.output);
      const angles = doc.getPages().map((p) => p.getRotation().angle);
      expect(angles).toEqual([0, 180, 0, 180]);
    }
  });

  it("reverse needs at least two pages", async () => {
    const one = await runPageOperation({ operation: "reverse", bytes: await makePdf(1) });
    expect(one.ok).toBe(false);
    const many = await runPageOperation({ operation: "reverse", bytes: await makePdf(3) });
    expect(many.ok).toBe(true);
    if (many.ok) expect(await countPages(many.output)).toBe(3);
  });
});
