import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addPageNumbers, formatNumber, toRoman, previewNumbers } from "./logic";

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

describe("page numbers advanced (formats, start page, preview)", () => {
  it("formats numbers correctly", () => {
    
    expect(formatNumber("x", 3, 10)).toBe("3");
    expect(formatNumber("page-x-of-n", 3, 10)).toBe("Page 3 of 10");
    expect(formatNumber("dash-x-dash", 3, 10)).toBe("- 3 -");
    expect(formatNumber("padded", 3, 100)).toBe("003");
    expect(formatNumber("padded", 3, 10)).toBe("03"); // pad to width of total (2)
    expect(formatNumber("roman", 4, 10)).toBe("IV");
    expect(toRoman(1999)).toBe("MCMXCIX");
    expect(toRoman(58)).toBe("LVIII");
  });

  it("previewNumbers respects startPage and startAt", () => {
    
    const p = previewNumbers(6, {
      position: "bottom-center", format: "x", startAt: 5, startPage: 3, fontSize: 12,
    });
    expect(p.numbered).toBe(4); // pages 3,4,5,6
    expect(p.firstLabel).toBe("5");
    expect(p.lastLabel).toBe("8");
  });

  it("previewNumbers skips cover pages", () => {
    
    const p = previewNumbers(5, {
      position: "bottom-center", format: "x", startAt: 1, startPage: 1, fontSize: 12, skipPages: "1,2",
    });
    expect(p.numbered).toBe(3);
    expect(p.firstLabel).toBe("1");
    expect(p.lastLabel).toBe("3");
  });

  it("addPageNumbers respects startPage and prefix/suffix", async () => {
    const pdf = await makePdf(4);
    const res = await addPageNumbers(pdf, {
      position: "bottom-center", format: "x", startAt: 1, startPage: 3, fontSize: 12,
      prefix: "P", suffix: ".",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect((await PDFDocument.load(res.output)).getPageCount()).toBe(4);
  });

  it("errors when startPage is beyond the document", async () => {
    const pdf = await makePdf(3);
    const res = await addPageNumbers(pdf, {
      position: "bottom-center", format: "x", startAt: 1, startPage: 9, fontSize: 12,
    });
    expect(res.ok).toBe(false);
  });

  it("supports bold + custom color", async () => {
    const pdf = await makePdf(2);
    const res = await addPageNumbers(pdf, {
      position: "top-right", format: "page-x", startAt: 1, fontSize: 14, bold: true, color: "#cc0000",
    });
    expect(res.ok).toBe(true);
  });
});
