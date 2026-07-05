import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addPageNumbers } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return doc.save();
}

describe("addPageNumbers", () => {
  it("adds page numbers and returns a valid PDF", async () => {
    const pdf = await makePdf(3);
    const res = await addPageNumbers(pdf, {
      position: "bottom-center",
      format: "page-x-of-n",
      startAt: 1,
      fontSize: 12,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      const doc = await PDFDocument.load(res.output);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("supports all six positions without errors", async () => {
    const pdf = await makePdf(1);
    const positions = [
      "bottom-left", "bottom-center", "bottom-right",
      "top-left", "top-center", "top-right",
    ] as const;
    for (const position of positions) {
      const res = await addPageNumbers(pdf, { position, format: "x", startAt: 1, fontSize: 12 });
      expect(res.ok).toBe(true);
    }
  });

  it("skips pages in the skip set", async () => {
    const pdf = await makePdf(4);
    const res = await addPageNumbers(pdf, {
      position: "bottom-center",
      format: "x",
      startAt: 1,
      fontSize: 12,
      skipPages: "1",
    });
    expect(res.ok).toBe(true);
  });

  it("starts numbering at a custom value", async () => {
    const pdf = await makePdf(2);
    const res = await addPageNumbers(pdf, {
      position: "bottom-right",
      format: "page-x",
      startAt: 10,
      fontSize: 10,
    });
    expect(res.ok).toBe(true);
  });

  it("errors on invalid skip spec", async () => {
    const pdf = await makePdf(3);
    const res = await addPageNumbers(pdf, {
      position: "bottom-center",
      format: "x",
      startAt: 1,
      fontSize: 12,
      skipPages: "99",
    });
    expect(res.ok).toBe(false);
  });

  it("errors on invalid PDF bytes", async () => {
    const res = await addPageNumbers(new Uint8Array([1, 2, 3]), {
      position: "bottom-center",
      format: "x",
      startAt: 1,
      fontSize: 12,
    });
    expect(res.ok).toBe(false);
  });
});
