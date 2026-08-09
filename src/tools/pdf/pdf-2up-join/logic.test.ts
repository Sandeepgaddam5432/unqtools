import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { twoUpJoin, buildPairs } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([200, 300]);
    page.drawText(`p${i}`, { x: 5, y: 5, size: 6 });
  }
  return doc.save();
}

describe("buildPairs", () => {
  it("pairs consecutive pages", () => {
    expect(buildPairs(4, false)).toEqual([[0, 1], [2, 3]]);
    expect(buildPairs(2, false)).toEqual([[0, 1]]);
  });

  it("drops the last unpaired page by default", () => {
    expect(buildPairs(3, false)).toEqual([[0, 1]]);
  });

  it("duplicates the last page when asked", () => {
    expect(buildPairs(3, true)).toEqual([[0, 1], [2, 2]]);
  });
});

describe("twoUpJoin", () => {
  it("joins two pages onto one sheet", async () => {
    const pdf = await makePdf(2);
    const r = await twoUpJoin(pdf, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.outputSheets).toBe(1);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(1);
      const { width, height } = doc.getPages()[0].getSize();
      expect(width).toBeGreaterThan(height); // landscape-ish A4
    }
  });

  it("4 pages → 2 sheets", async () => {
    const pdf = await makePdf(4);
    const r = await twoUpJoin(pdf, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.outputSheets).toBe(2);
  });

  it("odd pages drop last by default, duplicate with option", async () => {
    const pdf = await makePdf(3);
    const plain = await twoUpJoin(pdf, {});
    expect(plain.ok).toBe(true);
    if (plain.ok) expect(plain.output.outputSheets).toBe(1);

    const dup = await twoUpJoin(pdf, { duplicateLast: true });
    expect(dup.ok).toBe(true);
    if (dup.ok) expect(dup.output.outputSheets).toBe(2);
  });

  it("supports custom sheet size + divider", async () => {
    const pdf = await makePdf(2);
    const r = await twoUpJoin(pdf, { sheet: "custom", customWidth: 500, customHeight: 400, divider: true, gutter: 12 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const { width, height } = (await PDFDocument.load(r.output.bytes)).getPages()[0].getSize();
      expect(width).toBe(500);
      expect(height).toBe(400);
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await twoUpJoin(new Uint8Array([7, 8]));
    expect(r.ok).toBe(false);
  });
});
