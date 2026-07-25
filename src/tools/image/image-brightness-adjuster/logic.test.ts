/**
 * Image Brightness Adjuster — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  brightnessDelta,
  exposureFactor,
  contrastFactor,
  highlightsFactor,
  shadowsFactor,
  applyLevels,
  applyBrightness,
  applyAll,
  validateBrightnessOptions,
  computeHistogram,
  autoLevels,
  countClipped,
  toneCurve,
  buildToneLUT,
  applyLUT,
  preservesAlpha,
  isIdentity,
  batchValidate,
  nudgeValue,
  DEFAULT_OPTIONS,
  type BrightnessOptions,
} from "./logic";

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

describe("exposureFactor", () => {
  it("returns 1 at 0", () => {
    expect(exposureFactor(0)).toBeCloseTo(1, 5);
  });
  it("doubles at +50 (1 stop)", () => {
    expect(exposureFactor(50)).toBeCloseTo(2, 5);
  });
  it("halves at -50 (1 stop)", () => {
    expect(exposureFactor(-50)).toBeCloseTo(0.5, 5);
  });
});

describe("contrastFactor", () => {
  it("returns 1 at 0", () => {
    expect(contrastFactor(0)).toBeCloseTo(1, 5);
  });
  it("is > 1 for positive contrast", () => {
    expect(contrastFactor(50)).toBeGreaterThan(1);
  });
  it("is < 1 for negative contrast", () => {
    expect(contrastFactor(-50)).toBeLessThan(1);
  });
});

describe("highlightsFactor / shadowsFactor", () => {
  it("highlights leaves low pixels alone", () => {
    expect(highlightsFactor(50, -50)).toBe(50);
  });
  it("highlights reduces bright pixels for negative value", () => {
    const out = highlightsFactor(250, -50);
    expect(out).toBeLessThan(250);
  });
  it("shadows leaves high pixels alone", () => {
    expect(shadowsFactor(200, 50)).toBe(200);
  });
  it("shadows lifts dark pixels for positive value", () => {
    const out = shadowsFactor(20, 50);
    expect(out).toBeGreaterThan(20);
  });
});

describe("applyLevels", () => {
  it("identity when black=0, white=255", () => {
    expect(applyLevels(128, 0, 255)).toBe(128);
  });
  it("stretches when black=50, white=200", () => {
    // pixel 125 → (125-50)/(200-50) * 255 = 127.5 → 128
    expect(applyLevels(125, 50, 200)).toBe(128);
  });
  it("clamps below black to 0", () => {
    expect(applyLevels(10, 50, 200)).toBe(0);
  });
  it("clamps above white to 255", () => {
    expect(applyLevels(250, 50, 200)).toBe(255);
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
  it("preserves alpha", () => {
    expect(applyBrightness({ r: 100, g: 100, b: 100, a: 128 }, 50).a).toBe(128);
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
  it("applies brightness", () => {
    const out = applyAll({ r: 100, g: 100, b: 100, a: 255 }, { ...DEFAULT_OPTIONS, brightness: 50 });
    expect(out.r).toBeGreaterThan(100);
  });
  it("applies contrast", () => {
    const out = applyAll({ r: 200, g: 100, b: 50, a: 255 }, { ...DEFAULT_OPTIONS, contrast: 50 });
    expect(out.r).toBeGreaterThan(200);
    expect(out.g).toBeLessThan(100);
  });
  it("preserves alpha", () => {
    const out = applyAll({ r: 100, g: 100, b: 100, a: 128 }, { ...DEFAULT_OPTIONS, brightness: 50 });
    expect(out.a).toBe(128);
  });
});

describe("validateBrightnessOptions", () => {
  it("accepts defaults", () => {
    expect(validateBrightnessOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("accepts boundaries", () => {
    expect(validateBrightnessOptions({ ...DEFAULT_OPTIONS, brightness: 100 })).toEqual({ ok: true });
    expect(validateBrightnessOptions({ ...DEFAULT_OPTIONS, brightness: -100 })).toEqual({ ok: true });
  });
  it("rejects out-of-range brightness", () => {
    expect(validateBrightnessOptions({ ...DEFAULT_OPTIONS, brightness: 200 })).toHaveProperty("error");
  });
  it("rejects NaN brightness", () => {
    expect(validateBrightnessOptions({ ...DEFAULT_OPTIONS, brightness: Number.NaN })).toHaveProperty("error");
  });
  it("rejects whitePoint <= blackPoint", () => {
    expect(validateBrightnessOptions({ ...DEFAULT_OPTIONS, blackPoint: 100, whitePoint: 100 })).toHaveProperty("error");
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
    expect(h.g[0]).toBe(2);
  });
});

describe("autoLevels", () => {
  it("returns blackPoint <= whitePoint", () => {
    const histogram = {
      r: new Array(256).fill(0),
      g: new Array(256).fill(0),
      b: new Array(256).fill(0),
    };
    histogram.r[10] = 100;
    histogram.r[200] = 100;
    const r = autoLevels(histogram);
    expect(r.blackPoint).toBeLessThanOrEqual(r.whitePoint);
  });
});

describe("countClipped", () => {
  it("counts under-exposed (black) pixels", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255]);
    const r = countClipped(data);
    expect(r.under).toBe(1);
    expect(r.total).toBe(2);
  });
  it("counts over-exposed (white) pixels", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 100, 100, 100, 255]);
    const r = countClipped(data);
    expect(r.over).toBe(1);
  });
});

describe("toneCurve", () => {
  it("returns p0 at t=0", () => {
    expect(toneCurve(0, 0, 0.3, 0.7, 1)).toBeCloseTo(0, 5);
  });
  it("returns p3 at t=1", () => {
    expect(toneCurve(1, 0, 0.3, 0.7, 1)).toBeCloseTo(1, 5);
  });
  it("identity curve passes through midpoint", () => {
    // p0=0, p1=1/3, p2=2/3, p3=1 is identity bezier
    expect(toneCurve(0.5, 0, 1 / 3, 2 / 3, 1)).toBeCloseTo(0.5, 2);
  });
});

describe("buildToneLUT", () => {
  it("returns 256 entries", () => {
    expect(buildToneLUT(0, 1 / 3, 2 / 3, 1).length).toBe(256);
  });
  it("identity LUT matches input", () => {
    const lut = buildToneLUT(0, 1 / 3, 2 / 3, 1);
    expect(lut[0]).toBe(0);
    expect(lut[255]).toBe(255);
    expect(lut[128]).toBeCloseTo(128, 0);
  });
});

describe("applyLUT", () => {
  it("maps pixel through LUT", () => {
    const lut = buildToneLUT(0, 1 / 3, 2 / 3, 1);
    const out = applyLUT({ r: 100, g: 50, b: 25, a: 255 }, lut);
    expect(out.r).toBeCloseTo(100, 0);
    expect(out.a).toBe(255);
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
  it("returns false when brightness != 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, brightness: 10 })).toBe(false);
  });
});

describe("batchValidate", () => {
  it("validates each file's options", () => {
    const r = batchValidate([{ name: "a.png" }, { name: "b.png" }], DEFAULT_OPTIONS);
    expect(r).toHaveLength(2);
    expect(r[0]!.result).toEqual({ ok: true });
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
