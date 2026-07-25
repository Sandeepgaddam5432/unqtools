import { describe, it, expect } from "vitest";
import { validateSketch, luma, toGray, boxBlurGray, dodgeBlend } from "./logic";

describe("validateSketch", () => {
  it("passes valid opts", () => {
    expect(validateSketch({ intensity: 0.7, radius: 5 })).toEqual({ intensity: 0.7, radius: 5 });
  });
  it("rounds radius", () => {
    expect(validateSketch({ intensity: 0.5, radius: 4.6 }).radius).toBe(5);
  });
  it("errors on bad intensity", () => {
    expect(validateSketch({ intensity: 2, radius: 5 })).toHaveProperty("error");
  });
  it("errors on bad radius", () => {
    expect(validateSketch({ intensity: 0.5, radius: 100 })).toHaveProperty("error");
  });
  it("allows radius 0", () => {
    expect(validateSketch({ intensity: 0.5, radius: 0 })).toEqual({ intensity: 0.5, radius: 0 });
  });
});

describe("luma", () => {
  it("is 0 for black, ~255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
  it("weights green more than red", () => {
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(255, 0, 0));
  });
});

describe("toGray", () => {
  it("produces w*h entries", () => {
    const px = new Uint8ClampedArray(2 * 2 * 4);
    expect(toGray(px, 2, 2).length).toBe(4);
  });
  it("matches luma for white pixel", () => {
    const px = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(toGray(px, 1, 1)[0]).toBeCloseTo(255);
  });
});

describe("boxBlurGray", () => {
  it("returns copy for radius 0", () => {
    const g = [1, 2, 3, 4];
    expect(boxBlurGray(g, 2, 2, 0)).toEqual(g);
    expect(boxBlurGray(g, 2, 2, 0)).not.toBe(g);
  });
  it("averages uniform region", () => {
    const g = [100, 100, 100, 100, 100, 100, 100, 100, 100];
    const out = boxBlurGray(g, 3, 3, 1);
    expect(out[4]).toBeCloseTo(100);
  });
  it("smooths a spike", () => {
    const g = [0, 0, 0, 0, 255, 0, 0, 0, 0];
    const out = boxBlurGray(g, 3, 3, 1);
    expect(out[4]).toBeLessThan(255);
    expect(out[4]).toBeGreaterThan(0);
  });
});

describe("dodgeBlend", () => {
  it("returns ~255 when top is near 0 (no edge)", () => {
    expect(dodgeBlend(255, 255, 1)).toBe(255);
  });
  it("returns darker value when there's an edge", () => {
    const v = dodgeBlend(50, 200, 1);
    expect(v).toBeLessThan(255);
  });
  it("intensity 0 returns base", () => {
    expect(dodgeBlend(50, 200, 0)).toBe(50);
  });
  it("clamps to byte range", () => {
    const v = dodgeBlend(255, 0, 1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(255);
  });
});
