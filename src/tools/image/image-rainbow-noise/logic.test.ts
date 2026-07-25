import { describe, it, expect } from "vitest";
import {
  makeRng,
  rainbowHue,
  hsvToRgb,
  baseColor,
  randomNoise,
  blendWithNoise,
  validateRainbowNoiseOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  luma,
  meanDelta,
  findPreset,
  PRESETS,
  clampByte,
  type RainbowNoiseOptions,
} from "./logic";

const OPTS: RainbowNoiseOptions = {
  strength: 0.5, hueOffset: 0, frequency: 100, color: "rainbow",
  pattern: "smooth", duotone: [[0, 0, 0], [255, 255, 255]], seed: 42,
};

describe("makeRng", () => {
  it("returns deterministic values for the same seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
  });
  it("returns values in [0, 1)", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("changes with seed", () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe("rainbowHue", () => {
  it("returns values in [0, 360)", () => {
    for (let i = 0; i < 100; i++) {
      const h = rainbowHue(i, i, OPTS);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
  it("shifts by hue offset", () => {
    const a = rainbowHue(0, 0, OPTS);
    const b = rainbowHue(0, 0, { ...OPTS, hueOffset: 180 });
    expect(Math.abs(b - a)).toBeCloseTo(180, 0);
  });
  it("striped pattern depends only on y", () => {
    const h1 = rainbowHue(0, 10, { ...OPTS, pattern: "striped" });
    const h2 = rainbowHue(100, 10, { ...OPTS, pattern: "striped" });
    expect(h1).toBe(h2);
  });
});

describe("hsvToRgb", () => {
  it("returns black for v=0", () => {
    expect(hsvToRgb(0, 1, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("returns white for s=0, v=1", () => {
    expect(hsvToRgb(0, 0, 1)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("baseColor", () => {
  it("rainbow mode returns hsvToRgb of hue", () => {
    const c = baseColor(10, 20, OPTS);
    const h = rainbowHue(10, 20, OPTS);
    const expected = hsvToRgb(h, 1, 1);
    expect(c).toEqual(expected);
  });
  it("mono mode returns grayscale", () => {
    const c = baseColor(10, 20, { ...OPTS, color: "mono" });
    expect(c.r).toBe(c.g);
    expect(c.g).toBe(c.b);
  });
  it("duotone mode interpolates between colors", () => {
    const c = baseColor(0, 0, { ...OPTS, color: "duotone", duotone: [[10, 20, 30], [200, 100, 50]] });
    expect(c.r).toBeGreaterThanOrEqual(10);
  });
});

describe("randomNoise", () => {
  it("returns bytes in [0, 255]", () => {
    const rng = makeRng(1);
    const n = randomNoise(rng);
    expect(n.r).toBeGreaterThanOrEqual(0);
    expect(n.r).toBeLessThanOrEqual(255);
  });
});

describe("blendWithNoise", () => {
  it("returns base when strength is 0", () => {
    const out = blendWithNoise({ r: 100, g: 50, b: 25 }, { r: 200, g: 200, b: 200 }, 0);
    expect(out).toEqual({ r: 100, g: 50, b: 25 });
  });
  it("returns noise when strength is 1", () => {
    const out = blendWithNoise({ r: 100, g: 50, b: 25 }, { r: 200, g: 200, b: 200 }, 1);
    expect(out).toEqual({ r: 200, g: 200, b: 200 });
  });
  it("interpolates at 0.5", () => {
    const out = blendWithNoise({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 0.5);
    expect(out).toEqual({ r: 50, g: 50, b: 50 });
  });
});

describe("validateRainbowNoiseOptions", () => {
  it("accepts valid options", () => {
    expect(validateRainbowNoiseOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects bad strength", () => {
    expect(validateRainbowNoiseOptions({ ...OPTS, strength: 2 })).toHaveProperty("error");
  });
  it("rejects bad frequency", () => {
    expect(validateRainbowNoiseOptions({ ...OPTS, frequency: 0 })).toHaveProperty("error");
  });
  it("rejects bad color", () => {
    expect(validateRainbowNoiseOptions({ ...OPTS, color: "bad" as never })).toHaveProperty("error");
  });
  it("rejects bad pattern", () => {
    expect(validateRainbowNoiseOptions({ ...OPTS, pattern: "bad" as never })).toHaveProperty("error");
  });
  it("rejects bad duotone colors", () => {
    expect(validateRainbowNoiseOptions({ ...OPTS, duotone: [[300, 0, 0], [0, 0, 0]] })).toHaveProperty("error");
  });
});

describe("helpers + presets", () => {
  it("isIdentity true when strength 0", () => {
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
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("vivid")?.options.strength).toBe(0.7);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
