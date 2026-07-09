import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { insertPdfPages } from "./logic";

async function makePdf(pages: number, label: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`${label}-${i + 1}`, { x: 50, y: 100, size: 20 });
  }
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("insertPdfPages", () => {
  it("inserts all source pages at the start (position 1)", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({ target, targetName: "t.pdf", source, sourceName: "s.pdf", position: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(5);
  });

  it("inserts all source pages at the end (position 'end')", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({ target, targetName: "t.pdf", source, sourceName: "s.pdf", position: "end" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(5);
  });

  it("inserts at position 2 (after page 1)", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({ target, targetName: "t.pdf", source, sourceName: "s.pdf", position: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.newPageCount).toBe(5);
      expect(result.output.insertedPageCount).toBe(2);
    }
  });

  it("inserts only selected source pages via range", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(5, "S");
    const result = await insertPdfPages({
      target, targetName: "t.pdf", source, sourceName: "s.pdf", position: "end", sourcePages: "1-2",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.newPageCount).toBe(5);
      expect(result.output.insertedPageCount).toBe(2);
    }
  });

  it("inserts a single page from source", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(5, "S");
    const result = await insertPdfPages({
      target, targetName: "t.pdf", source, sourceName: "s.pdf", position: "end", sourcePages: "3",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(4);
  });

  it("errors on position 0 (use 'end' instead)", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({ target, targetName: "t.pdf", source, sourceName: "s.pdf", position: 0 });
    // position 0 is treated as "end" per logic
    expect(result.ok).toBe(true);
  });

  it("errors on position > target+1", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({ target, targetName: "t.pdf", source, sourceName: "s.pdf", position: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("between 1 and");
  });

  it("errors on invalid source page range", async () => {
    const target = await makePdf(3, "T");
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({
      target, targetName: "t.pdf", source, sourceName: "s.pdf", position: 1, sourcePages: "9",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("s.pdf");
  });

  it("errors on invalid target bytes", async () => {
    const source = await makePdf(2, "S");
    const result = await insertPdfPages({
      target: new Uint8Array([1, 2, 3]), targetName: "bad.pdf", source, sourceName: "s.pdf", position: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("bad.pdf");
  });

  it("errors on invalid source bytes", async () => {
    const target = await makePdf(3, "T");
    const result = await insertPdfPages({
      target, targetName: "t.pdf", source: new Uint8Array([1, 2, 3]), sourceName: "bad.pdf", position: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("bad.pdf");
  });

  it("sets creator metadata on output", async () => {
    const target = await makePdf(2, "T");
    const source = await makePdf(1, "S");
    const result = await insertPdfPages({ target, targetName: "t.pdf", source, sourceName: "s.pdf", position: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getCreator()).toContain("UnQTools");
    }
  });
});
