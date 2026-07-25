import { describe, it, expect } from "vitest";
import {
  generateGrid,
  shouldDrawDot,
  scaledDotRadius,
  validateScreenToneOptions,
  rotatePoint,
  clamp,
  dotArea,
  dotPath,
  generatePreview,
  computeStats,
  brightness,
  generateUniform,
  toSvg,
  PATTERNS,
} from "./logic";

const OPTS = { spacing: 8, radius: 3, threshold: 128, angle: 0 };

describe("clamp", () => {
  it("clamps below min", () => { expect(clamp(-5, 0, 10)).toBe(0); });
  it("clamps above max", () => { expect(clamp(15, 0, 10)).toBe(10); });
  it("passes through in-range", () => { expect(clamp(5, 0, 10)).toBe(5); });
});

describe("rotatePoint", () => {
  it("round-trips 0°", () => {
    const p = rotatePoint(5, 7, 0);
    expect(p.x).toBeCloseTo(5);
    expect(p.y).toBeCloseTo(7);
  });
  it("rotates 90°", () => {
    const p = rotatePoint(1, 0, 90);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(1, 5);
  });
  it("rotates 180°", () => {
    const p = rotatePoint(2, 3, 180);
    expect(p.x).toBeCloseTo(-2, 5);
    expect(p.y).toBeCloseTo(-3, 5);
  });
});

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
  it("returns empty for non-positive dimensions", () => {
    expect(generateGrid(0, 0, OPTS)).toEqual([]);
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
  it("skips when intensity is 0", () => {
    expect(shouldDrawDot(50, { ...OPTS, intensity: 0 })).toBe(false);
  });
});

describe("scaledDotRadius", () => {
  it("is larger for darker pixels", () => {
    expect(scaledDotRadius(0, OPTS)).toBeGreaterThan(scaledDotRadius(255, OPTS));
  });
  it("is always positive", () => {
    expect(scaledDotRadius(128, OPTS)).toBeGreaterThan(0);
  });
  it("scales by intensity", () => {
    const r1 = scaledDotRadius(0, { ...OPTS, intensity: 1 });
    const rHalf = scaledDotRadius(0, { ...OPTS, intensity: 0.5 });
    expect(rHalf).toBeLessThan(r1);
  });
});

describe("dotArea", () => {
  it("computes round dot area", () => {
    expect(dotArea(2, OPTS)).toBeCloseTo(Math.PI * 4, 3);
  });
  it("computes square dot area", () => {
    expect(dotArea(2, { ...OPTS, pattern: "square" })).toBe(16);
  });
  it("computes ellipse dot area", () => {
    expect(dotArea(2, { ...OPTS, pattern: "ellipse", ellipseRatio: 2 })).toBeCloseTo(Math.PI * 2 * 4, 3);
  });
});

describe("dotPath", () => {
  it("generates SVG path for round dot", () => {
    const p = dotPath(10, 10, 3, OPTS);
    expect(p).toContain("M");
    expect(p).toContain("a");
  });
  it("generates SVG path for square dot", () => {
    const p = dotPath(10, 10, 3, { ...OPTS, pattern: "square" });
    expect(p).toContain("h");
    expect(p).toContain("v");
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
  it("rejects bad intensity", () => {
    expect(validateScreenToneOptions({ ...OPTS, intensity: 2 })).toHaveProperty("error");
  });
  it("rejects bad angle", () => {
    expect(validateScreenToneOptions({ ...OPTS, angle: 360 })).toHaveProperty("error");
  });
});

describe("generatePreview", () => {
  it("returns dots in the preview area", () => {
    const dots = generatePreview(OPTS, 100);
    for (const d of dots) {
      expect(d.x).toBeGreaterThanOrEqual(0);
      expect(d.x).toBeLessThanOrEqual(100);
      expect(d.y).toBeGreaterThanOrEqual(0);
      expect(d.y).toBeLessThanOrEqual(100);
    }
  });
});

describe("computeStats", () => {
  it("computes stats correctly", () => {
    const dots = [{ x: 0, y: 0, radius: 3 }, { x: 5, y: 5, radius: 2 }];
    const stats = computeStats(dots, dots, OPTS, 100);
    expect(stats.dotCount).toBe(2);
    expect(stats.drawnDots).toBe(2);
    expect(stats.maxRadius).toBe(3);
    expect(stats.minRadius).toBe(2);
  });
  it("handles empty drawn list", () => {
    const stats = computeStats([], [], OPTS, 100);
    expect(stats.drawnDots).toBe(0);
    expect(stats.minRadius).toBe(0);
  });
});

describe("brightness", () => {
  it("computes luminance from RGB", () => {
    expect(brightness(255, 255, 255)).toBeCloseTo(255, 0);
    expect(brightness(0, 0, 0)).toBe(0);
  });
});

describe("generateUniform", () => {
  it("generates dots for a uniform grid", () => {
    const dots = generateUniform(50, 50, OPTS);
    expect(dots.length).toBeGreaterThan(0);
    expect(dots[0]!.radius).toBeGreaterThan(0);
  });
});

describe("toSvg", () => {
  it("generates valid SVG markup", () => {
    const dots = [{ x: 5, y: 5, radius: 2 }];
    const svg = toSvg(dots, 20, 20, OPTS);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
  });
});

describe("PATTERNS", () => {
  it("lists 3 patterns", () => {
    expect(PATTERNS.length).toBe(3);
    expect(PATTERNS.some((p) => p.value === "round")).toBe(true);
  });
});
