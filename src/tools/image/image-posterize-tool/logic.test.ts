import { describe, it, expect } from "vitest";
import { quantize, posterizePixel, paletteForLevels, validatePosterizeOptions } from "./logic";

describe("quantize", () => {
  it("snaps to 2 levels (0 or 255)", () => {
    expect(quantize(0, 2)).toBe(0);
    expect(quantize(255, 2)).toBe(255);
    expect(quantize(128, 2)).toBe(255);
    expect(quantize(64, 2)).toBe(0);
  });
  it("snaps to 4 levels (0, 85, 170, 255)", () => {
    expect(quantize(0, 4)).toBe(0);
    expect(quantize(80, 4)).toBe(85);
    expect(quantize(200, 4)).toBe(170);
    expect(quantize(255, 4)).toBe(255);
  });
  it("returns identity for 256 levels", () => {
    expect(quantize(123, 256)).toBe(123);
  });
  it("returns 0 for levels <= 1", () => {
    expect(quantize(200, 1)).toBe(0);
  });
  it("clamps out-of-range input", () => {
    expect(quantize(300, 4)).toBe(255);
    expect(quantize(-10, 4)).toBe(0);
  });
});

describe("posterizePixel", () => {
  it("quantizes all channels", () => {
    const out = posterizePixel({ r: 100, g: 150, b: 200, a: 255 }, 2);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeLessThanOrEqual(255);
    expect(out.b).toBeLessThanOrEqual(255);
  });
  it("preserves alpha", () => {
    const out = posterizePixel({ r: 100, g: 100, b: 100, a: 128 }, 4);
    expect(out.a).toBe(128);
  });
  it("reduces unique colors with fewer levels", () => {
    const out = posterizePixel({ r: 80, g: 80, b: 80, a: 255 }, 4);
    expect(out.r).toBe(85);
  });
});

describe("paletteForLevels", () => {
  it("returns N values", () => {
    expect(paletteForLevels(4).length).toBe(4);
  });
  it("includes 0 and 255", () => {
    const p = paletteForLevels(8);
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(255);
  });
  it("returns [0] for levels=1", () => {
    expect(paletteForLevels(1)).toEqual([0]);
  });
});

describe("validatePosterizeOptions", () => {
  it("accepts valid levels", () => {
    expect(validatePosterizeOptions({ levels: 4 })).toEqual({ ok: true });
    expect(validatePosterizeOptions({ levels: 256 })).toEqual({ ok: true });
  });
  it("rejects levels < 2", () => {
    expect(validatePosterizeOptions({ levels: 1 })).toHaveProperty("error");
  });
  it("rejects non-integer", () => {
    expect(validatePosterizeOptions({ levels: 4.5 })).toHaveProperty("error");
  });
  it("rejects levels > 256", () => {
    expect(validatePosterizeOptions({ levels: 500 })).toHaveProperty("error");
  });
});
