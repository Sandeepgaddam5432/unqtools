import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfs } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("mergePdfs", () => {
  it("merges two PDFs keeping all pages", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const result = await mergePdfs([
      { name: "a.pdf", bytes: a },
      { name: "b.pdf", bytes: b },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(5);
  });

  it("passes a single file through with all pages", async () => {
    const a = await makePdf(3);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("honors per-file page ranges", async () => {
    const a = await makePdf(4);
    const b = await makePdf(4);
    const result = await mergePdfs([
      { name: "a.pdf", bytes: a, pages: "1-2" },
      { name: "b.pdf", bytes: b, pages: "4" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("treats an empty pages spec as all pages", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "   " }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(2);
  });

  it("supports duplicating pages via repeated entries", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "1,1,1" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("supports open-ended ranges", async () => {
    const a = await makePdf(4);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "2-" }]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(3);
  });

  it("errors on an empty input list", async () => {
    const result = await mergePdfs([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("at least one");
  });

  it("errors with the file name when bytes are not a valid PDF", async () => {
    const result = await mergePdfs([{ name: "broken.pdf", bytes: new Uint8Array([1, 2, 3]) }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("broken.pdf");
  });

  it("errors with the file name when a page range is invalid", async () => {
    const a = await makePdf(2);
    const result = await mergePdfs([{ name: "a.pdf", bytes: a, pages: "9" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("a.pdf");
  });

  it("merges three files in the given order by page count", async () => {
    const a = await makePdf(1);
    const b = await makePdf(2);
    const c = await makePdf(3);
    const result = await mergePdfs([
      { name: "a.pdf", bytes: a },
      { name: "b.pdf", bytes: b, pages: "1" },
      { name: "c.pdf", bytes: c, pages: "2-3" },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output)).toBe(4);
  });
});
