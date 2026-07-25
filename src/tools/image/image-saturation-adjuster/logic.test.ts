import { describe, it, expect } from "vitest";
import {
  saturationFactor,
  luma,
  rgbToHsl,
  hslToRgb,
  isSkinTone,
  findHueBand,
  applySaturation,
  applyVibrance,
  applySplash,
  applyReplace,
  applyAll,
  validateSaturationOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  DEFAULT_BANDS,
  clampByte,
} from "./logic";

describe("luma + saturationFactor", () => {
  it("luma of black is 0", () => expect(luma({ r: 0, g: 0, b: 0 })).toBe(0));
  it("luma of white is 255", () => expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0));
  it("saturationFactor 0 = 1", () => expect(saturationFactor(0)).toBe(1));
  it("saturationFactor -100 = 0", () => expect(saturationFactor(-100)).toBe(0));
  it("saturationFactor +100 = 2", () => expect(saturationFactor(100)).toBe(2));
  it("saturationFactor clamps out-of-range", () => expect(saturationFactor(200)).toBe(2));
});

describe("rgbToHsl + hslToRgb", () => {
  it("black converts to hsl(0,0,0)", () => {
    expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
  });
  it("white converts to hsl(0,0,1)", () => {
    expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 1 });
  });
  it("red has hue 0", () => {
    const { h, s } = rgbToHsl(255, 0, 0);
    expect(h).toBe(0);
    expect(s).toBe(1);
  });
  it("green has hue 120", () => {
    const { h } = rgbToHsl(0, 255, 0);
    expect(h).toBeCloseTo(120, 0);
  });
  it("blue has hue 240", () => {
    const { h } = rgbToHsl(0, 0, 255);
    expect(h).toBeCloseTo(240, 0);
  });
  it("hslToRgb inverts rgbToHsl", () => {
    const orig = { r: 100, g: 150, b: 200 };
    const { h, s, l } = rgbToHsl(orig.r, orig.g, orig.b);
    const back = hslToRgb(h, s, l);
    expect(back.r).toBe(orig.r);
    expect(back.g).toBe(orig.g);
    expect(back.b).toBe(orig.b);
  });
});

describe("isSkinTone + findHueBand", () => {
  it("detects skin tone (warm orange)", () => {
    expect(isSkinTone({ r: 220, g: 170, b: 130, a: 255 })).toBe(true);
  });
  it("rejects pure blue as skin tone", () => {
    expect(isSkinTone({ r: 0, g: 0, b: 255, a: 255 })).toBe(false);
  });
  it("findHueBand returns matching band", () => {
    const band = findHueBand(50, DEFAULT_BANDS);
    expect(band?.low).toBe(45);
  });
  it("findHueBand wraps 360 to 0", () => {
    const band = findHueBand(360, DEFAULT_BANDS);
    expect(band?.low).toBe(0);
  });
});

describe("applySaturation", () => {
  it("value 0 is identity", () => {
    const out = applySaturation({ r: 100, g: 50, b: 200, a: 255 }, 0);
    expect(out).toEqual({ r: 100, g: 50, b: 200, a: 255 });
  });
  it("value -100 produces grayscale", () => {
    const out = applySaturation({ r: 100, g: 50, b: 200, a: 255 }, -100);
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
  });
  it("value +100 doubles saturation", () => {
    const out = applySaturation({ r: 100, g: 50, b: 200, a: 255 }, 100);
    // Distance from luma should be larger
    const y = luma({ r: 100, g: 50, b: 200 });
    const dist0 = Math.abs(100 - y);
    const dist1 = Math.abs(out.r - y);
    expect(dist1).toBeGreaterThan(dist0);
  });
  it("preserves alpha", () => {
    expect(applySaturation({ r: 100, g: 50, b: 200, a: 64 }, 50).a).toBe(64);
  });
});

describe("applyVibrance", () => {
  it("preserves grayscale pixels", () => {
    const out = applyVibrance({ r: 100, g: 100, b: 100, a: 255 }, 50);
    expect(out).toEqual({ r: 100, g: 100, b: 100, a: 255 });
  });
  it("changes saturated pixels", () => {
    const out = applyVibrance({ r: 255, g: 0, b: 0, a: 255 }, 50);
    expect(out.r).toBeGreaterThan(0);
  });
});

describe("applySplash + applyReplace", () => {
  it("splash keeps target-hue pixels", () => {
    const out = applySplash({ r: 255, g: 0, b: 0, a: 255 }, 0, 20);
    expect(out).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });
  it("splash desaturates non-target pixels", () => {
    const out = applySplash({ r: 0, g: 0, b: 255, a: 255 }, 0, 20);
    expect(out.r).toBe(out.g);
  });
  it("replace shifts matching hue", () => {
    const out = applyReplace({ r: 255, g: 0, b: 0, a: 255 }, 0, 20, 240);
    // After replace, hue should be near 240 (blue), so blue channel should be high
    expect(out.b).toBeGreaterThan(out.r);
  });
  it("replace leaves non-matching pixels unchanged", () => {
    const out = applyReplace({ r: 0, g: 255, b: 0, a: 255 }, 0, 20, 240);
    expect(out).toEqual({ r: 0, g: 255, b: 0, a: 255 });
  });
});

describe("applyAll + presets", () => {
  it("identity options produce identity output", () => {
    const out = applyAll({ r: 100, g: 50, b: 200, a: 255 }, DEFAULT_OPTIONS);
    expect(out.r).toBe(100);
  });
  it("vibrance mode boosts color", () => {
    const opts = { ...DEFAULT_OPTIONS, mode: "vibrance" as const, vibrance: 50 };
    const out = applyAll({ r: 255, g: 50, b: 50, a: 255 }, opts);
    expect(out.r).toBeGreaterThan(0);
  });
  it("findPreset returns matching preset", () => {
    expect(findPreset("vivid")?.options.value).toBe(50);
  });
  it("has at least 7 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(7);
  });
});

describe("validateSaturationOptions", () => {
  it("accepts valid options", () => {
    expect(validateSaturationOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects out-of-range value", () => {
    expect(validateSaturationOptions({ ...DEFAULT_OPTIONS, value: 200 })).toHaveProperty("error");
  });
  it("rejects out-of-range vibrance", () => {
    expect(validateSaturationOptions({ ...DEFAULT_OPTIONS, vibrance: 200 })).toHaveProperty("error");
  });
  it("rejects bad target hue", () => {
    expect(validateSaturationOptions({ ...DEFAULT_OPTIONS, targetHue: 400 })).toHaveProperty("error");
  });
  it("rejects bad hue tolerance", () => {
    expect(validateSaturationOptions({ ...DEFAULT_OPTIONS, hueTolerance: 200 })).toHaveProperty("error");
  });
});

describe("isIdentity + batch + format + nudge + clampByte", () => {
  it("isIdentity true for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(true);
  });
  it("isIdentity false for non-default", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, value: 50 })).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments and decrements", () => {
    expect(nudgeValue(10, "arrowup", false)).toBe(11);
    expect(nudgeValue(10, "arrowdown", true)).toBe(0);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
    expect(clampByte(127.6)).toBe(128);
  });
});
