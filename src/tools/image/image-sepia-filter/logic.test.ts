/**
 * Image Sepia Filter — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  sepiaPixel,
  tintPixel,
  vignetteFactor,
  validateSepiaOptions,
  cssFilter,
  preservesAlpha,
  isIdentity,
  batchValidate,
  presetList,
  SEPIA_MATRIX,
  VINTAGE_PRESETS,
  type RgbPixel,
  type VintagePreset,
} from "./logic";

describe("sepiaPixel", () => {
  it("applies full sepia at strength 1", () => {
    const out = sepiaPixel({ r: 255, g: 255, b: 255, a: 255 }, 1);
    // For white, sepia transforms should produce warm browns (all > 200).
    expect(out.r).toBeGreaterThan(200);
    expect(out.g).toBeGreaterThan(180);
    expect(out.b).toBeGreaterThan(140);
  });
  it("leaves pixel unchanged at strength 0", () => {
    expect(sepiaPixel({ r: 100, g: 50, b: 25, a: 255 }, 0)).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });
  it("preserves alpha", () => {
    expect(sepiaPixel({ r: 100, g: 100, b: 100, a: 128 }, 1).a).toBe(128);
  });
  it("clamps output to byte range", () => {
    const out = sepiaPixel({ r: 255, g: 255, b: 255, a: 255 }, 1);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeLessThanOrEqual(255);
    expect(out.b).toBeLessThanOrEqual(255);
  });
  it("clamps out-of-range strength", () => {
    const out = sepiaPixel({ r: 100, g: 100, b: 100, a: 255 }, 5);
    expect(out.r).toBeGreaterThanOrEqual(90);
  });
  it("honors preset choice", () => {
    const classic = sepiaPixel({ r: 100, g: 100, b: 100, a: 255 }, 1, "classic");
    const warm = sepiaPixel({ r: 100, g: 100, b: 100, a: 255 }, 1, "warm");
    expect(classic.r).not.toBe(warm.r);
  });
});

describe("tintPixel", () => {
  it("moves pixel toward tint color", () => {
    const out = tintPixel({ r: 100, g: 100, b: 100, a: 255 }, { r: 200, g: 50, b: 50, a: 255 }, 1);
    expect(out.r).toBeGreaterThan(100);
    expect(out.g).toBeLessThan(100);
  });
  it("preserves alpha", () => {
    const out = tintPixel({ r: 100, g: 100, b: 100, a: 128 }, { r: 200, g: 50, b: 50, a: 255 }, 1);
    expect(out.a).toBe(128);
  });
});

describe("vignetteFactor", () => {
  it("returns 1 at strength 0", () => {
    expect(vignetteFactor(0.5, 0)).toBe(1);
  });
  it("returns 1 at center (r=0)", () => {
    expect(vignetteFactor(0, 1)).toBe(1);
  });
  it("decreases at corners with positive strength", () => {
    expect(vignetteFactor(1, 1)).toBe(0);
    expect(vignetteFactor(1, 0.5)).toBe(0.5);
  });
});

describe("validateSepiaOptions", () => {
  it("accepts valid strength", () => {
    expect(validateSepiaOptions({ strength: 0.5 })).toEqual({ ok: true });
  });
  it("rejects out-of-range strength", () => {
    expect(validateSepiaOptions({ strength: -1 })).toHaveProperty("error");
    expect(validateSepiaOptions({ strength: 2 })).toHaveProperty("error");
  });
  it("accepts boundaries", () => {
    expect(validateSepiaOptions({ strength: 0 })).toEqual({ ok: true });
    expect(validateSepiaOptions({ strength: 1 })).toEqual({ ok: true });
  });
});

describe("cssFilter", () => {
  it("includes sepia() with strength percentage", () => {
    expect(cssFilter({ strength: 0.8 }, "classic")).toContain("sepia(80%)");
  });
  it("returns no-op at strength 0", () => {
    expect(cssFilter({ strength: 0 }, "classic")).toContain("no filters");
  });
  it("adds hue-rotate for warm preset", () => {
    expect(cssFilter({ strength: 1 }, "warm")).toContain("hue-rotate");
  });
  it("adds contrast for faded preset", () => {
    expect(cssFilter({ strength: 1 }, "faded")).toContain("contrast");
  });
});

describe("SEPIA_MATRIX", () => {
  it("has all 9 coefficients", () => {
    expect(Object.keys(SEPIA_MATRIX).length).toBe(9);
  });
  it("red contribution is highest in r channel", () => {
    expect(SEPIA_MATRIX.rr).toBeGreaterThan(SEPIA_MATRIX.gr);
    expect(SEPIA_MATRIX.rr).toBeGreaterThan(SEPIA_MATRIX.br);
  });
});

describe("VINTAGE_PRESETS", () => {
  it("has all 6 presets", () => {
    expect(Object.keys(VINTAGE_PRESETS).length).toBe(6);
  });
  it("each preset has matrix, label, description", () => {
    for (const key of Object.keys(VINTAGE_PRESETS) as VintagePreset[]) {
      const p = VINTAGE_PRESETS[key];
      expect(p).toHaveProperty("matrix");
      expect(p).toHaveProperty("label");
      expect(p).toHaveProperty("description");
    }
  });
  it("warm preset has different matrix than classic", () => {
    expect(VINTAGE_PRESETS.warm.matrix.rr).not.toBe(VINTAGE_PRESETS.classic.matrix.rr);
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
    const r = batchValidate([{ name: "a.png" }, { name: "b.png" }], { strength: 0.5 });
    expect(r).toHaveLength(2);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("propagates errors", () => {
    const r = batchValidate([{ name: "a.png" }], { strength: 2 });
    expect(r[0]!.result).toHaveProperty("error");
  });
});

describe("presetList", () => {
  it("returns at least 5 presets", () => {
    expect(presetList().length).toBeGreaterThanOrEqual(5);
  });
  it("includes classic", () => {
    expect(presetList().some((p) => p.id === "classic")).toBe(true);
  });
});
