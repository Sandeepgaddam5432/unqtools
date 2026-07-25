import { describe, it, expect } from "vitest";
import { generateGrid, shouldDrawDot, scaledDotRadius, validateScreenToneOptions, rotatePoint } from "./logic";

const OPTS = { spacing: 8, radius: 3, threshold: 128, angle: 0 };

describe("generateGrid", () => {
  it("covers the requested area", () => {
    const pts = generateGrid(100, 100, OPTS);
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(100);
    expect(Math.min(...ys)).toBeLessThanOrEqual(0);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(100);
  });
  it("places dots at spacing intervals", () => {
    const pts = generateGrid(50, 50, OPTS).filter((p) => p.x >= 0 && p.y >= 0);
    const sortedX = [...new Set(pts.map((p) => Math.round(p.x)))].sort((a, b) => a - b);
    expect(sortedX[1]! - sortedX[0]!).toBe(OPTS.spacing);
  });
  it("supports rotated grids without losing coverage", () => {
    const pts = generateGrid(80, 80, { ...OPTS, angle: 30 });
    expect(pts.length).toBeGreaterThan(0);
  });
});

describe("shouldDrawDot", () => {
  it("draws for dark pixels", () => {
    expect(shouldDrawDot(50, OPTS)).toBe(true);
  });
  it("skips for bright pixels", () => {
    expect(shouldDrawDot(200, OPTS)).toBe(false);
  });
  it("respects threshold boundary", () => {
    expect(shouldDrawDot(128, OPTS)).toBe(true);
    expect(shouldDrawDot(129, OPTS)).toBe(false);
  });
});

describe("scaledDotRadius", () => {
  it("is larger for darker pixels", () => {
    expect(scaledDotRadius(0, OPTS)).toBeGreaterThan(scaledDotRadius(255, OPTS));
  });
  it("is always positive", () => {
    expect(scaledDotRadius(128, OPTS)).toBeGreaterThan(0);
  });
});

describe("rotatePoint", () => {
  it("round-trips 0°", () => {
    const p = rotatePoint(5, 7, 0);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(7);
  });
});

describe("validateScreenToneOptions", () => {
  it("accepts valid options", () => {
    expect(validateScreenToneOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects bad spacing", () => {
    expect(validateScreenToneOptions({ ...OPTS, spacing: 1 })).toHaveProperty("error");
  });
  it("rejects radius larger than spacing/2", () => {
    expect(validateScreenToneOptions({ ...OPTS, radius: 5 })).toHaveProperty("error");
  });
});
