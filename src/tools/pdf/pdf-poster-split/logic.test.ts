import { describe, expect, it } from "vitest";
import { PDFDocument, PageSizes } from "pdf-lib";
import { tileGrid, posterSplit } from "./logic";

async function makePdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([600, 900]);
    page.drawText(`poster content ${i}`, { x: 50, y: 800, size: 20 });
  }
  return doc.save();
}

describe("tileGrid", () => {
  it("creates rows×cols tiles covering the page", () => {
    const tiles = tileGrid(600, 900, 2, 3, 0);
    expect(tiles.length).toBe(6);
    // First tile is top-left (row 0 = top, reading order LTR/TTB)
    expect(tiles[0]!.x).toBe(0);
    expect(tiles[0]!.y).toBe(450);
    expect(tiles[0]!.w).toBe(200);
    expect(tiles[0]!.h).toBe(450);
    // Last tile covers the bottom-right corner
    const last = tiles[5]!;
    expect(last.x).toBeCloseTo(400, 1);
    expect(last.y).toBeCloseTo(0, 1);
  });

  it("adds overlap", () => {
    const tiles = tileGrid(600, 900, 2, 2, 10);
    expect(tiles[0]!.w).toBe(300 + 10);
    expect(tiles[0]!.h).toBe(450 + 10);
  });
});

describe("posterSplit", () => {
  it("splits a page into tiles", async () => {
    const r = await posterSplit(await makePdf(1), { rows: 2, cols: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.tiles).toBe(6);
      expect(r.output.rows).toBe(2);
      expect(r.output.cols).toBe(3);
      const doc = await PDFDocument.load(r.output.bytes);
      expect(doc.getPageCount()).toBe(6);
    }
  });

  it("honours an output page size", async () => {
    const r = await posterSplit(await makePdf(1), { rows: 1, cols: 2, pageSize: "a4" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const { width, height } = (await PDFDocument.load(r.output.bytes)).getPages()[0].getSize();
      expect(Math.round(width)).toBe(Math.round(PageSizes.A4[0]));
    }
  });

  it("rejects corrupt PDFs", async () => {
    const r = await posterSplit(new Uint8Array([1, 2]), { rows: 2, cols: 2 });
    expect(r.ok).toBe(false);
  });
});
