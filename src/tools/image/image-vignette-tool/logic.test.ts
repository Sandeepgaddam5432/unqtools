import { describe, it, expect } from "vitest";
import { normalizedDistance, vignetteFactor, applyVignette, validateVignetteOptions } from "./logic";

describe("normalizedDistance", () => {
  it("is 0 at the center", () => {
    expect(normalizedDistance(50, 50, 100, 100)).toBeCloseTo(0, 5);
  });
  it("is 1 at the corner", () => {
    expect(normalizedDistance(0, 0, 100, 100)).toBeCloseTo(1, 5);
    expect(normalizedDistance(100, 100, 100, 100)).toBeCloseTo(1, 5);
  });
  it("scales linearly", () => {
    const a = normalizedDistance(50, 0, 100, 100);
    const b = normalizedDistance(75, 0, 100, 100);
    expect(b).toBeGreaterThan(a);
  });
});

describe("vignetteFactor", () => {
  it("is 1 at center for any amount", () => {
    const f = vignetteFactor(50, 50, 100, 100, { amount: 80, size: 0, feather: 50 });
    expect(f).toBeCloseTo(1, 5);
  });
  it("decreases toward corners", () => {
    const center = vignetteFactor(50, 50, 100, 100, { amount: 80, size: 0, feather: 50 });
    const corner = vignetteFactor(0, 0, 100, 100, { amount: 80, size: 0, feather: 50 });
    expect(corner).toBeLessThan(center);
  });
  it("is 1 everywhere when amount is 0", () => {
    const f = vignetteFactor(0, 0, 100, 100, { amount: 0, size: 0, feather: 50 });
    expect(f).toBe(1);
  });
  it("never goes below (1 - amount)", () => {
    const f = vignetteFactor(0, 0, 100, 100, { amount: 80, size: 0, feather: 10 });
    expect(f).toBeGreaterThanOrEqual(0.2 - 1e-6);
  });
  it("clamps feather to avoid divide-by-zero", () => {
    expect(() => vignetteFactor(0, 0, 100, 100, { amount: 50, size: 0, feather: 0 })).not.toThrow();
  });
});

describe("applyVignette", () => {
  it("scales pixel by factor", () => {
    const out = applyVignette({ r: 200, g: 100, b: 50, a: 255 }, 0.5);
    expect(out.r).toBe(100);
    expect(out.g).toBe(50);
    expect(out.b).toBe(25);
  });
  it("preserves alpha", () => {
    const out = applyVignette({ r: 200, g: 100, b: 50, a: 128 }, 0.5);
    expect(out.a).toBe(128);
  });
  it("factor 1 leaves pixel unchanged", () => {
    const out = applyVignette({ r: 200, g: 100, b: 50, a: 255 }, 1);
    expect(out).toEqual({ r: 200, g: 100, b: 50, a: 255 });
  });
});

describe("validateVignetteOptions", () => {
  it("accepts valid options", () => {
    expect(validateVignetteOptions({ amount: 50, size: 30, feather: 40 })).toEqual({ ok: true });
  });
  it("rejects out-of-range amount", () => {
    expect(validateVignetteOptions({ amount: 150, size: 30, feather: 40 })).toHaveProperty("error");
  });
  it("rejects out-of-range size", () => {
    expect(validateVignetteOptions({ amount: 50, size: -1, feather: 40 })).toHaveProperty("error");
  });
});
