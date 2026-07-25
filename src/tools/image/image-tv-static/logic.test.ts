import { describe, it, expect } from "vitest";
import {
  makeRng, staticPixel, applyIntensity, applyScanlines, applyVignette,
  generateStatic, generateFrames, computeStats, histogram,
  buildStaticFilename, validateTvStaticOptions, getPreset,
  type TvStaticOptions,
} from "./logic";

const baseOpts = (over: Partial<TvStaticOptions> = {}): TvStaticOptions => ({
  intensity: 0.2,
  monochrome: true,
  seed: 42,
  tint: { r: 128, g: 128, b: 128 },
  brightness: 1,
  contrast: 0,
  scanlines: 0,
  vignette: 0,
  ...over,
});

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
  it("produces different values for different seeds", () => {
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });
});

describe("staticPixel", () => {
  it("returns equal RGB channels in monochrome mode", () => {
    const rng = makeRng(1);
    const p = staticPixel(rng, baseOpts({ monochrome: true }));
    expect(p.r).toBe(p.g);
    expect(p.g).toBe(p.b);
  });
  it("returns byte values", () => {
    const rng = makeRng(1);
    const p = staticPixel(rng, baseOpts({ monochrome: false }));
    expect(p.r).toBeGreaterThanOrEqual(0);
    expect(p.r).toBeLessThanOrEqual(255);
  });
  it("respects brightness multiplier", () => {
    const rng1 = makeRng(1);
    const rng2 = makeRng(1);
    const p1 = staticPixel(rng1, baseOpts({ brightness: 0.5, monochrome: true }));
    const p2 = staticPixel(rng2, baseOpts({ brightness: 1, monochrome: true }));
    expect(p1.r).toBeLessThanOrEqual(p2.r + 1);
  });
});

describe("applyIntensity", () => {
  it("returns white when rng below intensity", () => {
    const out = applyIntensity({ r: 100, g: 100, b: 100 }, () => 0.1, baseOpts({ intensity: 0.5 }));
    expect(out).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("returns base pixel when rng above intensity", () => {
    const out = applyIntensity({ r: 100, g: 100, b: 100 }, () => 0.9, baseOpts({ intensity: 0.5 }));
    expect(out).toEqual({ r: 100, g: 100, b: 100 });
  });
});

describe("applyScanlines", () => {
  it("returns pixel unchanged at even rows", () => {
    const p = { r: 100, g: 100, b: 100 };
    expect(applyScanlines(p, 0, 0.5)).toEqual(p);
    expect(applyScanlines(p, 2, 0.5)).toEqual(p);
  });
  it("darkens odd rows", () => {
    const out = applyScanlines({ r: 100, g: 100, b: 100 }, 1, 0.5);
    expect(out.r).toBe(50);
  });
  it("no-ops when strength is 0", () => {
    const p = { r: 100, g: 100, b: 100 };
    expect(applyScanlines(p, 1, 0)).toEqual(p);
  });
});

describe("applyVignette", () => {
  it("no-ops when strength is 0", () => {
    const p = { r: 100, g: 100, b: 100 };
    expect(applyVignette(p, 0, 0, 100, 100, 0)).toEqual(p);
  });
  it("darkens corners more than center", () => {
    const center = applyVignette({ r: 100, g: 100, b: 100 }, 50, 50, 100, 100, 0.5);
    const corner = applyVignette({ r: 100, g: 100, b: 100 }, 0, 0, 100, 100, 0.5);
    expect(center.r).toBeGreaterThan(corner.r);
  });
});

describe("generateStatic", () => {
  it("produces the requested number of pixels", () => {
    expect(generateStatic(10, 10, baseOpts()).length).toBe(100);
  });
  it("is reproducible for the same seed", () => {
    const a = generateStatic(5, 5, baseOpts({ seed: 42 }));
    const b = generateStatic(5, 5, baseOpts({ seed: 42 }));
    expect(a).toEqual(b);
  });
  it("respects scanlines and vignette", () => {
    const out = generateStatic(8, 8, baseOpts({ scanlines: 0.5, vignette: 0.5 }));
    expect(out.length).toBe(64);
  });
});

describe("generateFrames", () => {
  it("produces the requested number of frames", () => {
    const frames = generateFrames(4, 4, baseOpts(), 3);
    expect(frames.length).toBe(3);
    expect(frames[0]!.length).toBe(16);
  });
  it("frames differ when seed differs", () => {
    const frames = generateFrames(4, 4, baseOpts({ seed: 1 }), 2);
    expect(frames[0]).not.toEqual(frames[1]);
  });
});

describe("computeStats", () => {
  it("returns zero stats for empty pixel array", () => {
    expect(computeStats([])).toEqual({ mean: 0, variance: 0, min: 0, max: 0 });
  });
  it("computes mean of uniform pixels", () => {
    const pixels = [{ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 }];
    const s = computeStats(pixels);
    expect(s.mean).toBe(100);
    expect(s.variance).toBe(0);
  });
  it("computes variance for mixed pixels", () => {
    const pixels = [{ r: 0, g: 0, b: 0 }, { r: 200, g: 200, b: 200 }];
    const s = computeStats(pixels);
    expect(s.mean).toBe(100);
    expect(s.variance).toBeCloseTo(10000, 0);
  });
});

describe("histogram", () => {
  it("returns array of bucket counts", () => {
    const pixels = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
    const h = histogram(pixels, 4);
    expect(h.length).toBe(4);
    expect(h.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe("buildStaticFilename", () => {
  it("includes preset, seed, and frame", () => {
    expect(buildStaticFilename("crt", 42, 3)).toBe("tv-static-crt-seed42-3.png");
  });
});

describe("validateTvStaticOptions", () => {
  it("accepts valid options", () => {
    expect(validateTvStaticOptions(baseOpts())).toEqual({ ok: true });
  });
  it("rejects bad intensity", () => {
    expect(validateTvStaticOptions(baseOpts({ intensity: 2 }))).toHaveProperty("error");
  });
  it("rejects non-finite seed", () => {
    expect(validateTvStaticOptions(baseOpts({ seed: NaN }))).toHaveProperty("error");
  });
  it("rejects bad brightness", () => {
    expect(validateTvStaticOptions(baseOpts({ brightness: 3 }))).toHaveProperty("error");
  });
  it("rejects bad contrast", () => {
    expect(validateTvStaticOptions(baseOpts({ contrast: 2 }))).toHaveProperty("error");
  });
  it("rejects bad scanlines", () => {
    expect(validateTvStaticOptions(baseOpts({ scanlines: 2 }))).toHaveProperty("error");
  });
});

describe("getPreset", () => {
  it("returns valid options for each preset", () => {
    const presets: TvStaticOptions[] = ["snow", "crt", "digital", "analog", "warm", "cool"].map((p) => getPreset(p as never));
    for (const p of presets) {
      expect(validateTvStaticOptions(p)).toEqual({ ok: true });
    }
  });
  it("CRT preset has scanlines > 0", () => {
    expect(getPreset("crt").scanlines).toBeGreaterThan(0);
  });
  it("warm preset has warm tint", () => {
    const p = getPreset("warm");
    expect(p.tint.r).toBeGreaterThan(p.tint.b);
  });
});
