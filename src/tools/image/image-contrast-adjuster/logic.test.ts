/**
 * Image Contrast Adjuster — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  contrastFactor,
  sigmoidal,
  applyContrast,
  applyLevels,
  applyAll,
  validateContrastOptions,
  computeHistogram,
  autoContrast,
  stretchPercentage,
  countClipped,
  preservesAlpha,
  isIdentity,
  batchValidate,
  nudgeValue,
  DEFAULT_OPTIONS,
  type ContrastOptions,
} from "./logic";

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

describe("sigmoidal", () => {
  it("returns input unchanged at strength 0", () => {
    expect(sigmoidal(128, 0)).toBe(128);
  });
  it("preserves 0 and 255 at any strength", () => {
    expect(sigmoidal(0, 50)).toBe(0);
    expect(sigmoidal(255, 50)).toBe(255);
  });
  it("pulls mid-tones away from 128 at positive strength", () => {
    const up = sigmoidal(180, 50);
    const down = sigmoidal(80, 50);
    expect(up).toBeGreaterThan(180);
    expect(down).toBeLessThan(80);
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

describe("applyLevels", () => {
  it("identity at black=0, white=255", () => {
    expect(applyLevels(128, 0, 255)).toBe(128);
  });
  it("stretches when black/white tightened", () => {
    expect(applyLevels(125, 50, 200)).toBe(128);
  });
  it("clamps below black to 0", () => {
    expect(applyLevels(10, 50, 200)).toBe(0);
  });
  it("clamps above white to 255", () => {
    expect(applyLevels(250, 50, 200)).toBe(255);
  });
});

describe("applyAll", () => {
  it("returns identity at defaults", () => {
    const out = applyAll({ r: 100, g: 50, b: 25, a: 255 }, DEFAULT_OPTIONS);
    expect(out.r).toBe(100);
    expect(out.g).toBe(50);
    expect(out.b).toBe(25);
    expect(out.a).toBe(255);
  });
  it("applies contrast", () => {
    const out = applyAll({ r: 200, g: 100, b: 50, a: 255 }, { ...DEFAULT_OPTIONS, value: 50 });
    expect(out.r).toBeGreaterThan(200);
    expect(out.g).toBeLessThan(100);
  });
  it("applies levels", () => {
    const out = applyAll({ r: 100, g: 100, b: 100, a: 255 }, { ...DEFAULT_OPTIONS, blackPoint: 50, whitePoint: 200 });
    // (100-50)/(200-50)*255 = 85
    expect(out.r).toBe(85);
  });
  it("preserves alpha", () => {
    const out = applyAll({ r: 100, g: 100, b: 100, a: 128 }, { ...DEFAULT_OPTIONS, value: 50 });
    expect(out.a).toBe(128);
  });
});

describe("validateContrastOptions", () => {
  it("accepts valid range", () => {
    expect(validateContrastOptions({ value: 0 } as ContrastOptions)).toEqual({ ok: true });
    expect(validateContrastOptions({ value: 100 } as ContrastOptions)).toEqual({ ok: true });
    expect(validateContrastOptions({ value: -100 } as ContrastOptions)).toEqual({ ok: true });
  });
  it("rejects out-of-range value", () => {
    expect(validateContrastOptions({ value: 200 } as ContrastOptions)).toHaveProperty("error");
  });
  it("rejects NaN", () => {
    expect(validateContrastOptions({ value: Number.NaN } as ContrastOptions)).toHaveProperty("error");
  });
  it("rejects whitePoint <= blackPoint", () => {
    expect(validateContrastOptions({ ...DEFAULT_OPTIONS, blackPoint: 100, whitePoint: 100 })).toHaveProperty("error");
  });
  it("rejects sigmoid > 100", () => {
    expect(validateContrastOptions({ ...DEFAULT_OPTIONS, sigmoid: 200 })).toHaveProperty("error");
  });
});

describe("computeHistogram", () => {
  it("returns 256-bin arrays", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
    const h = computeHistogram(data);
    expect(h.r.length).toBe(256);
    expect(h.g.length).toBe(256);
    expect(h.b.length).toBe(256);
  });
  it("counts red pixels", () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]);
    const h = computeHistogram(data);
    expect(h.r[255]).toBe(2);
  });
});

describe("autoContrast", () => {
  it("returns blackPoint <= whitePoint", () => {
    const histogram = {
      r: new Array(256).fill(0),
      g: new Array(256).fill(0),
      b: new Array(256).fill(0),
    };
    histogram.r[10] = 100;
    histogram.r[200] = 100;
    const r = autoContrast(histogram);
    expect(r.blackPoint).toBeLessThanOrEqual(r.whitePoint);
  });
  it("clamps white above black", () => {
    const histogram = {
      r: new Array(256).fill(0),
      g: new Array(256).fill(0),
      b: new Array(256).fill(0),
    };
    histogram.r[100] = 100;
    const r = autoContrast(histogram);
    expect(r.whitePoint).toBeGreaterThan(r.blackPoint);
  });
});

describe("stretchPercentage", () => {
  it("returns 0 for default range", () => {
    expect(stretchPercentage(0, 255)).toBeCloseTo(0, 5);
  });
  it("returns positive for tightened range", () => {
    expect(stretchPercentage(50, 200)).toBeGreaterThan(0);
  });
  it("returns 0 when white <= black", () => {
    expect(stretchPercentage(100, 100)).toBe(0);
  });
});

describe("countClipped", () => {
  it("counts under-exposed pixels", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255]);
    const r = countClipped(data);
    expect(r.under).toBe(1);
    expect(r.total).toBe(2);
  });
  it("counts over-exposed pixels", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 100, 100, 100, 255]);
    const r = countClipped(data);
    expect(r.over).toBe(1);
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
  it("returns true for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(true);
  });
  it("returns false when value != 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, value: 10 })).toBe(false);
  });
});

describe("batchValidate", () => {
  it("validates each file's options", () => {
    const r = batchValidate([{ name: "a.png" }, { name: "b.png" }], DEFAULT_OPTIONS);
    expect(r).toHaveLength(2);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("propagates errors", () => {
    const r = batchValidate([{ name: "a.png" }], { ...DEFAULT_OPTIONS, value: 500 });
    expect(r[0]!.result).toHaveProperty("error");
  });
});

describe("nudgeValue", () => {
  it("increments by 1 on arrowup", () => {
    expect(nudgeValue(50, "arrowup", false)).toBe(51);
  });
  it("decrements by 1 on arrowdown", () => {
    expect(nudgeValue(50, "arrowdown", false)).toBe(49);
  });
  it("increments by 10 with Shift on arrowup", () => {
    expect(nudgeValue(50, "arrowup", true)).toBe(60);
  });
  it("returns unchanged for other keys", () => {
    expect(nudgeValue(50, "enter", false)).toBe(50);
  });
});
