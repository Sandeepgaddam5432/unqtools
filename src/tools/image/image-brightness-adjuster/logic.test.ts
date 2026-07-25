import { describe, it, expect } from "vitest";
import { brightnessDelta, applyBrightness, validateBrightnessOptions } from "./logic";

describe("brightnessDelta", () => {
  it("returns 0 for value 0", () => {
    expect(brightnessDelta(0)).toBe(0);
  });

  it("returns 255 for value 100", () => {
    expect(brightnessDelta(100)).toBeCloseTo(255, 0);
  });

  it("returns -255 for value -100", () => {
    expect(brightnessDelta(-100)).toBeCloseTo(-255, 0);
  });

  it("clamps out-of-range input", () => {
    expect(brightnessDelta(500)).toBeCloseTo(255, 0);
    expect(brightnessDelta(-500)).toBeCloseTo(-255, 0);
  });

  it("scales linearly", () => {
    expect(brightnessDelta(50)).toBeCloseTo(127.5, 1);
  });
});

describe("applyBrightness", () => {
  it("preserves pixel at 0", () => {
    expect(applyBrightness({ r: 100, g: 50, b: 25, a: 255 }, 0)).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });

  it("increases pixel values for positive brightness", () => {
    const out = applyBrightness({ r: 100, g: 100, b: 100, a: 255 }, 50);
    expect(out.r).toBeGreaterThan(100);
  });

  it("clamps at 255", () => {
    const out = applyBrightness({ r: 250, g: 250, b: 250, a: 255 }, 100);
    expect(out.r).toBe(255);
  });

  it("clamps at 0", () => {
    const out = applyBrightness({ r: 10, g: 10, b: 10, a: 255 }, -100);
    expect(out.r).toBe(0);
  });

  it("preserves alpha", () => {
    expect(applyBrightness({ r: 100, g: 100, b: 100, a: 128 }, 50).a).toBe(128);
  });
});

describe("validateBrightnessOptions", () => {
  it("accepts valid range", () => {
    expect(validateBrightnessOptions({ value: 50 })).toEqual({ ok: true });
    expect(validateBrightnessOptions({ value: -50 })).toEqual({ ok: true });
  });

  it("accepts boundaries", () => {
    expect(validateBrightnessOptions({ value: -100 })).toEqual({ ok: true });
    expect(validateBrightnessOptions({ value: 100 })).toEqual({ ok: true });
  });

  it("rejects out-of-range", () => {
    expect(validateBrightnessOptions({ value: 200 })).toHaveProperty("error");
    expect(validateBrightnessOptions({ value: -200 })).toHaveProperty("error");
  });

  it("rejects NaN", () => {
    expect(validateBrightnessOptions({ value: Number.NaN })).toHaveProperty("error");
  });
});
