import { describe, it, expect } from "vitest";
import {
  validateFisheyeOptions,
  effectiveStrength,
  computeCenter,
  mapPixel,
  distortionFactor,
  bilinearSample,
  isIdentity,
  batchValidate,
  preservesAlpha,
  findPreset,
  PRESETS,
  clampByte,
  signedStrength,
  normalizedRadius,
  meanDelta,
  luma,
  type FisheyeOptions,
} from "./logic";

const OPTS: FisheyeOptions = { strength: 0.5, zoom: 1, offsetX: 0, offsetY: 0, mode: "barrel" };

describe("validateFisheyeOptions", () => {
  it("accepts valid options", () => {
    expect(validateFisheyeOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects out-of-range strength", () => {
    expect(validateFisheyeOptions({ ...OPTS, strength: 2 })).toHaveProperty("error");
  });
  it("rejects negative zoom", () => {
    expect(validateFisheyeOptions({ ...OPTS, zoom: -1 })).toHaveProperty("error");
  });
  it("rejects bad offset", () => {
    expect(validateFisheyeOptions({ ...OPTS, offsetX: 1 })).toHaveProperty("error");
  });
  it("rejects bad mode", () => {
    expect(validateFisheyeOptions({ ...OPTS, mode: "bad" as never })).toHaveProperty("error");
  });
});

describe("effectiveStrength + signedStrength + computeCenter", () => {
  it("effectiveStrength returns positive for barrel", () => {
    expect(effectiveStrength({ ...OPTS, mode: "barrel", strength: 0.5 })).toBe(0.5);
  });
  it("effectiveStrength returns negative for pincushion", () => {
    expect(effectiveStrength({ ...OPTS, mode: "pincushion", strength: 0.5 })).toBe(-0.5);
  });
  it("signedStrength matches effectiveStrength", () => {
    expect(signedStrength(0.5, "barrel")).toBe(0.5);
    expect(signedStrength(0.5, "pincushion")).toBe(-0.5);
  });
  it("computeCenter applies offset", () => {
    const c = computeCenter(100, 100, { ...OPTS, offsetX: 0.1, offsetY: -0.1 });
    expect(c.cx).toBeCloseTo(60, 0);
    expect(c.cy).toBeCloseTo(40, 0);
  });
});

describe("mapPixel", () => {
  it("returns center for center pixel", () => {
    const { x, y } = mapPixel(50, 50, 100, 100, OPTS);
    expect(x).toBeCloseTo(50, 5);
    expect(y).toBeCloseTo(50, 5);
  });
  it("preserves identity when strength is 0", () => {
    const { x, y } = mapPixel(20, 30, 100, 100, { ...OPTS, strength: 0 });
    expect(x).toBeCloseTo(20, 5);
    expect(y).toBeCloseTo(30, 5);
  });
  it("produces finite coordinates for edge pixels", () => {
    const { x, y } = mapPixel(0, 0, 100, 100, { ...OPTS, strength: 0.9 });
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("distortionFactor", () => {
  it("returns 1 at r=0", () => {
    expect(distortionFactor(0, 0.5)).toBe(1);
  });
  it("barrel distortion increases factor", () => {
    expect(distortionFactor(0.5, 0.5)).toBeGreaterThan(1);
  });
  it("pincushion distortion decreases factor", () => {
    expect(distortionFactor(0.5, -0.5)).toBeLessThan(1);
  });
});

describe("bilinearSample", () => {
  it("samples exact pixel when no fraction", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 40, 50, 60, 70, 80]);
    const [r, g, b, a] = bilinearSample(rgba, 2, 1, 0, 0);
    expect([r, g, b, a]).toEqual([10, 20, 30, 40]);
  });
  it("interpolates between pixels", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0, 100, 100, 100, 100]);
    const [r] = bilinearSample(rgba, 2, 1, 0.5, 0);
    expect(r).toBe(50);
  });
});

describe("normalizedRadius + helpers + presets", () => {
  it("normalizedRadius is 0 at center", () => {
    expect(normalizedRadius(50, 50, 100, 100, 50, 50)).toBeCloseTo(0, 5);
  });
  it("isIdentity true when strength 0 and zoom 1", () => {
    expect(isIdentity({ ...OPTS, strength: 0 })).toBe(true);
  });
  it("isIdentity false for defaults", () => {
    expect(isIdentity(OPTS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], OPTS);
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("pincushion")?.options.mode).toBe("pincushion");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
});
