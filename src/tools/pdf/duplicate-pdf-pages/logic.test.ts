import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { duplicatePdfPages } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

describe("duplicatePdfPages", () => {
  it("duplicates a single page once (adds 1 copy at end)", async () => {
    const pdf = await makePdf(3);
    const result = await duplicatePdfPages(pdf, { pages: "2", count: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(4);
  });

  it("duplicates a single page 3 times", async () => {
    const pdf = await makePdf(3);
    const result = await duplicatePdfPages(pdf, { pages: "1", count: 3 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(6);
  });

  it("duplicates a range of pages", async () => {
    const pdf = await makePdf(5);
    const result = await duplicatePdfPages(pdf, { pages: "1-2", count: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(await countPages(result.output.bytes)).toBe(7);
  });

  it("duplicates multiple ranges", async () => {
    const pdf = await makePdf(5);
    const result = await duplicatePdfPages(pdf, { pages: "1, 3-4", count: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Original 5 + (3 pages × 2 rounds) = 5 + 6 = 11
      expect(await countPages(result.output.bytes)).toBe(11);
    }
  });

  it("preserves original pages at the start", async () => {
    const pdf = await makePdf(3);
    const result = await duplicatePdfPages(pdf, { pages: "2", count: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.originalPageCount).toBe(3);
      expect(result.output.newPageCount).toBe(4);
    }
  });

  it("errors on count < 1", async () => {
    const pdf = await makePdf(3);
    const result = await duplicatePdfPages(pdf, { pages: "1", count: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("at least 1");
  });

  it("errors on count > 100", async () => {
    const pdf = await makePdf(3);
    const result = await duplicatePdfPages(pdf, { pages: "1", count: 101 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("at most 100");
  });

  it("errors on invalid page range", async () => {
    const pdf = await makePdf(3);
    const result = await duplicatePdfPages(pdf, { pages: "9", count: 1 });
    expect(result.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const result = await duplicatePdfPages(new Uint8Array([1, 2, 3]), { pages: "1", count: 1 });
    expect(result.ok).toBe(false);
  });

  it("sets creator metadata on the output", async () => {
    const pdf = await makePdf(2);
    const result = await duplicatePdfPages(pdf, { pages: "1", count: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output.bytes);
      expect(doc.getCreator()).toContain("UnQTools");
    }
  });
});
