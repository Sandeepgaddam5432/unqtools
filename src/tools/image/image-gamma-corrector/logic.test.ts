import { describe, it, expect } from "vitest";
import {
  applyGammaChannel,
  applyGamma,
  applyGammaPerPixel,
  buildGammaLut,
  gammaCurve,
  srgbToLinear,
  linearToSrgb,
  bt709ToLinear,
  bt2020ToLinear,
  meanLuma,
  autoGamma,
  gammaDelta,
  validateGammaOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("applyGammaChannel", () => {
  it("gamma 1 is identity", () => {
    expect(applyGammaChannel(128, 1)).toBe(128);
    expect(applyGammaChannel(0, 1)).toBe(0);
    expect(applyGammaChannel(255, 1)).toBe(255);
  });
  it("gamma 2 brightens midtones", () => {
    expect(applyGammaChannel(64, 2)).toBeGreaterThan(64);
  });
  it("gamma 0.5 darkens midtones", () => {
    expect(applyGammaChannel(192, 0.5)).toBeLessThan(192);
  });
  it("clamps 0 and 255 inputs", () => {
    expect(applyGammaChannel(0, 2.2)).toBe(0);
    expect(applyGammaChannel(255, 2.2)).toBe(255);
  });
});

describe("buildGammaLut", () => {
  it("has 256 entries", () => {
    expect(buildGammaLut(2.2).length).toBe(256);
  });
  it("LUT matches applyGammaChannel", () => {
    const lut = buildGammaLut(2.2);
    for (const v of [0, 64, 128, 192, 255]) {
      expect(lut[v]).toBe(applyGammaChannel(v, 2.2));
    }
  });
});

describe("applyGamma", () => {
  it("applies same gamma to all channels", () => {
    const out = applyGamma({ r: 100, g: 100, b: 100 }, 1);
    expect(out).toEqual({ r: 100, g: 100, b: 100 });
  });
  it("changes value when gamma != 1", () => {
    const out = applyGamma({ r: 100, g: 100, b: 100 }, 2);
    expect(out.r).not.toBe(100);
  });
});

describe("applyGammaPerPixel", () => {
  it("preserves alpha", () => {
    const out = applyGammaPerPixel({ r: 100, g: 100, b: 100, a: 128 }, DEFAULT_OPTIONS);
    expect(out.a).toBe(128);
  });
  it("applies per-channel gamma differently", () => {
    const out = applyGammaPerPixel(
      { r: 100, g: 100, b: 100, a: 255 },
      { gamma: 1, channels: { r: 2, g: 1, b: 0.5 } },
    );
    expect(out.r).toBeGreaterThan(out.g);
    expect(out.g).toBeGreaterThan(out.b);
  });
});

describe("gammaCurve", () => {
  it("returns N samples", () => {
    expect(gammaCurve(2.2, 100).length).toBe(100);
  });
  it("starts at (0,0)", () => {
    const pts = gammaCurve(2.2);
    expect(pts[0]!.x).toBe(0);
    expect(pts[0]!.y).toBe(0);
  });
  it("ends at (1,1)", () => {
    const pts = gammaCurve(2.2);
    expect(pts[pts.length - 1]!.x).toBe(1);
    expect(pts[pts.length - 1]!.y).toBe(1);
  });
});

describe("sRGB / BT.709 / BT.2020 conversions", () => {
  it("srgbToLinear(0) = 0", () => expect(srgbToLinear(0)).toBe(0));
  it("srgbToLinear(255) ~ 1", () => expect(srgbToLinear(255)).toBeCloseTo(1, 2));
  it("linearToSrgb(0) = 0", () => expect(linearToSrgb(0)).toBe(0));
  it("linearToSrgb(1) ~ 255", () => expect(linearToSrgb(1)).toBe(255));
  it("bt709ToLinear(0) = 0", () => expect(bt709ToLinear(0)).toBe(0));
  it("bt709ToLinear(255) ~ 1", () => expect(bt709ToLinear(255)).toBeCloseTo(1, 2));
  it("bt2020ToLinear(0) = 0", () => expect(bt2020ToLinear(0)).toBe(0));
  it("bt2020ToLinear(255) ~ 1", () => expect(bt2020ToLinear(255)).toBeCloseTo(1, 2));
});

describe("meanLuma + autoGamma", () => {
  it("meanLuma computes weighted mean", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(meanLuma(data)).toBeCloseTo(255, 0);
  });
  it("autoGamma returns 1 for already-neutral image", () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255]);
    expect(autoGamma(data, 128)).toBeCloseTo(1, 1);
  });
  it("autoGamma returns > 1 for dark image (brighten to target)", () => {
    const data = new Uint8ClampedArray([32, 32, 32, 255]);
    expect(autoGamma(data, 128)).toBeGreaterThan(1);
  });
  it("autoGamma returns < 1 for bright image (darken to target)", () => {
    const data = new Uint8ClampedArray([220, 220, 220, 255]);
    expect(autoGamma(data, 128)).toBeLessThan(1);
  });
});

describe("gammaDelta", () => {
  it("returns 0 for identity options", () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255]);
    expect(gammaDelta(data, DEFAULT_OPTIONS)).toBe(0);
  });
  it("returns positive for non-identity", () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255]);
    expect(gammaDelta(data, { ...DEFAULT_OPTIONS, gamma: 2 })).toBeGreaterThan(0);
  });
});

describe("validateGammaOptions", () => {
  it("accepts valid gamma", () => {
    expect(validateGammaOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects gamma out of range", () => {
    expect(validateGammaOptions({ ...DEFAULT_OPTIONS, gamma: 0.01 })).toHaveProperty("error");
    expect(validateGammaOptions({ ...DEFAULT_OPTIONS, gamma: 100 })).toHaveProperty("error");
  });
  it("rejects NaN", () => {
    expect(validateGammaOptions({ ...DEFAULT_OPTIONS, gamma: Number.NaN })).toHaveProperty("error");
  });
  it("rejects bad channel gamma", () => {
    expect(validateGammaOptions({ ...DEFAULT_OPTIONS, channels: { r: 0.01, g: 1, b: 1 } })).toHaveProperty("error");
  });
});

describe("isIdentity + batch + format + nudge + presets", () => {
  it("isIdentity true for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(true);
  });
  it("isIdentity false for non-default", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, gamma: 2 })).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments by 0.05", () => {
    expect(nudgeValue(1, "arrowup", false)).toBeCloseTo(1.05);
  });
  it("nudgeValue increments by 1 with shift", () => {
    expect(nudgeValue(1, "arrowup", true)).toBe(2);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("srgb")?.options.gamma).toBe(2.2);
  });
  it("has at least 8 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(8);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
    expect(clampByte(127.6)).toBe(128);
  });
});
