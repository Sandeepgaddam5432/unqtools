import { describe, it, expect } from "vitest";
import { swirlMap, normalizedRadius, inBounds, validateSwirlOptions } from "./logic";

const OPTS = { cx: 0.5, cy: 0.5, angle: Math.PI, radius: 0.5 };

describe("normalizedRadius", () => {
  it("is 0 at the center", () => {
    expect(normalizedRadius(50, 50, OPTS, 100, 100)).toBeCloseTo(0, 5);
  });
  it("increases outward", () => {
    const a = normalizedRadius(60, 50, OPTS, 100, 100);
    const b = normalizedRadius(90, 50, OPTS, 100, 100);
    expect(b).toBeGreaterThan(a);
  });
});

describe("swirlMap", () => {
  it("returns the same point at the center", () => {
    const p = swirlMap(50, 50, OPTS, 100, 100);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });
  it("rotates the point when angle is nonzero", () => {
    // Point straight up from center with angle π should flip below center.
    const p = swirlMap(50, 25, { cx: 0.5, cy: 0.5, angle: Math.PI, radius: 1 }, 100, 100);
    expect(p.y).toBeGreaterThan(50);
  });
  it("leaves points outside radius unchanged", () => {
    const p = swirlMap(0, 0, OPTS, 100, 100);
    expect(p.x).toBeCloseTo(0, 4);
    expect(p.y).toBeCloseTo(0, 4);
  });
  it("with angle 0 leaves every point unchanged", () => {
    const p = swirlMap(20, 70, { cx: 0.5, cy: 0.5, angle: 0, radius: 0.5 }, 100, 100);
    expect(p.x).toBeCloseTo(20, 5);
    expect(p.y).toBeCloseTo(70, 5);
  });
});

describe("inBounds", () => {
  it("accepts points inside image", () => {
    expect(inBounds({ x: 50, y: 50 }, 100, 100)).toBe(true);
  });
  it("rejects points outside image", () => {
    expect(inBounds({ x: -1, y: 0 }, 100, 100)).toBe(false);
    expect(inBounds({ x: 100, y: 50 }, 100, 100)).toBe(false);
  });
});

describe("validateSwirlOptions", () => {
  it("accepts valid options", () => {
    expect(validateSwirlOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects bad center", () => {
    expect(validateSwirlOptions({ ...OPTS, cx: -1 })).toHaveProperty("error");
  });
  it("rejects bad radius", () => {
    expect(validateSwirlOptions({ ...OPTS, radius: 0 })).toHaveProperty("error");
  });
});
