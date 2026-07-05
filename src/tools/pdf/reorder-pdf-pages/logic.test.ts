import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { reorderPdfPages } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

async function countPages(bytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPageCount();
}

describe("reorderPdfPages", () => {
  it("reverses pages", async () => {
    const pdf = await makePdf(4);
    const res = await reorderPdfPages(pdf, { mode: "reverse" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(4);
  });

  it("duplicates all pages", async () => {
    const pdf = await makePdf(3);
    const res = await reorderPdfPages(pdf, { mode: "duplicate" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(6);
  });

  it("reorders with a custom sequence", async () => {
    const pdf = await makePdf(3);
    const res = await reorderPdfPages(pdf, { mode: "custom", sequence: "3,1,2" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(3);
  });

  it("allows repeated pages in custom mode", async () => {
    const pdf = await makePdf(2);
    const res = await reorderPdfPages(pdf, { mode: "custom", sequence: "1,1,2,2" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(await countPages(res.output)).toBe(4);
  });

  it("errors on empty custom sequence", async () => {
    const pdf = await makePdf(3);
    expect((await reorderPdfPages(pdf, { mode: "custom", sequence: "" })).ok).toBe(false);
  });

  it("errors on out-of-bounds sequence", async () => {
    const pdf = await makePdf(3);
    expect((await reorderPdfPages(pdf, { mode: "custom", sequence: "9" })).ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    expect((await reorderPdfPages(new Uint8Array([1, 2, 3]), { mode: "reverse" })).ok).toBe(false);
  });
});
