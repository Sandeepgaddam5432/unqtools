import { describe, it, expect } from "vitest";
import { saturationFactor, luma, applySaturation, validateSaturationOptions } from "./logic";

describe("saturationFactor", () => {
  it("returns 1 at value 0", () => {
    expect(saturationFactor(0)).toBe(1);
  });

  it("returns 0 at value -100", () => {
    expect(saturationFactor(-100)).toBe(0);
  });

  it("returns 2 at value 100", () => {
    expect(saturationFactor(100)).toBe(2);
  });

  it("clamps out-of-range input", () => {
    expect(saturationFactor(500)).toBe(2);
    expect(saturationFactor(-500)).toBe(0);
  });

  it("scales linearly", () => {
    expect(saturationFactor(50)).toBe(1.5);
  });
});

describe("luma", () => {
  it("returns 0 for black", () => {
    expect(luma({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("weights green most heavily", () => {
    const r = luma({ r: 100, g: 0, b: 0 });
    const g = luma({ r: 0, g: 100, b: 0 });
    expect(g).toBeGreaterThan(r);
  });
});

describe("applySaturation", () => {
  it("preserves pixel at value 0", () => {
    expect(applySaturation({ r: 100, g: 50, b: 25, a: 255 }, 0)).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });

  it("produces grayscale at -100", () => {
    const out = applySaturation({ r: 200, g: 100, b: 50, a: 255 }, -100);
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
  });

  it("increases color spread at +100", () => {
    const out = applySaturation({ r: 200, g: 100, b: 50, a: 255 }, 100);
    expect(out.r).toBeGreaterThan(200);
    expect(out.b).toBeLessThan(50);
  });

  it("preserves alpha", () => {
    expect(applySaturation({ r: 100, g: 100, b: 100, a: 128 }, 50).a).toBe(128);
  });

  it("clamps output", () => {
    const out = applySaturation({ r: 255, g: 0, b: 0, a: 255 }, 100);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeGreaterThanOrEqual(0);
  });
});

describe("validateSaturationOptions", () => {
  it("accepts valid range", () => {
    expect(validateSaturationOptions({ value: 0 })).toEqual({ ok: true });
    expect(validateSaturationOptions({ value: -100 })).toEqual({ ok: true });
    expect(validateSaturationOptions({ value: 100 })).toEqual({ ok: true });
  });

  it("rejects out-of-range", () => {
    expect(validateSaturationOptions({ value: 200 })).toHaveProperty("error");
  });

  it("rejects NaN", () => {
    expect(validateSaturationOptions({ value: Number.NaN })).toHaveProperty("error");
  });
});
