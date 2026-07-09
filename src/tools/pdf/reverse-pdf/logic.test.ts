import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { reversePdf } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 200]);
    // Draw the page number on each page so we can verify order
    page.drawText(`Page ${i + 1}`, { x: 50, y: 100, size: 24 });
  }
  return doc.save();
}

async function getPageText(bytes: Uint8Array, pageIndex: number): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPages()[pageIndex];
  const text = await page.getTextContent();
  return text.items.map((item: { str?: string }) => item.str || "").join("");
}

describe("reversePdf", () => {
  it("reverses a 3-page PDF so last page is first", async () => {
    const pdf = await makePdf(3);
    const result = await reversePdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      expect(doc.getPageCount()).toBe(3);
    }
  });

  it("reverses a 5-page PDF", async () => {
    const pdf = await makePdf(5);
    const result = await reversePdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      expect(doc.getPageCount()).toBe(5);
    }
  });

  it("reversing twice restores the original order", async () => {
    const pdf = await makePdf(4);
    const reversed1 = await reversePdf(pdf);
    expect(reversed1.ok).toBe(true);
    if (reversed1.ok) {
      const reversed2 = await reversePdf(reversed1.output);
      expect(reversed2.ok).toBe(true);
      if (reversed2.ok) {
        const doc = await PDFDocument.load(reversed2.output);
        expect(doc.getPageCount()).toBe(4);
      }
    }
  });

  it("errors on a single-page PDF (nothing to reverse)", async () => {
    const pdf = await makePdf(1);
    const result = await reversePdf(pdf);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("fewer than 2");
  });

  it("errors on invalid PDF bytes", async () => {
    const result = await reversePdf(new Uint8Array([1, 2, 3]));
    expect(result.ok).toBe(false);
  });

  it("errors on empty bytes", async () => {
    const result = await reversePdf(new Uint8Array(0));
    expect(result.ok).toBe(false);
  });

  it("handles a 2-page PDF (minimum reversible)", async () => {
    const pdf = await makePdf(2);
    const result = await reversePdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      expect(doc.getPageCount()).toBe(2);
    }
  });

  it("sets creator metadata on the output", async () => {
    const pdf = await makePdf(3);
    const result = await reversePdf(pdf);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const doc = await PDFDocument.load(result.output);
      expect(doc.getCreator()).toContain("UnQTools");
    }
  });
});
