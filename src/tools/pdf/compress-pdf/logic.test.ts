import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { compressPdf } from "./logic";

async function makePdf(pages: number, withMetadata = true): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  if (withMetadata) {
    doc.setTitle("Test Title");
    doc.setAuthor("Test Author");
    doc.setSubject("Test Subject");
    doc.setKeywords(["kw1", "kw2"]);
    doc.setCreator("Test Creator");
  }
  return doc.save();
}

describe("compressPdf", () => {
  it("compresses a PDF and returns smaller or equal bytes", async () => {
    const pdf = await makePdf(5);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.compressedSize).toBeLessThanOrEqual(result.output.originalSize);
      expect(result.output.reductionPercent).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns valid PDF bytes that can be re-loaded", async () => {
    const pdf = await makePdf(3);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("preserves page count after compression", async () => {
    const pdf = await makePdf(7);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getPageCount()).toBe(7);
    }
  });

  it("strips metadata when stripMetadata is true", async () => {
    const pdf = await makePdf(2, true);
    const result = await compressPdf(pdf, { stripMetadata: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getTitle() ?? "").toBe("");
      expect(doc.getAuthor() ?? "").toBe("");
      expect(doc.getSubject() ?? "").toBe("");
      expect(doc.getCreator() ?? "").toBe("");
      expect(result.output.metadataStripped).toBe(true);
    }
  });

  it("preserves metadata when stripMetadata is false", async () => {
    const pdf = await makePdf(2, true);
    const result = await compressPdf(pdf, { stripMetadata: false });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getTitle()).toBe("Test Title");
      expect(doc.getAuthor()).toBe("Test Author");
      expect(result.output.metadataStripped).toBe(false);
    }
  });

  it("reports original and compressed sizes correctly", async () => {
    const pdf = await makePdf(3);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.originalSize).toBe(pdf.length);
      expect(result.output.compressedSize).toBe(result.output.bytes.length);
    }
  });

  it("errors on invalid PDF bytes", async () => {
    const result = await compressPdf(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
  });

  it("errors on empty bytes", async () => {
    const result = await compressPdf(new Uint8Array(0));
    expect(result.ok).toBe(false);
  });

  it("handles a single-page PDF", async () => {
    const pdf = await makePdf(1);
    const result = await compressPdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getPageCount()).toBe(1);
    }
  });
});
