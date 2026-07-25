import { describe, it, expect } from "vitest";
import { validateCharcoal, SOBEL_X, SOBEL_Y, applyKernel, sobelMagnitude, luma, edgeToCharcoal } from "./logic";

describe("validateCharcoal", () => {
  it("passes valid opts", () => {
    expect(validateCharcoal({ strength: 0.6, texture: 0.3 })).toEqual({ strength: 0.6, texture: 0.3 });
  });
  it("errors on bad strength", () => {
    expect(validateCharcoal({ strength: 2, texture: 0.3 })).toHaveProperty("error");
  });
  it("errors on bad texture", () => {
    expect(validateCharcoal({ strength: 0.5, texture: -1 })).toHaveProperty("error");
  });
});

describe("kernels", () => {
  it("Sobel X sums to 0", () => {
    expect(SOBEL_X.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it("Sobel Y sums to 0", () => {
    expect(SOBEL_Y.reduce((a, b) => a + b, 0)).toBe(0);
  });
  it("Sobel X has 9 elements", () => {
    expect(SOBEL_X.length).toBe(9);
  });
});

describe("applyKernel", () => {
  it("returns 0 for uniform region with Sobel X", () => {
    const g = new Array(9).fill(100);
    expect(applyKernel(g, 1, 1, 3, 3, SOBEL_X)).toBe(0);
  });
  it("returns positive for left-bright gradient", () => {
    const g = [200, 100, 0, 200, 100, 0, 200, 100, 0];
    expect(applyKernel(g, 1, 1, 3, 3, SOBEL_X)).toBeLessThan(0);
  });
});

describe("sobelMagnitude", () => {
  it("is 0 for uniform region", () => {
    const g = new Array(25).fill(50);
    expect(sobelMagnitude(g, 2, 2, 5, 5)).toBe(0);
  });
  it("is positive for sharp edge", () => {
    const g: number[] = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) g.push(x < 2 ? 255 : 0);
    expect(sobelMagnitude(g, 2, 2, 5, 5)).toBeGreaterThan(0);
  });
});

describe("luma", () => {
  it("is 0 for black", () => { expect(luma(0, 0, 0)).toBe(0); });
  it("is ~255 for white", () => { expect(luma(255, 255, 255)).toBeCloseTo(255); });
});

describe("edgeToCharcoal", () => {
  it("returns near-white (paper) when magnitude is 0 and no texture", () => {
    expect(edgeToCharcoal(0, 0.5, 0, 0.5)).toBe(255);
  });
  it("returns darker for higher magnitude", () => {
    const low = edgeToCharcoal(10, 0.5, 0, 0.5);
    const high = edgeToCharcoal(100, 0.5, 0, 0.5);
    expect(high).toBeLessThan(low);
  });
  it("clamps to byte range", () => {
    const v = edgeToCharcoal(1000, 1, 1, 1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(255);
  });
});
