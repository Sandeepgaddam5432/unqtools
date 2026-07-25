import { describe, it, expect } from "vitest";
import { contrastFactor, applyContrast, validateContrastOptions } from "./logic";

describe("contrastFactor", () => {
  it("returns 1 for value 0", () => {
    expect(contrastFactor(0)).toBeCloseTo(1, 5);
  });

  it("is > 1 for positive contrast", () => {
    expect(contrastFactor(50)).toBeGreaterThan(1);
  });

  it("is < 1 for negative contrast", () => {
    expect(contrastFactor(-50)).toBeLessThan(1);
  });

  it("clamps out-of-range input", () => {
    expect(contrastFactor(500)).toBeCloseTo(contrastFactor(100), 5);
  });
});

describe("applyContrast", () => {
  it("preserves mid-gray at value 0", () => {
    expect(applyContrast({ r: 128, g: 128, b: 128, a: 255 }, 0)).toEqual({ r: 128, g: 128, b: 128, a: 255 });
  });

  it("pulls values away from 128 at positive contrast", () => {
    const out = applyContrast({ r: 200, g: 100, b: 50, a: 255 }, 50);
    expect(out.r).toBeGreaterThan(200);
    expect(out.g).toBeLessThan(100);
  });

  it("pulls values toward 128 at negative contrast", () => {
    const out = applyContrast({ r: 200, g: 100, b: 50, a: 255 }, -50);
    expect(out.r).toBeLessThan(200);
    expect(out.g).toBeGreaterThan(100);
  });

  it("clamps to byte range", () => {
    const out = applyContrast({ r: 255, g: 0, b: 128, a: 255 }, 100);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeGreaterThanOrEqual(0);
  });

  it("preserves alpha", () => {
    expect(applyContrast({ r: 100, g: 100, b: 100, a: 128 }, 50).a).toBe(128);
  });
});

describe("validateContrastOptions", () => {
  it("accepts valid range", () => {
    expect(validateContrastOptions({ value: 0 })).toEqual({ ok: true });
    expect(validateContrastOptions({ value: 100 })).toEqual({ ok: true });
    expect(validateContrastOptions({ value: -100 })).toEqual({ ok: true });
  });

  it("rejects out-of-range", () => {
    expect(validateContrastOptions({ value: 200 })).toHaveProperty("error");
  });

  it("rejects NaN", () => {
    expect(validateContrastOptions({ value: Number.NaN })).toHaveProperty("error");
  });
});
