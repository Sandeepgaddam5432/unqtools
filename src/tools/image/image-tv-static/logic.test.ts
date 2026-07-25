import { describe, it, expect } from "vitest";
import { makeRng, staticPixel, applyIntensity, generateStatic, validateTvStaticOptions } from "./logic";

describe("makeRng", () => {
  it("is deterministic for same seed", () => {
    expect(makeRng(99)()).toBe(makeRng(99)());
  });
  it("produces values in [0, 1)", () => {
    const rng = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("staticPixel", () => {
  it("returns equal RGB channels in monochrome mode", () => {
    const rng = makeRng(1);
    const p = staticPixel(rng, { intensity: 0, monochrome: true, seed: 1 });
    expect(p.r).toBe(p.g);
    expect(p.g).toBe(p.b);
  });
  it("returns byte values", () => {
    const rng = makeRng(1);
    const p = staticPixel(rng, { intensity: 0, monochrome: false, seed: 1 });
    expect(p.r).toBeGreaterThanOrEqual(0);
    expect(p.r).toBeLessThanOrEqual(255);
  });
});

describe("applyIntensity", () => {
  it("returns white when rng below intensity", () => {
    const rng = makeRng(1);
    const out = applyIntensity({ r: 100, g: 100, b: 100 }, () => 0.1, { intensity: 0.5, monochrome: true, seed: 1 });
    expect(out).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("returns base pixel when rng above intensity", () => {
    const out = applyIntensity({ r: 100, g: 100, b: 100 }, () => 0.9, { intensity: 0.5, monochrome: true, seed: 1 });
    expect(out).toEqual({ r: 100, g: 100, b: 100 });
  });
});

describe("generateStatic", () => {
  it("produces the requested number of pixels", () => {
    const out = generateStatic(10, 10, { intensity: 0.5, monochrome: true, seed: 1 });
    expect(out.length).toBe(100);
  });
  it("is reproducible for the same seed", () => {
    const a = generateStatic(5, 5, { intensity: 0, monochrome: true, seed: 42 });
    const b = generateStatic(5, 5, { intensity: 0, monochrome: true, seed: 42 });
    expect(a).toEqual(b);
  });
});

describe("validateTvStaticOptions", () => {
  it("accepts valid options", () => {
    expect(validateTvStaticOptions({ intensity: 0.5, monochrome: true, seed: 1 })).toEqual({ ok: true });
  });
  it("rejects bad intensity", () => {
    expect(validateTvStaticOptions({ intensity: 2, monochrome: true, seed: 1 })).toHaveProperty("error");
  });
  it("rejects non-finite seed", () => {
    expect(validateTvStaticOptions({ intensity: 0.5, monochrome: true, seed: NaN })).toHaveProperty("error");
  });
});
