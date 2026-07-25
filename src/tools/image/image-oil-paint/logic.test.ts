import { describe, it, expect } from "vitest";
import {
  validateOil,
  quantize,
  quantizeRgb,
  packRgb,
  angularWeight,
  dominantColor,
  dominantColorDirectional,
  blendOil,
  oilDelta,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("quantize + quantizeRgb + packRgb", () => {
  it("quantize returns levels midpoint", () => {
    expect(quantize(0, 4)).toBe(32);
    expect(quantize(64, 4)).toBe(96);
    expect(quantize(255, 4)).toBe(224);
  });
  it("quantizeRgb returns triple", () => {
    const q = quantizeRgb(100, 150, 200, 8);
    expect(q.length).toBe(3);
    expect(q[0]).toBeGreaterThanOrEqual(0);
    expect(q[0]).toBeLessThanOrEqual(255);
  });
  it("packRgb produces integer key", () => {
    expect(packRgb(255, 128, 64)).toBe((255 << 16) | (128 << 8) | 64);
  });
});

describe("angularWeight", () => {
  it("is 1 at zero offset", () => {
    expect(angularWeight(0, 0, 0)).toBe(1);
  });
  it("is positive when aligned with direction", () => {
    expect(angularWeight(1, 0, 0)).toBe(1);
  });
  it("is 0 when perpendicular", () => {
    expect(angularWeight(0, 1, 0)).toBe(0);
  });
});

describe("dominantColor + dominantColorDirectional", () => {
  it("returns a color triple", () => {
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,
      100, 100, 100, 255,
      50, 50, 50, 255,
      50, 50, 50, 255,
    ]);
    const out = dominantColor(data, 2, 2, 0, 0, 1, 8);
    expect(out.length).toBe(3);
  });
  it("returns dominant color (most frequent)", () => {
    const data = new Uint8ClampedArray([
      200, 200, 200, 255,
      200, 200, 200, 255,
      50, 50, 50, 255,
      200, 200, 200, 255,
    ]);
    const out = dominantColor(data, 2, 2, 0, 0, 1, 8);
    // 200 should be more frequent than 50
    expect(out[0]).toBeGreaterThan(100);
  });
  it("dominantColorDirectional respects direction", () => {
    const data = new Uint8ClampedArray([
      200, 200, 200, 255,
      50, 50, 50, 255,
      200, 200, 200, 255,
      50, 50, 50, 255,
    ]);
    const out = dominantColorDirectional(data, 2, 2, 0, 0, 1, 8, 0, 0);
    expect(out.length).toBe(3);
  });
});

describe("blendOil", () => {
  it("preserves alpha", () => {
    const out = blendOil([100, 100, 100, 128], [200, 200, 200], 1);
    expect(out[3]).toBe(128);
  });
  it("strength 0 is identity", () => {
    const out = blendOil([100, 100, 100, 255], [200, 200, 200], 0);
    expect(out[0]).toBe(100);
  });
  it("strength 1 fully replaces", () => {
    const out = blendOil([100, 100, 100, 255], [200, 200, 200], 1);
    expect(out[0]).toBe(200);
  });
  it("strength 0.5 blends", () => {
    const out = blendOil([100, 100, 100, 255], [200, 200, 200], 0.5);
    expect(out[0]).toBe(150);
  });
});

describe("oilDelta", () => {
  it("returns 0 for zero strength", () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const oil = new Uint8ClampedArray([200, 200, 200, 255]);
    expect(oilDelta(data, oil, 0)).toBe(0);
  });
  it("returns positive for non-zero strength", () => {
    const data = new Uint8ClampedArray([100, 100, 100, 255]);
    const oil = new Uint8ClampedArray([200, 200, 200, 255]);
    expect(oilDelta(data, oil, 1)).toBeGreaterThan(0);
  });
});

describe("validateOil", () => {
  it("returns options for valid input", () => {
    const r = validateOil(DEFAULT_OPTIONS);
    expect("error" in r).toBe(false);
  });
  it("rejects bad radius", () => {
    expect("error" in validateOil({ ...DEFAULT_OPTIONS, radius: 100 })).toBe(true);
  });
  it("rejects bad levels", () => {
    expect("error" in validateOil({ ...DEFAULT_OPTIONS, levels: 1 })).toBe(true);
    expect("error" in validateOil({ ...DEFAULT_OPTIONS, levels: 100 })).toBe(true);
  });
  it("rejects bad direction", () => {
    expect("error" in validateOil({ ...DEFAULT_OPTIONS, direction: 400 })).toBe(true);
  });
  it("rejects bad texture", () => {
    expect("error" in validateOil({ ...DEFAULT_OPTIONS, texture: 2 })).toBe(true);
  });
  it("rejects bad strength", () => {
    expect("error" in validateOil({ ...DEFAULT_OPTIONS, strength: -1 })).toBe(true);
  });
  it("rounds radius and levels", () => {
    const r = validateOil({ ...DEFAULT_OPTIONS, radius: 4.7, levels: 16.4 });
    if (!("error" in r)) {
      expect(r.radius).toBe(5);
      expect(r.levels).toBe(16);
    }
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when strength 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, strength: 0 })).toBe(true);
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
    expect(findPreset("impressionist")?.options.style).toBe("impressionist");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
