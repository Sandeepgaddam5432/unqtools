import { describe, it, expect } from "vitest";
import { validateNeon, luma, applyKernel, sobelMag, glowFalloff, blendNeon, isEdge, SOBEL_X, SOBEL_Y } from "./logic";

describe("validateNeon", () => {
  it("passes valid opts", () => {
    const o = { threshold: 100, radius: 5, color: [255, 0, 200] as [number, number, number], intensity: 0.7 };
    expect(validateNeon(o)).toEqual({ threshold: 100, radius: 5, color: [255, 0, 200], intensity: 0.7 });
  });
  it("rounds radius", () => {
    expect(validateNeon({ threshold: 100, radius: 5.4, color: [0, 0, 0], intensity: 0.5 }).radius).toBe(5);
  });
  it("errors on bad threshold", () => {
    expect(validateNeon({ threshold: 300, radius: 5, color: [0, 0, 0], intensity: 0.5 })).toHaveProperty("error");
  });
  it("errors on bad radius", () => {
    expect(validateNeon({ threshold: 100, radius: 50, color: [0, 0, 0], intensity: 0.5 })).toHaveProperty("error");
  });
  it("errors on bad color", () => {
    expect(validateNeon({ threshold: 100, radius: 5, color: [-1, 0, 0], intensity: 0.5 })).toHaveProperty("error");
  });
});

describe("kernels", () => {
  it("have 9 elements and sum to 0", () => {
    expect(SOBEL_X.length).toBe(9);
    expect(SOBEL_Y.length).toBe(9);
    expect(SOBEL_X.reduce((a, b) => a + b, 0)).toBe(0);
    expect(SOBEL_Y.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("luma", () => {
  it("is 0 for black, ~255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
});

describe("applyKernel", () => {
  it("returns 0 for uniform with Sobel", () => {
    const g = new Array(9).fill(100);
    expect(applyKernel(g, 1, 1, 3, 3, SOBEL_X)).toBe(0);
  });
});

describe("sobelMag", () => {
  it("is 0 for uniform", () => {
    const g = new Array(25).fill(50);
    expect(sobelMag(g, 2, 2, 5, 5)).toBe(0);
  });
  it("is > 0 for edge", () => {
    const g: number[] = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) g.push(x < 2 ? 255 : 0);
    expect(sobelMag(g, 2, 2, 5, 5)).toBeGreaterThan(0);
  });
});

describe("glowFalloff", () => {
  it("is 1 at distance 0", () => { expect(glowFalloff(0, 10)).toBeCloseTo(1); });
  it("decreases with distance", () => {
    expect(glowFalloff(2, 10)).toBeGreaterThan(glowFalloff(8, 10));
  });
  it("is 0 when radius is 0 and distance > 0", () => {
    expect(glowFalloff(5, 0)).toBe(0);
  });
});

describe("blendNeon", () => {
  it("adds glow scaled by amount", () => {
    expect(blendNeon([0, 0, 0, 255], [200, 100, 50], 0.5)).toEqual([100, 50, 25, 255]);
  });
  it("clamps at 255", () => {
    expect(blendNeon([200, 200, 200, 255], [200, 200, 200], 1)).toEqual([255, 255, 255, 255]);
  });
  it("no glow at amount 0", () => {
    expect(blendNeon([10, 20, 30, 255], [200, 200, 200], 0)).toEqual([10, 20, 30, 255]);
  });
});

describe("isEdge", () => {
  it("true when magnitude >= threshold", () => {
    expect(isEdge(100, 50)).toBe(true);
  });
  it("false when magnitude < threshold", () => {
    expect(isEdge(10, 50)).toBe(false);
  });
  it("boundary inclusive", () => {
    expect(isEdge(50, 50)).toBe(true);
  });
});
