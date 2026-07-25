import { describe, it, expect } from "vitest";
import { applySepia, vignetteFactor, applyGrain, oldPhotoPixel, makeRng, validateOldPhotoOptions } from "./logic";

describe("applySepia", () => {
  it("leaves pixel unchanged at strength 0", () => {
    const out = applySepia({ r: 100, g: 50, b: 25, a: 255 }, 0);
    expect(out).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });
  it("preserves alpha", () => {
    const out = applySepia({ r: 100, g: 50, b: 25, a: 128 }, 1);
    expect(out.a).toBe(128);
  });
  it("applies full sepia matrix at strength 1", () => {
    const out = applySepia({ r: 100, g: 100, b: 100, a: 255 }, 1);
    expect(out.r).toBeGreaterThan(100);
  });
});

describe("vignetteFactor", () => {
  it("is 1 at center for any strength", () => {
    expect(vignetteFactor(50, 50, 100, 100, 0.8, 0.5)).toBeCloseTo(1, 5);
  });
  it("decreases toward corners with positive strength", () => {
    const a = vignetteFactor(50, 50, 100, 100, 0.8, 0.3);
    const b = vignetteFactor(0, 0, 100, 100, 0.8, 0.3);
    expect(b).toBeLessThan(a);
  });
  it("is 1 everywhere when strength is 0", () => {
    expect(vignetteFactor(0, 0, 100, 100, 0, 0.5)).toBe(1);
  });
});

describe("applyGrain", () => {
  it("leaves pixel unchanged when strength is 0", () => {
    const out = applyGrain({ r: 100, g: 50, b: 25, a: 255 }, 0.7, 0);
    expect(out).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });
  it("shifts all channels equally", () => {
    const out = applyGrain({ r: 100, g: 100, b: 100, a: 255 }, 0.5, 1);
    expect(out.r - 100).toBeCloseTo(out.g - 100, 0);
  });
  it("clamps to byte range", () => {
    const out = applyGrain({ r: 250, g: 250, b: 250, a: 255 }, 1, 1);
    expect(out.r).toBeLessThanOrEqual(255);
  });
});

describe("oldPhotoPixel", () => {
  it("applies all three effects", () => {
    const out = oldPhotoPixel({ r: 200, g: 100, b: 50, a: 255 }, 90, 90, 100, 100, 0.3, {
      sepia: 0.8, vignette: 0.5, grain: 0.5, vignetteRadius: 0.5,
    });
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.a).toBe(255);
  });
});

describe("makeRng", () => {
  it("is deterministic for same seed", () => {
    expect(makeRng(123)()).toBe(makeRng(123)());
  });
});

describe("validateOldPhotoOptions", () => {
  it("accepts valid options", () => {
    expect(validateOldPhotoOptions({ sepia: 0.8, vignette: 0.5, grain: 0.3, vignetteRadius: 0.5 })).toEqual({ ok: true });
  });
  it("rejects bad sepia", () => {
    expect(validateOldPhotoOptions({ sepia: 2, vignette: 0.5, grain: 0.3, vignetteRadius: 0.5 })).toHaveProperty("error");
  });
  it("rejects bad vignette radius", () => {
    expect(validateOldPhotoOptions({ sepia: 0.8, vignette: 0.5, grain: 0.3, vignetteRadius: 2 })).toHaveProperty("error");
  });
});
