import { describe, it, expect } from "vitest";
import { makeRng, rainbowHue, hsvToRgb, randomNoise, blendWithNoise, validateRainbowNoiseOptions } from "./logic";

const OPTS = { strength: 0.5, hueOffset: 0, frequency: 100 };

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
});

describe("hsvToRgb", () => {
  it("returns black for v=0", () => {
    expect(hsvToRgb(0, 1, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("returns white for s=0, v=1", () => {
    expect(hsvToRgb(0, 0, 1)).toEqual({ r: 255, g: 255, b: 255 });
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
});
