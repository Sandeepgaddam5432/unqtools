import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractPdfPages } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("extractPdfPages", () => {
  it("extracts a simple range", async () => {
    const pdf = await makePdf(6);
    const res = await extractPdfPages(pdf, "2-4");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.pageCount).toBe(3);
      expect(await countPages(res.output.bytes)).toBe(3);
    }
  });

  it("extracts a single page", async () => {
    const pdf = await makePdf(5);
    const res = await extractPdfPages(pdf, "3");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.pageCount).toBe(1);
  });

  it("extracts mixed pages and ranges", async () => {
    const pdf = await makePdf(8);
    const res = await extractPdfPages(pdf, "1, 4-6, 8");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.pageCount).toBe(5);
  });

  it("supports open-ended range to end", async () => {
    const pdf = await makePdf(5);
    const res = await extractPdfPages(pdf, "3-");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.pageCount).toBe(3);
  });

  it("allows duplicate pages", async () => {
    const pdf = await makePdf(3);
    const res = await extractPdfPages(pdf, "1, 1, 1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.pageCount).toBe(3);
  });

  it("errors on empty spec", async () => {
    const pdf = await makePdf(3);
    expect((await extractPdfPages(pdf, "")).ok).toBe(false);
  });

  it("errors on out-of-bounds", async () => {
    const pdf = await makePdf(3);
    expect((await extractPdfPages(pdf, "9")).ok).toBe(false);
  });

  it("errors on invalid bytes", async () => {
    expect((await extractPdfPages(new Uint8Array([1, 2, 3]), "1")).ok).toBe(false);
  });
});
