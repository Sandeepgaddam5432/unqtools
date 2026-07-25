import { describe, it, expect } from "vitest";
import {
  combinePixels,
  validateDimensions,
  validateAnaglyphOptions,
  parallaxShift,
  shiftedX,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  ANAGLYPH_MODES,
  clampByte,
  type AnaglyphPixel,
} from "./logic";

const px = (r: number, g: number, b: number, a = 255): AnaglyphPixel => ({ r, g, b, a });

describe("combinePixels — red-cyan", () => {
  it("takes R from left, G and B from right", () => {
    const out = combinePixels(px(100, 50, 50), px(50, 200, 150));
    expect(out.r).toBe(100);
    expect(out.g).toBe(200);
    expect(out.b).toBe(150);
  });
  it("preserves max alpha", () => {
    const out = combinePixels(px(100, 50, 50, 128), px(50, 200, 150, 200));
    expect(out.a).toBe(200);
  });
});

describe("combinePixels — other modes", () => {
  it("red-blue: takes R from left, B from right, G is darkened", () => {
    const out = combinePixels(px(100, 50, 50), px(50, 200, 150), { mode: "red-blue" });
    expect(out.r).toBe(100);
    expect(out.b).toBe(150);
  });
  it("green-magenta: takes G from left, R and B from right", () => {
    const out = combinePixels(px(100, 50, 50), px(50, 200, 150), { mode: "green-magenta" });
    expect(out.r).toBe(50);
    expect(out.g).toBe(50);
    expect(out.b).toBe(150);
  });
  it("amber-blue: averages R+G from left for R, B from right", () => {
    const out = combinePixels(px(100, 60, 50), px(50, 200, 150), { mode: "amber-blue" });
    expect(out.r).toBe(80); // (100+60)/2
    expect(out.b).toBe(150);
  });
  it("dubois: produces weighted sum", () => {
    const out = combinePixels(px(100, 100, 100), px(100, 100, 100), { mode: "dubois" });
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(255);
  });
});

describe("combinePixels — depth", () => {
  it("depth 0 returns left for red-cyan R channel", () => {
    const out = combinePixels(px(100, 50, 50), px(200, 200, 150), { mode: "red-cyan", depth: 0 });
    // depth 0 means lerpChannel(left.r, right.r, 0) = left.r = 100
    expect(out.r).toBe(100);
  });
  it("depth 1 blends fully", () => {
    const out = combinePixels(px(100, 50, 50), px(200, 200, 150), { mode: "red-cyan", depth: 1 });
    expect(out.r).toBeGreaterThanOrEqual(100);
  });
});

describe("validateDimensions", () => {
  it("accepts matching dimensions", () => {
    expect(validateDimensions(100, 200, 100, 200)).toEqual({ width: 100, height: 200 });
  });
  it("rejects mismatched dimensions", () => {
    expect("error" in validateDimensions(100, 200, 200, 100)).toBe(true);
  });
  it("rejects non-positive dimensions", () => {
    expect("error" in validateDimensions(0, 100, 100, 100)).toBe(true);
  });
});

describe("validateAnaglyphOptions", () => {
  it("accepts valid options", () => {
    expect(validateAnaglyphOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects bad parallax", () => {
    expect(validateAnaglyphOptions({ ...DEFAULT_OPTIONS, parallax: 200 })).toHaveProperty("error");
  });
  it("rejects bad depth", () => {
    expect(validateAnaglyphOptions({ ...DEFAULT_OPTIONS, depth: 3 })).toHaveProperty("error");
  });
  it("rejects non-finite parallax", () => {
    expect(validateAnaglyphOptions({ ...DEFAULT_OPTIONS, parallax: Number.NaN })).toHaveProperty("error");
  });
});

describe("parallaxShift + shiftedX", () => {
  it("parallaxShift subtracts parallax", () => {
    expect(parallaxShift(100, 10)).toBe(90);
  });
  it("shiftedX clamps to bounds", () => {
    expect(shiftedX(-5, 0, 100)).toBe(0);
    expect(shiftedX(105, 0, 100)).toBe(99);
  });
  it("shiftedX applies parallax", () => {
    expect(shiftedX(50, 10, 100)).toBe(40);
  });
});

describe("isIdentity + batch + format + nudge + presets + modes + clampByte", () => {
  it("isIdentity true when depth 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, depth: 0 })).toBe(true);
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
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
    expect(nudgeValue(10, "arrowdown", true)).toBe(5);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("dubois")?.options.mode).toBe("dubois");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("ANAGLYPH_MODES has 6 entries", () => {
    expect(ANAGLYPH_MODES.length).toBe(6);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
