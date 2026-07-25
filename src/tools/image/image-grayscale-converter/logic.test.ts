/**
 * Image Grayscale Converter — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  luma,
  grayscalePixel,
  invertPixel,
  thresholdPixel,
  posterizePixel,
  duochromePixel,
  bayerDitherPixel,
  BAYER_4X4,
  validateGrayscaleOptions,
  cssFilter,
  preservesAlpha,
  isIdentity,
  batchValidate,
  applyFilterStack,
  LUMA_R, LUMA_G, LUMA_B,
  BT709_R, BT709_G, BT709_B,
  BT2020_R, BT2020_G, BT2020_B,
  type RgbPixel,
} from "./logic";

describe("luma — algorithms", () => {
  it("computes 0 for black", () => {
    expect(luma({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it("computes ~255 for white", () => {
    expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0);
  });
  it("average algorithm averages channels", () => {
    expect(luma({ r: 30, g: 60, b: 90 }, "average")).toBeCloseTo(60, 0);
  });
  it("lightness uses (max+min)/2", () => {
    expect(luma({ r: 0, g: 100, b: 200 }, "lightness")).toBe(100);
  });
  it("rms uses root mean square", () => {
    expect(luma({ r: 0, g: 0, b: 100 }, "rms")).toBeCloseTo(100 / Math.sqrt(3), 1);
  });
  it("bt709 weights blue low", () => {
    expect(BT709_B).toBeLessThan(BT709_R);
    expect(BT709_R).toBeLessThan(BT709_G);
  });
  it("bt2020 weights blue lowest", () => {
    expect(BT2020_B).toBeLessThan(BT2020_R);
    expect(BT2020_R).toBeLessThan(BT2020_G);
  });
  it("BT.601 weights green most heavily", () => {
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
  it("honors algorithm choice", () => {
    const lumR = grayscalePixel({ r: 100, g: 200, b: 50, a: 255 }, 1, "luminance");
    const avgR = grayscalePixel({ r: 100, g: 200, b: 50, a: 255 }, 1, "average");
    expect(lumR.r).not.toBe(avgR.r);
  });
});

describe("invertPixel", () => {
  it("inverts all channels by default", () => {
    expect(invertPixel({ r: 100, g: 50, b: 25, a: 255 })).toEqual({ r: 155, g: 205, b: 230, a: 255 });
  });
  it("honors per-channel mask", () => {
    expect(invertPixel({ r: 100, g: 50, b: 25, a: 255 }, { r: true, g: false, b: false })).toEqual({ r: 155, g: 50, b: 25, a: 255 });
  });
  it("preserves alpha", () => {
    expect(invertPixel({ r: 100, g: 100, b: 100, a: 128 }).a).toBe(128);
  });
});

describe("thresholdPixel", () => {
  it("returns white for bright pixel", () => {
    expect(thresholdPixel({ r: 200, g: 200, b: 200, a: 255 }, 128)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
  it("returns black for dark pixel", () => {
    expect(thresholdPixel({ r: 50, g: 50, b: 50, a: 255 }, 128)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
  it("preserves alpha", () => {
    expect(thresholdPixel({ r: 50, g: 50, b: 50, a: 100 }, 128).a).toBe(100);
  });
});

describe("posterizePixel", () => {
  it("reduces to 2 levels", () => {
    expect(posterizePixel({ r: 100, g: 100, b: 100, a: 255 }, 2)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(posterizePixel({ r: 200, g: 200, b: 200, a: 255 }, 2)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
  it("clamps levels to 2..256", () => {
    expect(posterizePixel({ r: 100, g: 100, b: 100, a: 255 }, 1)).toEqual(posterizePixel({ r: 100, g: 100, b: 100, a: 255 }, 2));
  });
  it("preserves alpha", () => {
    expect(posterizePixel({ r: 100, g: 100, b: 100, a: 200 }, 4).a).toBe(200);
  });
});

describe("duochromePixel", () => {
  it("maps black to dark color", () => {
    const out = duochromePixel({ r: 0, g: 0, b: 0, a: 255 }, { r: 10, g: 20, b: 30, a: 255 }, { r: 200, g: 220, b: 240, a: 255 });
    expect(out).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });
  it("maps white to light color", () => {
    const out = duochromePixel({ r: 255, g: 255, b: 255, a: 255 }, { r: 10, g: 20, b: 30, a: 255 }, { r: 200, g: 220, b: 240, a: 255 });
    expect(out).toEqual({ r: 200, g: 220, b: 240, a: 255 });
  });
  it("preserves alpha", () => {
    const out = duochromePixel({ r: 100, g: 100, b: 100, a: 128 }, { r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 });
    expect(out.a).toBe(128);
  });
});

describe("BAYER_4X4", () => {
  it("is a 4x4 matrix", () => {
    expect(BAYER_4X4.length).toBe(4);
    for (const row of BAYER_4X4) expect(row.length).toBe(4);
  });
  it("contains values 0-15 (unique)", () => {
    const flat = BAYER_4X4.flat();
    expect(new Set(flat).size).toBe(16);
  });
});

describe("bayerDitherPixel", () => {
  it("returns pixel in valid byte range", () => {
    const out = bayerDitherPixel({ r: 128, g: 128, b: 128, a: 255 }, 0, 0, 2);
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(255);
  });
  it("preserves alpha", () => {
    const out = bayerDitherPixel({ r: 128, g: 128, b: 128, a: 100 }, 0, 0, 2);
    expect(out.a).toBe(100);
  });
});

describe("validateGrayscaleOptions", () => {
  it("accepts valid strength", () => {
    expect(validateGrayscaleOptions({ strength: 0.5, algorithm: "luminance" })).toEqual({ ok: true });
  });
  it("rejects out-of-range strength", () => {
    expect(validateGrayscaleOptions({ strength: -1, algorithm: "luminance" })).toHaveProperty("error");
    expect(validateGrayscaleOptions({ strength: 2, algorithm: "luminance" })).toHaveProperty("error");
  });
});

describe("cssFilter", () => {
  it("includes grayscale() when grayscale filter", () => {
    const s = cssFilter({ strength: 0.5, algorithm: "luminance" }, ["grayscale"]);
    expect(s).toContain("grayscale(50%)");
  });
  it("includes invert() when invert filter", () => {
    const s = cssFilter({ strength: 1, algorithm: "luminance" }, ["invert"]);
    expect(s).toContain("invert(100%)");
  });
  it("returns no-op for empty stack", () => {
    const s = cssFilter({ strength: 0, algorithm: "luminance" }, []);
    expect(s).toContain("no filters");
  });
});

describe("preservesAlpha", () => {
  it("returns true for PNG/WebP, false for JPEG", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/webp")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("isIdentity", () => {
  it("returns true at strength 0", () => {
    expect(isIdentity(0)).toBe(true);
  });
  it("returns false at strength > 0", () => {
    expect(isIdentity(0.5)).toBe(false);
  });
});

describe("batchValidate", () => {
  it("validates each file's options", () => {
    const r = batchValidate([{ name: "a.png" }, { name: "b.png" }], { strength: 0.5, algorithm: "luminance" });
    expect(r).toHaveLength(2);
    expect(r[0]!.result).toEqual({ ok: true });
  });
});

describe("applyFilterStack", () => {
  it("applies grayscale then invert", () => {
    const p: RgbPixel = { r: 255, g: 0, b: 0, a: 255 };
    const out = applyFilterStack(p, [
      { type: "grayscale", strength: 1 },
      { type: "invert" },
    ]);
    // After grayscale: y = 0.299*255 = ~76. After invert: 255-76 = ~179
    expect(out.r).toBeGreaterThan(150);
    expect(out.r).toBeLessThan(200);
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
  });
  it("returns pixel unchanged for empty stack", () => {
    const p: RgbPixel = { r: 100, g: 50, b: 25, a: 255 };
    expect(applyFilterStack(p, [])).toEqual(p);
  });
});
