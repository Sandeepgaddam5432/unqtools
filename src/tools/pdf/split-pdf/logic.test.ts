import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { splitPdf } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("splitPdf", () => {
  it("splits one file per page in single mode", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "single", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.length).toBe(3);
      expect(result.output.map((f) => f.name)).toEqual([
        "doc-page-1.pdf",
        "doc-page-2.pdf",
        "doc-page-3.pdf",
      ]);
      expect(await countPages(result.output[0].bytes)).toBe(1);
    }
  });

  it("splits into chunks in every-N mode, last chunk smaller", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, { mode: "every", every: 2, baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.map((f) => f.pageCount)).toEqual([2, 2, 1]);
      expect(result.output.map((f) => f.name)).toEqual([
        "doc-part-1.pdf",
        "doc-part-2.pdf",
        "doc-part-3.pdf",
      ]);
      expect(await countPages(result.output[2].bytes)).toBe(1);
    }
  });

  it("returns one file when chunk size exceeds the page count", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "every", every: 10, baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.length).toBe(1);
      expect(result.output[0].pageCount).toBe(3);
    }
  });

  it("rejects a chunk size below 1", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "every", every: 0, baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("splits by custom ranges — each group becomes a file", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "1-2, 4", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.map((f) => f.pageCount)).toEqual([2, 1]);
      expect(result.output[0].name).toBe("doc-pages-1-2.pdf");
      expect(result.output[1].name).toBe("doc-pages-4.pdf");
      expect(await countPages(result.output[0].bytes)).toBe(2);
    }
  });

  it("allows overlapping range groups", async () => {
    const pdf = await makePdf(5);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "1-3, 2-5", baseName: "doc.pdf" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output.map((f) => f.pageCount)).toEqual([3, 4]);
  });

  it("rejects an empty ranges spec", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "  ", baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-bounds ranges", async () => {
    const pdf = await makePdf(3);
    const result = await splitPdf(pdf, { mode: "ranges", ranges: "9", baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const result = await splitPdf(new Uint8Array([1, 2, 3]), { mode: "single", baseName: "doc.pdf" });
    expect(result.ok).toBe(false);
  });

  it("derives output names from the base filename, with a fallback", async () => {
    const pdf = await makePdf(1);
    const named = await splitPdf(pdf, { mode: "single", baseName: "My Report.pdf" });
    expect(named.ok).toBe(true);
    if (named.ok) expect(named.output[0].name).toBe("My Report-page-1.pdf");
    const unnamed = await splitPdf(pdf, { mode: "single", baseName: "" });
    expect(unnamed.ok).toBe(true);
    if (unnamed.ok) expect(unnamed.output[0].name).toBe("split-page-1.pdf");
  });
});
