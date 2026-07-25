import { describe, it, expect } from "vitest";
import {
  median,
  windowSamples,
  denoisePixel,
  splitChannels,
  validateDenoiseOptions,
  rgbToYcbcr,
  ycbcrToRgb,
  bilateralSample,
  nlmSample,
  waveletDenoiseChannel,
  deblockChannel,
  applyToRgba,
  splitRegion,
  denoiseStats,
  addGrain,
  makeRng,
  buildDenoiseFilename,
  DEFAULT_OPTIONS,
  type DenoiseOptions,
} from "./logic";

const baseOpts = (over: Partial<DenoiseOptions> = {}): DenoiseOptions => ({ ...DEFAULT_OPTIONS, ...over });

describe("median", () => {
  it("returns middle of odd-length array", () => expect(median([5, 1, 3])).toBe(3));
  it("returns average of middle two for even-length", () => expect(median([1, 2, 3, 4])).toBe(2.5));
  it("returns 0 for empty array", () => expect(median([])).toBe(0));
  it("does not mutate input", () => {
    const a = [3, 1, 2];
    median(a);
    expect(a).toEqual([3, 1, 2]);
  });
});

describe("windowSamples", () => {
  it("collects (2r+1)^2 samples", () => {
    const ch = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(windowSamples(ch, 3, 3, 1, 1, 1).length).toBe(9);
  });
  it("clamps at borders", () => {
    const ch = new Float32Array([1, 2, 3, 4]);
    const s = windowSamples(ch, 2, 2, 0, 0, 1);
    expect(s.length).toBe(9);
    expect(s.every((v) => v >= 1 && v <= 4)).toBe(true);
  });
});

describe("splitChannels", () => {
  it("separates RGBA bytes", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    const { r, g, b } = splitChannels(rgba, 2, 1);
    expect(r).toEqual(new Float32Array([10, 40]));
    expect(g).toEqual(new Float32Array([20, 50]));
    expect(b).toEqual(new Float32Array([30, 60]));
  });
});

describe("YCbCr round trip", () => {
  it("recovers original RGB within rounding", () => {
    const orig = { r: 100, g: 150, b: 200, a: 255 };
    const ycbcr = rgbToYcbcr(orig);
    const back = ycbcrToRgb(ycbcr.y, ycbcr.cb, ycbcr.cr, ycbcr.a);
    expect(back.r).toBeGreaterThanOrEqual(98);
    expect(back.r).toBeLessThanOrEqual(102);
    expect(back.a).toBe(255);
  });
  it("luma of pure white is ~255", () => {
    expect(rgbToYcbcr({ r: 255, g: 255, b: 255, a: 255 }).y).toBeCloseTo(255, 0);
  });
});

describe("denoisePixel", () => {
  it("preserves alpha", () => {
    const ch = { r: new Float32Array([10, 20, 30, 10, 20, 30, 10, 20, 30]), g: new Float32Array(9), b: new Float32Array(9) };
    const out = denoisePixel(ch, 3, 3, 1, 1, baseOpts({ strength: 100 }), { r: 20, g: 0, b: 0, a: 128 });
    expect(out.a).toBe(128);
  });
  it("leaves original at strength 0", () => {
    const ch = { r: new Float32Array([0, 0, 0, 0, 200, 0, 0, 0, 0]), g: new Float32Array(9), b: new Float32Array(9) };
    const out = denoisePixel(ch, 3, 3, 1, 1, baseOpts({ strength: 0 }), { r: 200, g: 0, b: 0, a: 255 });
    expect(out.r).toBe(200);
  });
  it("fully replaces at strength 100 luma+chroma (no detail recombine)", () => {
    const ch = { r: new Float32Array([0, 0, 0, 0, 200, 0, 0, 0, 0]), g: new Float32Array(9), b: new Float32Array(9) };
    const out = denoisePixel(ch, 3, 3, 1, 1, baseOpts({ strength: 100, lumaStrength: 100, chromaStrength: 100, detail: 0 }), { r: 200, g: 0, b: 0, a: 255 });
    // median of mostly-zero window is 0 → luma should drop to 0
    expect(out.r).toBe(0);
  });
});

describe("bilateralSample", () => {
  it("preserves sharp edges (returns ~center on isolated pixel)", () => {
    const ch = new Float32Array([0, 0, 0, 0, 200, 0, 0, 0, 0]);
    const v = bilateralSample(ch, 3, 3, 1, 1, 1, 2, 10);
    expect(v).toBeGreaterThan(150); // center dominates because color dist is high
  });
  it("smooths uniform regions", () => {
    const ch = new Float32Array([100, 100, 100, 100, 100, 100, 100, 100, 100]);
    expect(bilateralSample(ch, 3, 3, 1, 1, 1, 2, 30)).toBeCloseTo(100, 0);
  });
});

