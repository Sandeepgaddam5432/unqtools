import { describe, it, expect } from "vitest";
import { grayscalePixel, luma, validateGrayscaleOptions, LUMA_R, LUMA_G, LUMA_B } from "./logic";

describe("luma", () => {
  it("computes luminance for black", () => {
    expect(luma({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("computes luminance for white", () => {
    expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0);
  });

  it("weights green most heavily per BT.601", () => {
    expect(LUMA_G).toBeGreaterThan(LUMA_R);
    expect(LUMA_G).toBeGreaterThan(LUMA_B);
  });

  it("produces same value for same R, G, B", () => {
    expect(luma({ r: 100, g: 100, b: 100 })).toBeCloseTo(100, 5);
  });
});

describe("grayscalePixel", () => {
  it("fully grayscales at strength 1", () => {
    const r = grayscalePixel({ r: 255, g: 0, b: 0, a: 255 }, 1);
    expect(r.r).toBe(r.g);
    expect(r.g).toBe(r.b);
  });

  it("leaves unchanged at strength 0", () => {
    expect(grayscalePixel({ r: 100, g: 50, b: 25, a: 255 }, 0)).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });

  it("preserves alpha", () => {
    const r = grayscalePixel({ r: 100, g: 100, b: 100, a: 128 }, 1);
    expect(r.a).toBe(128);
  });

  it("clamps out-of-range strength", () => {
    const r = grayscalePixel({ r: 100, g: 100, b: 100, a: 255 }, 5);
    expect(r.r).toBe(100);
  });
});

describe("validateGrayscaleOptions", () => {
  it("accepts valid strength", () => {
    expect(validateGrayscaleOptions({ strength: 0.5 })).toEqual({ ok: true });
  });

  it("rejects out-of-range strength", () => {
    expect(validateGrayscaleOptions({ strength: -1 })).toHaveProperty("error");
    expect(validateGrayscaleOptions({ strength: 2 })).toHaveProperty("error");
  });
});
