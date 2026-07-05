import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { deletePdfPages } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("deletePdfPages", () => {
  it("deletes single pages", async () => {
    const pdf = await makePdf(5);
    const res = await deletePdfPages(pdf, "2");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.keptCount).toBe(4);
      expect(res.output.removedCount).toBe(1);
      expect(await countPages(res.output.bytes)).toBe(4);
    }
  });

  it("deletes a range of pages", async () => {
    const pdf = await makePdf(6);
    const res = await deletePdfPages(pdf, "2-4");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.keptCount).toBe(3);
  });

  it("deletes mixed single and range", async () => {
    const pdf = await makePdf(8);
    const res = await deletePdfPages(pdf, "1, 5-7");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output.keptCount).toBe(4);
  });

  it("deduplicates repeated pages in spec", async () => {
    const pdf = await makePdf(4);
    const res = await deletePdfPages(pdf, "2, 2, 2");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.removedCount).toBe(1);
      expect(res.output.keptCount).toBe(3);
    }
  });

  it("errors if all pages would be deleted", async () => {
    const pdf = await makePdf(3);
    const res = await deletePdfPages(pdf, "1-3");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("all pages");
  });

  it("errors on invalid spec", async () => {
    const pdf = await makePdf(3);
    expect((await deletePdfPages(pdf, "0")).ok).toBe(false);
    expect((await deletePdfPages(pdf, "abc")).ok).toBe(false);
    expect((await deletePdfPages(pdf, "")).ok).toBe(false);
  });

  it("errors on out-of-bounds", async () => {
    const pdf = await makePdf(3);
    const res = await deletePdfPages(pdf, "5");
    expect(res.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const res = await deletePdfPages(new Uint8Array([1, 2, 3]), "1");
    expect(res.ok).toBe(false);
  });
});
