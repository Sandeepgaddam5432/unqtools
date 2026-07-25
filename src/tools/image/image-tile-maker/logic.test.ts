import { describe, it, expect } from "vitest";
import { computeGrid, tileOffset, suggestGrid, tileName } from "./logic";

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
    expect(g.tileHeight).toBe(33);
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
});

describe("tileName", () => {
  it("pads the index based on total", () => {
    expect(tileName("img", 0, 12)).toBe("img-tile-01.png");
    expect(tileName("img", 11, 12)).toBe("img-tile-12.png");
  });

  it("supports custom extension", () => {
    expect(tileName("img", 0, 5, "jpg")).toBe("img-tile-1.jpg");
  });
});
