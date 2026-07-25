/**
 * Image Sharpener — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  buildSharpenKernel,
  buildGaussianKernel,
  validateSharpenOptions,
  applyKernel,
  localVariance,
  unsharpMask,
  highPassSharpen,
  edgeAwareSharpen,
  sharpenPixel,
  clampByteWrap,
  isIdentity,
  noiseWarning,
  haloWarning,
  preservesAlpha,
  batchValidate,
  clampLoupe,
  buildHighPassKernel,
  DEFAULT_OPTIONS,
  type SharpenOptions,
  type RgbPixel,
} from "./logic";

describe("buildSharpenKernel", () => {
  it("returns identity at strength 0", () => {
    const k = buildSharpenKernel(0);
    expect(k).toEqual([0, 0, 0, 0, 1, 0, 0, 0, 0]);
  });
  it("produces a sharpening kernel at strength 1", () => {
    const k = buildSharpenKernel(1);
    expect(k[4]).toBe(5);
    expect(k[1]).toBe(-1);
    expect(k[3]).toBe(-1);
    expect(k[5]).toBe(-1);
    expect(k[7]).toBe(-1);
  });
  it("clamps out-of-range strength", () => {
    const k = buildSharpenKernel(10);
    expect(k[4]).toBe(21);
    expect(k[1]).toBe(-5);
  });
  it("kernel sums to 1 (preserves brightness)", () => {
    const k = buildSharpenKernel(2);
    const sum = k.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("buildGaussianKernel", () => {
  it("returns normalized kernel (sums to 1)", () => {
    const k = buildGaussianKernel(1);
    const sum = k.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
  it("returns larger kernel for larger radius", () => {
    const k1 = buildGaussianKernel(1);
    const k3 = buildGaussianKernel(3);
    expect(k3.length).toBeGreaterThanOrEqual(k1.length);
  });
  it("peaks at the center", () => {
    const k = buildGaussianKernel(1);
    const center = Math.floor(k.length / 2);
    expect(k[center]).toBe(Math.max(...k));
  });
});

describe("validateSharpenOptions", () => {
  it("accepts valid strength", () => {
    expect(validateSharpenOptions({ amount: 0.5, radius: 1, threshold: 0, mode: "unsharp" })).toEqual({ ok: true });
  });
  it("rejects negative amount", () => {
    expect(validateSharpenOptions({ amount: -0.1, radius: 1, threshold: 0, mode: "unsharp" })).toHaveProperty("error");
  });
  it("rejects too-large amount", () => {
    expect(validateSharpenOptions({ amount: 10, radius: 1, threshold: 0, mode: "unsharp" })).toHaveProperty("error");
  });
  it("rejects too-small radius", () => {
    expect(validateSharpenOptions({ amount: 0.5, radius: 0.1, threshold: 0, mode: "unsharp" })).toHaveProperty("error");
  });
  it("rejects too-large threshold", () => {
    expect(validateSharpenOptions({ amount: 0.5, radius: 1, threshold: 300, mode: "unsharp" })).toHaveProperty("error");
  });
});

describe("applyKernel", () => {
  it("returns identity kernel result unchanged", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const k: [number, number, number, number, number, number, number, number, number] = [0, 0, 0, 0, 1, 0, 0, 0, 0];
    expect(applyKernel(values, k)).toBe(50);
  });
  it("averages with box blur kernel", () => {
    const values = [10, 10, 10, 10, 10, 10, 10, 10, 10];
    const k: [number, number, number, number, number, number, number, number, number] = [
      1, 1, 1, 1, 1, 1, 1, 1, 1,
    ];
    expect(applyKernel(values, k)).toBe(10);
  });
  it("handles zero-sum kernel", () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90];
    const k: [number, number, number, number, number, number, number, number, number] = [
      -1, -1, -1, -1, 8, -1, -1, -1, -1,
    ];
    expect(applyKernel(values, k)).toBe(0);
  });
});

describe("localVariance", () => {
  it("returns 0 for uniform patch", () => {
    expect(localVariance([50, 50, 50, 50, 50, 50, 50, 50, 50])).toBe(0);
  });
  it("returns positive for varying patch", () => {
    expect(localVariance([0, 100, 0, 100, 0, 100, 0, 100, 0])).toBeGreaterThan(0);
  });
});

describe("unsharpMask", () => {
  it("returns original when diff below threshold", () => {
    expect(unsharpMask(100, 99, 1, 5)).toBe(100);
  });
  it("sharpens when diff above threshold", () => {
    const out = unsharpMask(200, 100, 1, 5);
    expect(out).toBeGreaterThan(200);
  });
  it("clamps output to byte range", () => {
    const out = unsharpMask(255, 0, 5, 0);
    expect(out).toBeLessThanOrEqual(255);
  });
  it("handles negative diff (dark edges)", () => {
    const out = unsharpMask(50, 200, 1, 5);
    expect(out).toBeLessThan(50);
  });
});

describe("highPassSharpen", () => {
  it("returns original at amount 0", () => {
    expect(highPassSharpen(100, 80, 0)).toBe(100);
  });
  it("sharpens at positive amount", () => {
    const out = highPassSharpen(200, 100, 1);
    expect(out).toBeGreaterThan(200);
  });
  it("clamps to byte range", () => {
    const out = highPassSharpen(255, 0, 5);
    expect(out).toBeLessThanOrEqual(255);
    expect(out).toBeGreaterThanOrEqual(0);
  });
});

describe("edgeAwareSharpen", () => {
  it("skips flat areas (low variance)", () => {
    expect(edgeAwareSharpen(100, 100, 1, 0, 10)).toBe(100);
  });
  it("sharpens edges (high variance)", () => {
    const out = edgeAwareSharpen(200, 100, 1, 50, 10);
    expect(out).toBeGreaterThan(200);
  });
});

describe("sharpenPixel", () => {
  it("returns pixel unchanged at amount 0", () => {
    const p: RgbPixel = { r: 100, g: 50, b: 25, a: 255 };
    const blurred = { r: 100, g: 50, b: 25 };
    expect(sharpenPixel(p, blurred, { ...DEFAULT_OPTIONS, amount: 0 })).toEqual(p);
  });
  it("applies unsharp by default", () => {
    const p: RgbPixel = { r: 200, g: 100, b: 50, a: 255 };
    const blurred = { r: 100, g: 50, b: 25 };
    const out = sharpenPixel(p, blurred, { ...DEFAULT_OPTIONS, amount: 1, threshold: 0 });
    expect(out.r).toBeGreaterThan(200);
  });
  it("applies high-pass mode", () => {
    const p: RgbPixel = { r: 200, g: 100, b: 50, a: 255 };
    const blurred = { r: 100, g: 50, b: 25 };
    const out = sharpenPixel(p, blurred, { ...DEFAULT_OPTIONS, amount: 1, mode: "highpass" });
    expect(out.r).not.toBe(200);
  });
  it("preserves alpha", () => {
    const p: RgbPixel = { r: 100, g: 100, b: 100, a: 128 };
    const blurred = { r: 100, g: 100, b: 100 };
    expect(sharpenPixel(p, blurred, DEFAULT_OPTIONS).a).toBe(128);
  });
});

describe("clampByteWrap", () => {
  it("clamps above 255", () => expect(clampByteWrap(300)).toBe(255));
  it("clamps below 0", () => expect(clampByteWrap(-10)).toBe(0));
  it("rounds", () => expect(clampByteWrap(50.7)).toBe(51));
});

describe("isIdentity", () => {
  it("returns true at amount 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, amount: 0 })).toBe(true);
  });
  it("returns false at amount > 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, amount: 0.5 })).toBe(false);
  });
});

describe("noiseWarning", () => {
  it("warns at high amount + low threshold", () => {
    expect(noiseWarning({ amount: 3, radius: 1, threshold: 0, mode: "unsharp" })).toContain("noise");
  });
  it("returns null for safe settings", () => {
    expect(noiseWarning({ amount: 1, radius: 1, threshold: 5, mode: "unsharp" })).toBeNull();
  });
});

describe("haloWarning", () => {
  it("warns at high amount + large radius", () => {
    expect(haloWarning({ amount: 4, radius: 4, threshold: 0, mode: "unsharp" })).toContain("halo");
  });
  it("returns null for safe settings", () => {
    expect(haloWarning({ amount: 1, radius: 1, threshold: 0, mode: "unsharp" })).toBeNull();
  });
});

describe("preservesAlpha", () => {
  it("returns true for PNG/WebP, false for JPEG", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/webp")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("batchValidate", () => {
  it("validates each file's options", () => {
    const r = batchValidate([{ name: "a.png" }, { name: "b.png" }], DEFAULT_OPTIONS);
    expect(r).toHaveLength(2);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("propagates errors", () => {
    const r = batchValidate([{ name: "a.png" }], { ...DEFAULT_OPTIONS, amount: 10 });
    expect(r[0]!.result).toHaveProperty("error");
  });
});

describe("clampLoupe", () => {
  it("clamps to image bounds", () => {
    const pos = clampLoupe({ x: 0, y: 0 }, 100, 100, 20);
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(10);
  });
  it("clamps to upper-right corner", () => {
    const pos = clampLoupe({ x: 200, y: 200 }, 100, 100, 20);
    expect(pos.x).toBe(90);
    expect(pos.y).toBe(90);
  });
});

describe("buildHighPassKernel", () => {
  it("returns 3x3 kernel", () => {
    const k = buildHighPassKernel(1);
    expect(k.length).toBe(9);
  });
  it("center is largest value", () => {
    const k = buildHighPassKernel(2);
    expect(k[4]).toBe(Math.max(...k));
  });
  it("kernel sums to 1 (preserves brightness)", () => {
    const k = buildHighPassKernel(2);
    const sum = k.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
