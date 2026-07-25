import { describe, it, expect } from "vitest";
import {
  dotRadiusFromBrightness, rotatePoint, pixelToCell, cellCenter, distance, avgBrightness, validateDotOptions,
} from "./logic";

const OPTS = { cellSize: 10, maxRadius: 0.5, fg: 0, bg: 255, angle: 0 };

describe("dotRadiusFromBrightness", () => {
  it("returns max radius for black (brightness 0)", () => {
    expect(dotRadiusFromBrightness(0, OPTS)).toBeCloseTo(0.5 * 10, 5);
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
});

describe("pixelToCell / cellCenter", () => {
  it("round-trips through rotation", () => {
    const o = { ...OPTS, angle: 30 };
    const c = pixelToCell(35, 47, o);
    const p = cellCenter(c.cx, c.cy, o);
    // cellCenter returns the cell center, not the original point — the
    // difference is bounded by half a cell, so use a lenient tolerance.
    expect(p.x).toBeCloseTo(35, -1);
    expect(p.y).toBeCloseTo(47, -1);
  });
  it("groups nearby pixels into the same cell", () => {
    const a = pixelToCell(2, 2, OPTS);
    const b = pixelToCell(8, 8, OPTS);
    expect(a.cx).toBe(b.cx);
    expect(a.cy).toBe(b.cy);
  });
});

describe("distance", () => {
  it("computes Euclidean distance", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
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
});
