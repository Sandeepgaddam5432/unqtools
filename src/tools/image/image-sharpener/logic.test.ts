import { describe, it, expect } from "vitest";
import { buildSharpenKernel, validateSharpenOptions, applyKernel, clampByte } from "./logic";

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
    // strength clamped to 5: center = 1 + 4*5 = 21, neighbors = -5
    expect(k[4]).toBe(21);
    expect(k[1]).toBe(-5);
  });

  it("kernel sums to 1 (preserves brightness)", () => {
    const k = buildSharpenKernel(2);
    const sum = k.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe("validateSharpenOptions", () => {
  it("accepts valid strength", () => {
    expect(validateSharpenOptions({ strength: 0.5 })).toEqual({ ok: true });
  });

  it("rejects negative strength", () => {
    expect(validateSharpenOptions({ strength: -0.1 })).toHaveProperty("error");
  });

  it("rejects too-large strength", () => {
    expect(validateSharpenOptions({ strength: 10 })).toHaveProperty("error");
  });

  it("accepts boundary values", () => {
    expect(validateSharpenOptions({ strength: 0 })).toEqual({ ok: true });
    expect(validateSharpenOptions({ strength: 5 })).toEqual({ ok: true });
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
    // All values sum to 450, center is 50, result = 8*50 - 400 = 0
    expect(applyKernel(values, k)).toBe(0);
  });
});

describe("clampByte", () => {
  it("clamps above 255", () => expect(clampByte(300)).toBe(255));
  it("clamps below 0", () => expect(clampByte(-10)).toBe(0));
  it("rounds", () => expect(clampByte(50.7)).toBe(51));
});
