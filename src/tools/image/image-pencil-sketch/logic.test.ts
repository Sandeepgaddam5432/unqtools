import { describe, it, expect } from "vitest";
import {
  validateSketch,
  luma,
  toGray,
  boxBlurGray,
  dodgeBlend,
  applyDarkness,
  applyPaperTexture,
  applyTint,
  sketchPixel,
  sketchDelta,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("luma + toGray + boxBlurGray", () => {
  it("luma of black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("luma of white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
  it("toGray returns array of length w*h", () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]);
    expect(toGray(px, 2, 1).length).toBe(2);
  });
  it("boxBlurGray is identity for radius 0", () => {
    const out = boxBlurGray([10, 20, 30], 3, 1, 0);
    expect(out).toEqual([10, 20, 30]);
  });
  it("boxBlurGray averages for radius 1", () => {
    const out = boxBlurGray([0, 100, 0], 3, 1, 1);
    // Pixel 0: avg(0, 100, 0) = 33.33
    expect(out[0]).toBeCloseTo(33.33, 0);
  });
});

describe("dodgeBlend", () => {
  it("returns 255 when blurred is 0 (top is fully white)", () => {
    expect(dodgeBlend(100, 0, 1)).toBe(255);
  });
  it("returns base when intensity 0", () => {
    expect(dodgeBlend(100, 50, 0)).toBe(100);
  });
  it("blends when intensity > 0", () => {
    const v = dodgeBlend(100, 50, 1);
    expect(v).toBeGreaterThanOrEqual(100);
  });
});

describe("applyDarkness", () => {
  it("is identity at darkness 0", () => {
    expect(applyDarkness(128, 0)).toBe(128);
  });
  it("darkens midtones at darkness 1", () => {
    expect(applyDarkness(128, 1)).toBeLessThan(128);
  });
  it("preserves white at darkness 1", () => {
    expect(applyDarkness(255, 1)).toBe(255);
  });
  it("preserves black at darkness 1", () => {
    expect(applyDarkness(0, 1)).toBe(0);
  });
});

describe("applyPaperTexture + applyTint", () => {
  it("applyPaperTexture is identity at 0 amount", () => {
    expect(applyPaperTexture(128, 0.5, 0)).toBe(128);
  });
  it("applyPaperTexture can shift value", () => {
    const v = applyPaperTexture(128, 0.1, 1);
    expect(v).not.toBe(128);
  });
  it("applyTint scales tint by gray", () => {
    expect(applyTint(255, [100, 50, 25])).toEqual([100, 50, 25]);
  });
  it("applyTint at gray 0 returns black", () => {
    expect(applyTint(0, [100, 50, 25])).toEqual([0, 0, 0]);
  });
});

describe("sketchPixel", () => {
  it("returns object with r, g, b", () => {
    const out = sketchPixel(100, 50, DEFAULT_OPTIONS, 0.5);
    expect(out).toHaveProperty("r");
    expect(out).toHaveProperty("g");
    expect(out).toHaveProperty("b");
  });
  it("graphite produces grayscale", () => {
    const out = sketchPixel(100, 50, { ...DEFAULT_OPTIONS, mode: "graphite" }, 0.5);
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
  });
  it("colored produces color tint", () => {
    const out = sketchPixel(100, 50, { ...DEFAULT_OPTIONS, mode: "colored", tint: [200, 100, 50] }, 0.5);
    expect(out.r).not.toBe(out.b);
  });
});

describe("sketchDelta", () => {
  it("returns 0 for identical data", () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    expect(sketchDelta(data, data)).toBe(0);
  });
  it("returns positive for different data", () => {
    const a = new Uint8ClampedArray([100, 100, 100, 255]);
    const b = new Uint8ClampedArray([200, 200, 200, 255]);
    expect(sketchDelta(a, b)).toBeGreaterThan(0);
  });
});

describe("validateSketch", () => {
  it("returns options for valid input", () => {
    expect("error" in validateSketch(DEFAULT_OPTIONS)).toBe(false);
  });
  it("rejects bad intensity", () => {
    expect("error" in validateSketch({ ...DEFAULT_OPTIONS, intensity: 2 })).toBe(true);
  });
  it("rejects bad radius", () => {
    expect("error" in validateSketch({ ...DEFAULT_OPTIONS, radius: 100 })).toBe(true);
  });
  it("rejects bad darkness", () => {
    expect("error" in validateSketch({ ...DEFAULT_OPTIONS, darkness: -1 })).toBe(true);
  });
  it("rejects bad paper texture", () => {
    expect("error" in validateSketch({ ...DEFAULT_OPTIONS, paperTexture: 2 })).toBe(true);
  });
  it("rejects bad tint", () => {
    expect("error" in validateSketch({ ...DEFAULT_OPTIONS, tint: [300, 0, 0] })).toBe(true);
  });
  it("rounds radius", () => {
    const r = validateSketch({ ...DEFAULT_OPTIONS, radius: 5.7 });
    if (!("error" in r)) expect(r.radius).toBe(6);
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when all zero", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, intensity: 0, darkness: 0, paperTexture: 0 })).toBe(true);
  });
  it("isIdentity false for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments and decrements", () => {
    expect(nudgeValue(10, "arrowup", false)).toBe(11);
    expect(nudgeValue(10, "arrowdown", true)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("charcoal")?.options.mode).toBe("charcoal");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
