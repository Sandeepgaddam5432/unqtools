import { describe, it, expect } from "vitest";
import {
  normalizedDistance,
  distanceFromCenter,
  vignetteFactor,
  applyVignette,
  blendColor,
  validateVignetteOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  luma,
  meanDelta,
  findPreset,
  PRESETS,
  clampByte,
  type VignetteOptions,
} from "./logic";

const DEFAULT_OPTS: VignetteOptions = {
  amount: 80, size: 20, feather: 60, offsetX: 0, offsetY: 0,
  shape: "ellipse", color: [0, 0, 0], blend: "multiply",
};

describe("normalizedDistance", () => {
  it("is 0 at the center", () => {
    expect(normalizedDistance(50, 50, 100, 100)).toBeCloseTo(0, 5);
  });
  it("is 1 at the corner", () => {
    expect(normalizedDistance(0, 0, 100, 100)).toBeCloseTo(1, 5);
    expect(normalizedDistance(100, 100, 100, 100)).toBeCloseTo(1, 5);
  });
  it("scales linearly", () => {
    const a = normalizedDistance(50, 0, 100, 100);
    const b = normalizedDistance(75, 0, 100, 100);
    expect(b).toBeGreaterThan(a);
  });
});

describe("distanceFromCenter", () => {
  it("is 0 at center", () => {
    expect(distanceFromCenter(50, 50, 100, 100, 0, 0, "circle")).toBeCloseTo(0, 5);
  });
  it("respects offset", () => {
    // With offset, the (10,50) point is closer to the new center (60,50) than to (50,50).
    const a = distanceFromCenter(10, 50, 100, 100, 0, 0, "ellipse");
    const b = distanceFromCenter(10, 50, 100, 100, 0.1, 0, "ellipse");
    expect(b).toBeGreaterThan(a);
  });
});

describe("vignetteFactor", () => {
  it("is 1 at center for any amount", () => {
    const f = vignetteFactor(50, 50, 100, 100, { ...DEFAULT_OPTS, amount: 80, size: 0, feather: 50 });
    expect(f).toBeCloseTo(1, 5);
  });
  it("decreases toward corners", () => {
    const center = vignetteFactor(50, 50, 100, 100, { ...DEFAULT_OPTS, amount: 80, size: 0, feather: 50 });
    const corner = vignetteFactor(0, 0, 100, 100, { ...DEFAULT_OPTS, amount: 80, size: 0, feather: 50 });
    expect(corner).toBeLessThan(center);
  });
  it("is 1 everywhere when amount is 0", () => {
    const f = vignetteFactor(0, 0, 100, 100, { ...DEFAULT_OPTS, amount: 0, size: 0, feather: 50 });
    expect(f).toBe(1);
  });
  it("never goes below (1 - amount)", () => {
    const f = vignetteFactor(0, 0, 100, 100, { ...DEFAULT_OPTS, amount: 80, size: 0, feather: 10 });
    expect(f).toBeGreaterThanOrEqual(0.2 - 1e-6);
  });
  it("clamps feather to avoid divide-by-zero", () => {
    expect(() => vignetteFactor(0, 0, 100, 100, { ...DEFAULT_OPTS, amount: 50, size: 0, feather: 0 })).not.toThrow();
  });
});

describe("blendColor", () => {
  it("multiply multiplies and divides by 255", () => {
    expect(blendColor(100, 100, "multiply")).toBeCloseTo(39, 0);
    expect(blendColor(255, 255, "multiply")).toBe(255);
  });
  it("screen lightens", () => {
    expect(blendColor(100, 100, "screen")).toBeGreaterThan(100);
  });
  it("overlay does midtone shift", () => {
    const a = blendColor(50, 50, "overlay");
    const b = blendColor(200, 200, "overlay");
    expect(a).toBeLessThan(100);
    expect(b).toBeGreaterThan(200);
  });
});

describe("applyVignette", () => {
  it("scales pixel by factor with multiply", () => {
    const out = applyVignette({ r: 200, g: 100, b: 50, a: 255 }, 1, [0, 0, 0], "multiply");
    expect(out.r).toBeLessThanOrEqual(200);
  });
  it("preserves alpha", () => {
    const out = applyVignette({ r: 200, g: 100, b: 50, a: 128 }, 0.5, [0, 0, 0], "multiply");
    expect(out.a).toBe(128);
  });
  it("factor 1 with multiply of identical target preserves pixel (multiply(x, x) = x*x/255)", () => {
    const out = applyVignette({ r: 200, g: 100, b: 50, a: 255 }, 1, [0, 0, 0], "multiply");
    // target = [200, 100, 50]; blendColor(200, 200, multiply) = 200*200/255 ≈ 157
    expect(out.r).toBeCloseTo((200 * 200) / 255, 0);
  });
});

describe("validateVignetteOptions", () => {
  it("accepts valid options", () => {
    expect(validateVignetteOptions(DEFAULT_OPTS)).toEqual({ ok: true });
  });
  it("rejects out-of-range amount", () => {
    expect(validateVignetteOptions({ ...DEFAULT_OPTS, amount: 150 })).toHaveProperty("error");
  });
  it("rejects out-of-range size", () => {
    expect(validateVignetteOptions({ ...DEFAULT_OPTS, size: -1 })).toHaveProperty("error");
  });
  it("rejects bad offset", () => {
    expect(validateVignetteOptions({ ...DEFAULT_OPTS, offsetX: 1 })).toHaveProperty("error");
  });
  it("rejects bad shape", () => {
    expect(validateVignetteOptions({ ...DEFAULT_OPTS, shape: "bad" as never })).toHaveProperty("error");
  });
  it("rejects bad blend", () => {
    expect(validateVignetteOptions({ ...DEFAULT_OPTS, blend: "bad" as never })).toHaveProperty("error");
  });
  it("rejects bad color", () => {
    expect(validateVignetteOptions({ ...DEFAULT_OPTS, color: [300, 0, 0] })).toHaveProperty("error");
  });
});

describe("helpers + presets", () => {
  it("isIdentity true when amount 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTS, amount: 0 })).toBe(true);
  });
  it("isIdentity false for defaults", () => {
    expect(isIdentity(DEFAULT_OPTS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTS);
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("classic")?.options.amount).toBe(80);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
