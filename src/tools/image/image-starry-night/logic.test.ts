import { describe, it, expect } from "vitest";
import {
  normalizedRadius,
  swirlMap,
  inBounds,
  applyColorShift,
  seededRandom,
  generateStars,
  applyStar,
  validateSwirlOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("normalizedRadius", () => {
  it("is 0 at center", () => {
    expect(normalizedRadius(50, 50, DEFAULT_OPTIONS, 100, 100)).toBe(0);
  });
  it("is positive away from center", () => {
    expect(normalizedRadius(80, 50, DEFAULT_OPTIONS, 100, 100)).toBeGreaterThan(0);
  });
  it("is symmetric for x and y", () => {
    const rx = normalizedRadius(70, 50, DEFAULT_OPTIONS, 100, 100);
    const ry = normalizedRadius(50, 30, DEFAULT_OPTIONS, 100, 100);
    expect(rx).toBeCloseTo(ry, 4);
  });
});

describe("swirlMap", () => {
  it("returns center point at center", () => {
    const p = swirlMap(50, 50, DEFAULT_OPTIONS, 100, 100);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });
  it("returns different point for non-zero angle within radius", () => {
    const opts = { ...DEFAULT_OPTIONS, radius: 1.0 };
    const p = swirlMap(70, 50, opts, 100, 100);
    expect(p.x).not.toBeCloseTo(70, 1);
  });
  it("is identity when angle is 0", () => {
    const opts = { ...DEFAULT_OPTIONS, angle: 0 };
    const p = swirlMap(80, 50, opts, 100, 100);
    expect(p.x).toBe(80);
    expect(p.y).toBe(50);
  });
});

describe("inBounds", () => {
  it("true for in-bounds point", () => {
    expect(inBounds({ x: 50, y: 50 }, 100, 100)).toBe(true);
  });
  it("false for negative", () => {
    expect(inBounds({ x: -1, y: 50 }, 100, 100)).toBe(false);
    expect(inBounds({ x: 50, y: -1 }, 100, 100)).toBe(false);
  });
  it("false for out-of-bounds", () => {
    expect(inBounds({ x: 100, y: 50 }, 100, 100)).toBe(false);
    expect(inBounds({ x: 50, y: 100 }, 100, 100)).toBe(false);
  });
});

describe("applyColorShift", () => {
  it("is identity for 0 shift", () => {
    const out = applyColorShift(100, 150, 200, 0);
    expect(out).toEqual([100, 150, 200]);
  });
  it("preserves grayscale", () => {
    const out = applyColorShift(128, 128, 128, 90);
    expect(out).toEqual([128, 128, 128]);
  });
  it("changes color for non-zero shift", () => {
    const out = applyColorShift(255, 0, 0, 120);
    // After 120° shift, red should become green-ish
    expect(out[1]).toBeGreaterThan(out[0]);
  });
});

describe("seededRandom + generateStars + applyStar", () => {
  it("seededRandom is deterministic", () => {
    const r1 = seededRandom(123)();
    const r2 = seededRandom(123)();
    expect(r1).toBe(r2);
  });
  it("seededRandom returns 0..1", () => {
    const r = seededRandom(1)();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
  it("generateStars returns array", () => {
    const stars = generateStars(20, 100, 100, 1);
    expect(stars.length).toBeGreaterThan(0);
  });
  it("generateStars with density 0 returns empty", () => {
    expect(generateStars(0, 100, 100, 1)).toEqual([]);
  });
  it("applyStar brightens pixel", () => {
    const out = applyStar([50, 50, 50, 255], 0.5);
    expect(out[0]).toBeGreaterThan(50);
  });
  it("applyStar preserves alpha", () => {
    const out = applyStar([50, 50, 50, 128], 0.5);
    expect(out[3]).toBe(128);
  });
});

describe("validateSwirlOptions", () => {
  it("accepts valid options", () => {
    expect(validateSwirlOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects bad cx", () => {
    expect(validateSwirlOptions({ ...DEFAULT_OPTIONS, cx: 2 })).toHaveProperty("error");
  });
  it("rejects bad radius", () => {
    expect(validateSwirlOptions({ ...DEFAULT_OPTIONS, radius: 0 })).toHaveProperty("error");
    expect(validateSwirlOptions({ ...DEFAULT_OPTIONS, radius: 3 })).toHaveProperty("error");
  });
  it("rejects bad star density", () => {
    expect(validateSwirlOptions({ ...DEFAULT_OPTIONS, starDensity: 200 })).toHaveProperty("error");
  });
  it("rejects bad color shift", () => {
    expect(validateSwirlOptions({ ...DEFAULT_OPTIONS, colorShift: 400 })).toHaveProperty("error");
  });
  it("rejects non-finite angle", () => {
    expect(validateSwirlOptions({ ...DEFAULT_OPTIONS, angle: Number.NaN })).toHaveProperty("error");
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true for zero angle, density, shift", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, angle: 0, starDensity: 0, colorShift: 0 })).toBe(true);
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
  it("nudgeValue increments by 0.05", () => {
    expect(nudgeValue(1, "arrowup", false)).toBeCloseTo(1.05);
  });
  it("nudgeValue increments by 0.5 with shift", () => {
    expect(nudgeValue(1, "arrowup", true)).toBeCloseTo(1.5);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("vortex")?.options.angle).toBe(Math.PI * 4);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
