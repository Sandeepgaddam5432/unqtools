import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { addHeaderFooter, resolveTemplate, hexToRgb } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`body ${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("resolveTemplate", () => {
  it("replaces page and pages placeholders", () => {
    expect(resolveTemplate("Page {page} of {pages}", 3, 10)).toBe("Page 3 of 10");
    expect(resolveTemplate("{page}/{pages}", 1, 5)).toBe("1/5");
  });

  it("is case-insensitive for placeholders", () => {
    expect(resolveTemplate("{PAGE}", 2, 4)).toBe("2");
  });

  it("leaves unknown text intact", () => {
    expect(resolveTemplate("Draft - {page}", 1, 2)).toBe("Draft - 1");
  });
});

describe("hexToRgb", () => {
  it("parses hex to pdf-lib RGB", () => {
    const c = hexToRgb("#ff0000");
    expect(c.red).toBe(1);
    expect(c.green).toBe(0);
  });
});

describe("addHeaderFooter", () => {
  it("adds header and footer to all pages", async () => {
    const pdf = await makePdf(3);
    const r = await addHeaderFooter(pdf, {
      headerText: "Confidential {page}",
      footerText: "Page {page} of {pages}",
      fontSize: 9,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.pagesModified).toBe(3);
      expect((await PDFDocument.load(r.output.bytes)).getPageCount()).toBe(3);
    }
  });

  it("supports positions and bold", async () => {
    const pdf = await makePdf(2);
    const r = await addHeaderFooter(pdf, {
      headerText: "Left head",
      headerPosition: "left",
      footerText: "Right foot",
      footerPosition: "right",
      bold: true,
      color: "#0055aa",
    });
    expect(r.ok).toBe(true);
  });

  it("draws rule lines when requested", async () => {
    const pdf = await makePdf(1);
    const r = await addHeaderFooter(pdf, { headerText: "H", footerText: "F", rules: true });
    expect(r.ok).toBe(true);
  });

  it("applies to selected pages only", async () => {
    const pdf = await makePdf(4);
    const r = await addHeaderFooter(pdf, { headerText: "H", pages: "2-3" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pagesModified).toBe(2);
  });

  it("errors when both texts are empty", async () => {
    const pdf = await makePdf(1);
    const r = await addHeaderFooter(pdf, {});
    expect(r.ok).toBe(false);
  });

  it("rejects corrupt PDFs", async () => {
    const r = await addHeaderFooter(new Uint8Array([9, 9]), { headerText: "x" });
    expect(r.ok).toBe(false);
  });
});
