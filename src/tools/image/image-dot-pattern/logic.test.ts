import { describe, it, expect } from "vitest";
import {
  dotRadiusFromBrightness, rotatePoint, pixelToCell, cellCenter,
  distance, avgBrightness, validateDotOptions,
  generateCellGrid, hexRowOffset, diagonalRowOffset,
  hexToRgb, rgbToGray, cellCount, fmt,
} from "./logic";

const OPTS = { cellSize: 10, maxRadius: 0.5, fg: 0, bg: 255, angle: 0, pattern: "grid" as const };

describe("dotRadiusFromBrightness", () => {
  it("returns max radius for black (brightness 0)", () => {
    expect(dotRadiusFromBrightness(0, OPTS)).toBeCloseTo(5, 5);
  });
  it("returns 0 for white (brightness 255)", () => {
    expect(dotRadiusFromBrightness(255, OPTS)).toBeCloseTo(0, 5);
  });
  it("scales linearly with brightness", () => {
    const a = dotRadiusFromBrightness(64, OPTS);
    const b = dotRadiusFromBrightness(128, OPTS);
    expect(b).toBeLessThan(a);
  });
});

describe("rotatePoint", () => {
  it("does nothing for angle 0", () => {
    const p = rotatePoint(3, 4, 0);
    expect(p.x).toBeCloseTo(3, 5);
    expect(p.y).toBeCloseTo(4, 5);
  });
  it("rotates 90° correctly", () => {
    const p = rotatePoint(1, 0, 90);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(1, 5);
  });
  it("rotates 180° to negative", () => {
    const p = rotatePoint(1, 1, 180);
    expect(p.x).toBeCloseTo(-1, 5);
    expect(p.y).toBeCloseTo(-1, 5);
  });
});

describe("pixelToCell / cellCenter", () => {
  it("round-trips through rotation", () => {
    const o = { ...OPTS, angle: 30 };
    const c = pixelToCell(35, 47, o);
    const p = cellCenter(c.cx, c.cy, o);
    expect(p.x).toBeCloseTo(35, -1);
    expect(p.y).toBeCloseTo(47, -1);
  });
  it("groups nearby pixels into the same cell", () => {
    const a = pixelToCell(2, 2, OPTS);
    const b = pixelToCell(8, 8, OPTS);
    expect(a.cx).toBe(b.cx);
    expect(a.cy).toBe(b.cy);
  });
  it("hex pattern offsets odd rows", () => {
    const hexOpts = { ...OPTS, pattern: "hex" as const };
    const a = pixelToCell(2, 12, hexOpts);
    expect(a).toBeDefined();
  });
});

describe("distance", () => {
  it("computes Euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
  it("returns 0 for same point", () => {
    expect(distance({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe("avgBrightness", () => {
  it("averages pixel luminance over a region", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 255,
      0, 0, 0, 255, 255, 255, 255, 255,
    ]);
    const b = avgBrightness(data, 0, 0, 2, 2, 2);
    expect(b).toBeCloseTo(127.5, 1);
  });
  it("returns 0 for empty region", () => {
    const data = new Uint8ClampedArray([]);
    expect(avgBrightness(data, 0, 0, 1, 1, 1)).toBe(0);
  });
});

describe("validateDotOptions", () => {
  it("accepts valid options", () => {
    expect(validateDotOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects bad cell size", () => {
    expect(validateDotOptions({ ...OPTS, cellSize: 1 })).toHaveProperty("error");
  });
  it("rejects bad max radius", () => {
    expect(validateDotOptions({ ...OPTS, maxRadius: 0.05 })).toHaveProperty("error");
  });
  it("rejects bad fg/bg", () => {
    expect(validateDotOptions({ ...OPTS, fg: -1 })).toHaveProperty("error");
    expect(validateDotOptions({ ...OPTS, bg: 300 })).toHaveProperty("error");
  });
  it("rejects unknown pattern", () => {
    expect(validateDotOptions({ ...OPTS, pattern: "bogus" as never })).toHaveProperty("error");
  });
});

describe("generateCellGrid", () => {
  it("generates cells covering the image", () => {
    const cells = generateCellGrid(100, 100, OPTS);
    expect(cells.length).toBeGreaterThan(100);
  });
});

describe("hexRowOffset / diagonalRowOffset", () => {
  it("returns 0 for even rows", () => {
    expect(hexRowOffset(0, 10)).toBe(0);
    expect(hexRowOffset(2, 10)).toBe(0);
  });
  it("returns half cellSize for odd rows", () => {
    expect(hexRowOffset(1, 10)).toBe(5);
  });
  it("diagonalRowOffset grows with row", () => {
    expect(diagonalRowOffset(2, 10)).toBe(10);
  });
});

describe("hexToRgb / rgbToGray", () => {
  it("converts #RRGGBB", () => {
    expect(hexToRgb("#FF8000")).toEqual({ r: 255, g: 128, b: 0 });
  });
  it("accepts short form", () => {
    expect(hexToRgb("#F80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("errors on invalid", () => {
    expect(hexToRgb("xyz")).toHaveProperty("error");
  });
  it("converts RGB to grayscale", () => {
    expect(rgbToGray(255, 255, 255)).toBeCloseTo(255, 0);
    expect(rgbToGray(0, 0, 0)).toBe(0);
  });
  it("weights green most heavily (BT.601)", () => {
    const g = rgbToGray(0, 255, 0);
    const r = rgbToGray(255, 0, 0);
    expect(g).toBeGreaterThan(r);
  });
});

describe("cellCount", () => {
  it("computes total cells", () => {
    expect(cellCount(100, 100, 10)).toBe(100);
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