describe("nlmSample", () => {
  it("returns close to center on uniform region", () => {
    const ch = new Float32Array(25).fill(100);
    expect(nlmSample(ch, 5, 5, 2, 2, 1, 25)).toBeCloseTo(100, 0);
  });
});

describe("waveletDenoiseChannel", () => {
  it("preserves a flat region", () => {
    const ch = new Float32Array(16).fill(128);
    const out = waveletDenoiseChannel(ch, 4, 4, 5);
    for (let i = 0; i < 16; i++) expect(out[i]).toBeCloseTo(128, 0);
  });
});

describe("deblockChannel", () => {
  it("smooths 8x8 boundary", () => {
    const ch = new Float32Array(16 * 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) ch[y * 16 + x] = x < 8 ? 0 : 200;
    const out = deblockChannel(ch, 16, 16);
    // Boundary at x=8 should be smoothed
    expect(out[7]).toBeGreaterThan(0);
    expect(out[8]).toBeLessThan(200);
  });
});

describe("addGrain", () => {
  it("no-op when amount is 0", () => {
    const rng = makeRng(1);
    const p = { r: 100, g: 100, b: 100, a: 255 };
    expect(addGrain(p, rng, 0)).toEqual(p);
  });
  it("changes values when amount > 0", () => {
    const rng = makeRng(1);
    const p = { r: 100, g: 100, b: 100, a: 255 };
    const out = addGrain(p, rng, 50);
    // At least one channel should differ
    expect([out.r, out.g, out.b].some((v) => v !== 100)).toBe(true);
  });
});

describe("applyToRgba", () => {
  it("returns same length buffer", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const out = applyToRgba(rgba, 4, 4, baseOpts({ strength: 0 }));
    expect(out.length).toBe(rgba.length);
  });
  it("does nothing at strength 0", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const out = applyToRgba(rgba, 4, 4, baseOpts({ strength: 0 }));
    for (let i = 0; i < rgba.length; i += 4) expect(out[i]).toBe(128);
  });
  it("applies wavelet mode without crashing", () => {
    const rgba = new Uint8ClampedArray(8 * 8 * 4).fill(100);
    const out = applyToRgba(rgba, 8, 8, baseOpts({ mode: "wavelet", strength: 50 }));
    expect(out.length).toBe(rgba.length);
  });
});

describe("splitRegion", () => {
  it("keeps left half original, right half denoised", () => {
    const rgba = new Uint8ClampedArray(8 * 2 * 4).fill(0);
    const denoised = new Uint8ClampedArray(8 * 2 * 4).fill(255);
    const out = splitRegion(rgba, denoised, 8, 2);
    // x=0 (left half) → original (0); x=4 (right half) → denoised (255)
    expect(out[0]).toBe(0);
    expect(out[4 * 4]).toBe(255);
  });
});

describe("denoiseStats", () => {
  it("returns 0 deltas when buffers are identical", () => {
    const rgba = new Uint8ClampedArray(16).fill(100);
    const s = denoiseStats(rgba, rgba);
    expect(s.meanAbsDelta).toBe(0);
    expect(s.maxAbsDelta).toBe(0);
    expect(s.changedPct).toBe(0);
  });
  it("computes nonzero deltas when buffers differ", () => {
    const rgba = new Uint8ClampedArray(16).fill(0);
    const result = new Uint8ClampedArray(16).fill(50);
    const s = denoiseStats(rgba, result);
    expect(s.meanAbsDelta).toBeCloseTo(50, 0);
    expect(s.maxAbsDelta).toBe(50);
    expect(s.changedPct).toBe(100);
  });
});

describe("validateDenoiseOptions", () => {
  it("accepts valid options", () => {
    expect(validateDenoiseOptions(baseOpts())).toEqual({ ok: true });
  });
  it("rejects radius 0", () => {
    expect(validateDenoiseOptions(baseOpts({ radius: 0 }))).toHaveProperty("error");
  });
  it("rejects radius 6", () => {
    expect(validateDenoiseOptions(baseOpts({ radius: 6 }))).toHaveProperty("error");
  });
  it("rejects out-of-range strength", () => {
    expect(validateDenoiseOptions(baseOpts({ strength: 200 }))).toHaveProperty("error");
  });
  it("rejects out-of-range grain", () => {
    expect(validateDenoiseOptions(baseOpts({ grain: 200 }))).toHaveProperty("error");
  });
  it("rejects unknown mode", () => {
    expect(validateDenoiseOptions(baseOpts({ mode: "bogus" as DenoiseOptions["mode"] }))).toHaveProperty("error");
  });
});

describe("buildDenoiseFilename", () => {
  it("appends mode suffix", () => {
    expect(buildDenoiseFilename("photo.png", "median")).toBe("photo-denoised-median.png");
    expect(buildDenoiseFilename("logo", "bilateral")).toBe("logo-denoised-bilateral.png");
  });
});
