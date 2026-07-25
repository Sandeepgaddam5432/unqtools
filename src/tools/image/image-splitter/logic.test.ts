import { describe, it, expect } from "vitest";
import { splitImage, tileAt, tileFileName } from "./logic";

describe("splitImage", () => {
  it("splits evenly into a grid", () => {
    const r = splitImage({ sourceWidth: 300, sourceHeight: 200, rows: 2, cols: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.tileWidth).toBe(100);
    expect(r.tileHeight).toBe(100);
    expect(r.total).toBe(6);
    expect(r.tiles[0]).toMatchObject({ index: 0, row: 0, col: 0, x: 0, y: 0 });
    expect(r.tiles[5]).toMatchObject({ index: 5, row: 1, col: 2, x: 200, y: 100 });
  });

  it("floors uneven divisions", () => {
    const r = splitImage({ sourceWidth: 100, sourceHeight: 100, rows: 3, cols: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.tileWidth).toBe(33);
    expect(r.tileHeight).toBe(33);
  });

  it("errors on invalid rows/cols", () => {
    expect("error" in splitImage({ sourceWidth: 100, sourceHeight: 100, rows: 0, cols: 2 })).toBe(true);
    expect("error" in splitImage({ sourceWidth: 100, sourceHeight: 100, rows: 2, cols: -1 })).toBe(true);
  });

  it("errors on too-fine grid", () => {
    expect("error" in splitImage({ sourceWidth: 2, sourceHeight: 2, rows: 100, cols: 100 })).toBe(true);
  });

  it("errors on zero source size", () => {
    expect("error" in splitImage({ sourceWidth: 0, sourceHeight: 100, rows: 1, cols: 1 })).toBe(true);
  });
});

describe("tileAt", () => {
  const r = splitImage({ sourceWidth: 300, sourceHeight: 200, rows: 2, cols: 3 });
  if ("error" in r) throw new Error("bad split");

  it("finds the tile containing the top-left pixel", () => {
    expect(tileAt(r, 0, 0)?.col).toBe(0);
    expect(tileAt(r, 0, 0)?.row).toBe(0);
  });

  it("finds the tile containing a middle pixel", () => {
    expect(tileAt(r, 150, 100)?.row).toBe(1);
    expect(tileAt(r, 150, 100)?.col).toBe(1);
  });

  it("returns null when tileWidth/Height are 0", () => {
    expect(tileAt({ tiles: [], tileWidth: 0, tileHeight: 0, total: 0 }, 10, 10)).toBeNull();
  });
});

describe("tileFileName", () => {
  it("builds a friendly file name", () => {
    expect(tileFileName("img", 0, 0)).toBe("img_r1_c1.png");
    expect(tileFileName("img", 1, 2, "jpg")).toBe("img_r2_c3.jpg");
  });
});
