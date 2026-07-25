import { describe, it, expect } from "vitest";
import {
  computeGrid, tileOffset, suggestGrid, tileName, gridFromTileSize,
  generateTiles, tilesToCsv, countEdgeTiles, totalTileArea,
  validateGrid, fmt,
} from "./logic";

describe("computeGrid", () => {
  it("divides evenly", () => {
    const g = computeGrid(400, 300, 4, 3);
    if ("error" in g) throw new Error("err");
    expect(g.tileWidth).toBe(100);
    expect(g.tileHeight).toBe(100);
    expect(g.total).toBe(12);
  });
  it("floors uneven divisions", () => {
    const g = computeGrid(100, 100, 3, 3);
    if ("error" in g) throw new Error("err");
    expect(g.tileWidth).toBe(33);
  });
  it("errors on zero size", () => {
    expect("error" in computeGrid(0, 100, 2, 2)).toBe(true);
  });
  it("errors on invalid counts", () => {
    expect("error" in computeGrid(100, 100, 0, 2)).toBe(true);
    expect("error" in computeGrid(100, 100, 2, -1)).toBe(true);
  });
  it("errors when tiles would be smaller than 1px", () => {
    expect("error" in computeGrid(2, 2, 100, 100)).toBe(true);
  });
});

describe("tileOffset", () => {
  it("computes x,y for top-left tile", () => {
    expect(tileOffset(0, 4, 100, 100)).toEqual({ x: 0, y: 0 });
  });
  it("computes x,y for a middle tile", () => {
    expect(tileOffset(5, 4, 100, 100)).toEqual({ x: 100, y: 100 });
  });
  it("computes x,y for last tile in a row", () => {
    expect(tileOffset(3, 4, 100, 100)).toEqual({ x: 300, y: 0 });
  });
  it("errors on negative index", () => {
    expect("error" in tileOffset(-1, 4, 100, 100)).toBe(true);
  });
});

describe("suggestGrid", () => {
  it("returns valid grid for a target", () => {
    const s = suggestGrid(800, 600, 6);
    if ("error" in s) throw new Error("err");
    expect(s.cols * s.rows).toBeGreaterThanOrEqual(6);
  });
  it("errors on invalid target", () => {
    expect("error" in suggestGrid(100, 100, 0)).toBe(true);
  });
  it("errors on invalid dimensions", () => {
    expect("error" in suggestGrid(0, 100, 4)).toBe(true);
  });
});

describe("tileName", () => {
  it("pads the index based on total", () => {
    expect(tileName("img", 0, 12)).toBe("img-tile-01.png");
    expect(tileName("img", 11, 12)).toBe("img-tile-12.png");
  });
  it("supports custom extension", () => {
    expect(tileName("img", 0, 5, "jpg")).toBe("img-tile-1.jpg");
  });
  it("supports row-col convention", () => {
    expect(tileName("img", 5, 12, "png", "row-col", 2, 1)).toBe("img-r2-c1.png");
  });
  it("supports xy convention", () => {
    expect(tileName("img", 0, 12, "png", "xy", 0, 0, 100, 50)).toBe("img-x100-y50.png");
  });
  it("strips leading dot from ext", () => {
    expect(tileName("img", 0, 5, ".png")).toBe("img-tile-1.png");
  });
});

describe("gridFromTileSize", () => {
  it("computes cols/rows from target tile px", () => {
    const g = gridFromTileSize(400, 300, 100, 100);
    if ("error" in g) throw new Error("err");
    expect(g.cols).toBe(4);
    expect(g.rows).toBe(3);
  });
  it("errors on invalid tile size", () => {
    expect("error" in gridFromTileSize(400, 300, 0, 100)).toBe(true);
  });
});

describe("generateTiles", () => {
  it("generates specs for each tile", () => {
    const tiles = generateTiles(400, 300, 4, 3);
    if ("error" in tiles) throw new Error("err");
    expect(tiles).toHaveLength(12);
    expect(tiles[0]!.x).toBe(0);
    expect(tiles[0]!.y).toBe(0);
    // Index 5: col=1, row=1 → x=100, y=100
    expect(tiles[5]!.x).toBe(100);
    expect(tiles[5]!.y).toBe(100);
  });
  it("marks edge tiles", () => {
    const tiles = generateTiles(400, 300, 4, 3);
    if ("error" in tiles) throw new Error("err");
    expect(tiles[0]!.isEdge).toBe(true);
  });
  it("applies overlap", () => {
    const tiles = generateTiles(400, 300, 2, 2, "img", "png", 10);
    if ("error" in tiles) throw new Error("err");
    expect(tiles[1]!.x).toBe(190); // 200 - 10 overlap
  });
  it("errors on negative overlap", () => {
    expect("error" in generateTiles(400, 300, 2, 2, "img", "png", -1)).toBe(true);
  });
});

describe("tilesToCsv", () => {
  it("renders CSV with header", () => {
    const tiles = generateTiles(400, 300, 2, 2);
    if ("error" in tiles) throw new Error("err");
    const csv = tilesToCsv(tiles);
    expect(csv.split("\n")[0]).toBe("index,row,col,x,y,width,height,name,isEdge");
    expect(csv).toContain("img-tile-1.png");
  });
});

describe("countEdgeTiles / totalTileArea", () => {
  it("counts edge tiles", () => {
    const tiles = generateTiles(400, 300, 4, 3);
    if ("error" in tiles) throw new Error("err");
    expect(countEdgeTiles(tiles)).toBe(10); // 2*4 + 2*3 - 4 corners
  });
  it("computes total area", () => {
    const tiles = generateTiles(400, 300, 2, 2);
    if ("error" in tiles) throw new Error("err");
    expect(totalTileArea(tiles)).toBeGreaterThan(0);
  });
});

describe("validateGrid", () => {
  it("accepts valid grid", () => {
    expect(validateGrid(400, 300, 2, 2)).toEqual({ ok: true });
  });
  it("rejects invalid grid", () => {
    expect(validateGrid(0, 300, 2, 2)).toHaveProperty("error");
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
