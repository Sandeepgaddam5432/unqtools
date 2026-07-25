import { describe, it, expect } from "vitest";
import {
  SOBEL_X,
  SOBEL_Y,
  luma,
  toLumaArray,
  sobelMagnitude,
  edgePixel,
  validateEdgeOptions,
} from "./logic";

describe("luma", () => {
  it("black is 0", () => {
    expect(luma({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it("white is 255", () => {
    expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0);
  });
});

describe("Sobel kernels", () => {
  it("have 3x3 shape", () => {
    expect(SOBEL_X.length).toBe(3);
    expect(SOBEL_Y.length).toBe(3);
    expect(SOBEL_X[0]!.length).toBe(3);
  });
  it("sum to zero (zero DC response)", () => {
    const sumX = SOBEL_X.flat().reduce((a, b) => a + b, 0);
    const sumY = SOBEL_Y.flat().reduce((a, b) => a + b, 0);
    expect(sumX).toBe(0);
    expect(sumY).toBe(0);
  });
});

describe("toLumaArray", () => {
  it("converts RGBA bytes to luma array", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const l = toLumaArray(rgba, 2, 1);
    expect(l.length).toBe(2);
    expect(l[0]).toBeCloseTo(0, 0);
    expect(l[1]).toBeCloseTo(255, 0);
  });
});

describe("sobelMagnitude", () => {
  it("returns 0 for flat region", () => {
    const luma = new Float32Array([100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(sobelMagnitude(luma, 3, 3, 1, 1)).toBeCloseTo(0, 5);
  });
  it("returns nonzero for vertical edge", () => {
    const luma = new Float32Array([0, 0, 255, 0, 0, 255, 0, 0, 255]);
    const m = sobelMagnitude(luma, 3, 3, 1, 1);
    expect(m).toBeGreaterThan(0);
  });
  it("clamps at image borders", () => {
    const luma = new Float32Array([0, 255, 0, 255]);
    expect(() => sobelMagnitude(luma, 2, 2, 0, 0)).not.toThrow();
  });
});

describe("edgePixel", () => {
  const luma = new Float32Array([0, 0, 255, 0, 0, 255, 0, 0, 255]);
  it("returns black on edge with full intensity", () => {
    const p = edgePixel(luma, 3, 3, 1, 1, { threshold: 0, intensity: 100, invert: false }, { r: 200, g: 200, b: 200, a: 255 });
    expect(p.r).toBe(p.g);
    expect(p.g).toBe(p.b);
    expect(p.a).toBe(255);
  });
  it("preserves original at intensity 0", () => {
    const p = edgePixel(luma, 3, 3, 1, 1, { threshold: 0, intensity: 0, invert: false }, { r: 100, g: 50, b: 25, a: 255 });
    expect(p).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });
  it("inverts values", () => {
    const a = edgePixel(luma, 3, 3, 1, 1, { threshold: 0, intensity: 100, invert: false }, { r: 128, g: 128, b: 128, a: 255 });
    const b = edgePixel(luma, 3, 3, 1, 1, { threshold: 0, intensity: 100, invert: true }, { r: 128, g: 128, b: 128, a: 255 });
    expect(a.r + b.r).toBe(255);
  });
});

describe("validateEdgeOptions", () => {
  it("accepts valid range", () => {
    expect(validateEdgeOptions({ threshold: 50, intensity: 80, invert: false })).toEqual({ ok: true });
  });
  it("rejects out-of-range threshold", () => {
    expect(validateEdgeOptions({ threshold: 200, intensity: 50, invert: false })).toHaveProperty("error");
  });
  it("rejects out-of-range intensity", () => {
    expect(validateEdgeOptions({ threshold: 50, intensity: -1, invert: false })).toHaveProperty("error");
  });
});
