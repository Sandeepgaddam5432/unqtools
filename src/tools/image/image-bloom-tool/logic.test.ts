import { describe, it, expect } from "vitest";
import {
  luma,
  passesThreshold,
  effectiveSigma,
  validateBloom,
  blendBloom,
  addBloom,
  bloomMask,
  bloomDelta,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("luma + passesThreshold", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
  it("passesThreshold true when luma >= threshold", () => {
    expect(passesThreshold(200, 200, 200, 128)).toBe(true);
  });
  it("passesThreshold false when luma < threshold", () => {
    expect(passesThreshold(50, 50, 50, 128)).toBe(false);
  });
});

describe("effectiveSigma", () => {
  it("returns 0 for radius 0", () => {
    expect(effectiveSigma(0)).toBe(0);
  });
  it("returns positive for radius > 0", () => {
    expect(effectiveSigma(10)).toBeGreaterThan(0);
  });
  it("increases with radius", () => {
    expect(effectiveSigma(20)).toBeGreaterThan(effectiveSigma(10));
  });
});

describe("validateBloom", () => {
  it("returns sanitized options for valid input", () => {
    const r = validateBloom(DEFAULT_OPTIONS);
    expect("error" in r).toBe(false);
  });
  it("rejects bad threshold", () => {
    expect("error" in validateBloom({ ...DEFAULT_OPTIONS, threshold: 300 })).toBe(true);
  });
  it("rejects bad intensity", () => {
    expect("error" in validateBloom({ ...DEFAULT_OPTIONS, intensity: 2 })).toBe(true);
  });
  it("rejects bad radius", () => {
    expect("error" in validateBloom({ ...DEFAULT_OPTIONS, radius: -1 })).toBe(true);
    expect("error" in validateBloom({ ...DEFAULT_OPTIONS, radius: 200 })).toBe(true);
  });
  it("rejects bad tone map", () => {
    expect("error" in validateBloom({ ...DEFAULT_OPTIONS, toneMap: 2 })).toBe(true);
  });
  it("rounds radius", () => {
    const r = validateBloom({ ...DEFAULT_OPTIONS, radius: 8.7 });
    expect("error" in r).toBe(false);
    if (!("error" in r)) expect(r.radius).toBe(9);
  });
});

describe("blendBloom — modes", () => {
  it("add mode adds bloom scaled by intensity", () => {
    const out = blendBloom([100, 100, 100, 255], [50, 50, 50], { ...DEFAULT_OPTIONS, intensity: 0.5, blendMode: "add" });
    expect(out[0]).toBe(125);
    expect(out[3]).toBe(255);
  });
  it("screen mode never reduces brightness", () => {
    const out = blendBloom([100, 100, 100, 255], [50, 50, 50], { ...DEFAULT_OPTIONS, intensity: 0.5, blendMode: "screen" });
    expect(out[0]).toBeGreaterThanOrEqual(100);
  });
  it("lighten mode picks the brighter", () => {
    const out = blendBloom([100, 100, 100, 255], [200, 200, 200], { ...DEFAULT_OPTIONS, intensity: 1, blendMode: "lighten" });
    expect(out[0]).toBe(200);
  });
  it("preserves alpha", () => {
    const out = blendBloom([100, 100, 100, 128], [50, 50, 50], { ...DEFAULT_OPTIONS, intensity: 1, blendMode: "add" });
    expect(out[3]).toBe(128);
  });
  it("intensity 0 is identity", () => {
    const out = blendBloom([100, 100, 100, 255], [50, 50, 50], { ...DEFAULT_OPTIONS, intensity: 0, blendMode: "add" });
    expect(out[0]).toBe(100);
  });
  it("tone map reduces extreme values", () => {
    const out = blendBloom([250, 250, 250, 255], [250, 250, 250], { ...DEFAULT_OPTIONS, intensity: 1, blendMode: "add", toneMap: 1 });
    expect(out[0]).toBeLessThanOrEqual(255);
  });
});

describe("addBloom (backward compat)", () => {
  it("adds bloom scaled by intensity", () => {
    const out = addBloom([100, 100, 100, 255], [50, 50, 50], 0.5);
    expect(out[0]).toBe(125);
  });
});

describe("bloomMask", () => {
  it("returns 0 for pixels below threshold", () => {
    expect(bloomMask(50, 50, 50, 200)).toBe(0);
  });
  it("returns luma for pixels above threshold", () => {
    expect(bloomMask(220, 220, 220, 200)).toBeGreaterThan(0);
  });
});

describe("bloomDelta", () => {
  it("returns 0 for zero intensity", () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const bloom = new Uint8ClampedArray([200, 200, 200, 255]);
    expect(bloomDelta(data, bloom, { ...DEFAULT_OPTIONS, intensity: 0 })).toBe(0);
  });
  it("returns positive for non-zero intensity", () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const bloom = new Uint8ClampedArray([200, 200, 200, 255]);
    expect(bloomDelta(data, bloom, { ...DEFAULT_OPTIONS, intensity: 1, blendMode: "add" })).toBeGreaterThan(0);
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when intensity 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, intensity: 0 })).toBe(true);
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
    expect(findPreset("neon")?.options.blendMode).toBe("add");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
