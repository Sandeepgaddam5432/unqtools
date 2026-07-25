import { describe, it, expect } from "vitest";
import {
  luma,
  applyThreshold,
  applyThresholdWithIntensity,
  clampThreshold,
  otsuThreshold,
  lumaHistogram,
  localWindowMean,
  floydSteinbergDither,
  validateThresholdOptions,
  thresholdStats,
  batchValidate,
  isIdentity,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("luma", () => {
  it("black is 0", () => expect(luma({ r: 0, g: 0, b: 0 })).toBe(0));
  it("white is 255", () => expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0));
  it("weights green most heavily", () => {
    expect(luma({ r: 0, g: 255, b: 0 })).toBeGreaterThan(luma({ r: 255, g: 0, b: 0 }));
  });
});

describe("applyThreshold — binary", () => {
  it("returns white for pixels above threshold", () => {
    expect(applyThreshold({ r: 200, g: 200, b: 200, a: 255 }, DEFAULT_OPTIONS)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
  it("returns black for pixels below threshold", () => {
    expect(applyThreshold({ r: 50, g: 50, b: 50, a: 255 }, DEFAULT_OPTIONS)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
  it("inverts when invert is true", () => {
    const out = applyThreshold({ r: 200, g: 200, b: 200, a: 255 }, { ...DEFAULT_OPTIONS, invert: true });
    expect(out).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
  it("preserves alpha", () => {
    expect(applyThreshold({ r: 200, g: 200, b: 200, a: 128 }, DEFAULT_OPTIONS).a).toBe(128);
  });
  it("treats equal to threshold as above", () => {
    const out = applyThreshold({ r: 128, g: 128, b: 128, a: 255 }, DEFAULT_OPTIONS);
    expect(out.r).toBe(255);
  });
});

describe("applyThreshold — per-channel", () => {
  it("thresholds each channel individually", () => {
    const out = applyThreshold(
      { r: 200, g: 50, b: 200, a: 255 },
      { ...DEFAULT_OPTIONS, perChannel: true },
    );
    expect(out.r).toBe(255);
    expect(out.g).toBe(0);
    expect(out.b).toBe(255);
  });
});

describe("applyThresholdWithIntensity", () => {
  it("is identity at intensity 0", () => {
    const out = applyThresholdWithIntensity(
      { r: 100, g: 100, b: 100, a: 255 },
      { ...DEFAULT_OPTIONS, intensity: 0 },
    );
    expect(out).toEqual({ r: 100, g: 100, b: 100, a: 255 });
  });
  it("is full threshold at intensity 1", () => {
    const out = applyThresholdWithIntensity(
      { r: 200, g: 200, b: 200, a: 255 },
      { ...DEFAULT_OPTIONS, intensity: 1 },
    );
    expect(out.r).toBe(255);
  });
  it("blends at intensity 0.5", () => {
    const out = applyThresholdWithIntensity(
      { r: 50, g: 50, b: 50, a: 255 },
      { ...DEFAULT_OPTIONS, intensity: 0.5 },
    );
    expect(out.r).toBeLessThan(128);
    expect(out.r).toBeGreaterThan(0);
  });
});

describe("clampThreshold", () => {
  it("clamps to 0-255", () => {
    expect(clampThreshold(-5)).toBe(0);
    expect(clampThreshold(300)).toBe(255);
  });
  it("rounds decimals", () => {
    expect(clampThreshold(128.4)).toBe(128);
    expect(clampThreshold(128.6)).toBe(129);
  });
  it("returns 128 for non-finite", () => {
    expect(clampThreshold(Number.NaN)).toBe(128);
  });
});

describe("otsuThreshold", () => {
  it("returns 128 for empty histogram", () => {
    expect(otsuThreshold(new Array(256).fill(0))).toBe(128);
  });
  it("finds split for bimodal histogram", () => {
    const h = new Array(256).fill(0);
    for (let i = 0; i < 100; i++) h[i] = 10;
    for (let i = 150; i < 256; i++) h[i] = 10;
    const t = otsuThreshold(h);
    expect(t).toBeGreaterThanOrEqual(99);
    expect(t).toBeLessThanOrEqual(150);
  });
});

describe("lumaHistogram + localWindowMean", () => {
  it("lumaHistogram counts pixels", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const h = lumaHistogram(data);
    expect(h[255]).toBe(1);
    expect(h[0]).toBe(1);
  });
  it("localWindowMean returns mean of window", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
    const m = localWindowMean(data, 2, 2, 0, 0, 3);
    // The window covers (0,0)..(1,1) clamped to bounds since 2x2 image: 4 pixels all averaged
    expect(m).toBeGreaterThan(0);
  });
});

describe("floydSteinbergDither", () => {
  it("produces binary output (0 or 255)", () => {
    const buf = [10, 100, 200, 250];
    const out = floydSteinbergDither(buf, 2, 2, 128);
    for (const v of out) expect(v === 0 || v === 255).toBe(true);
  });
  it("preserves array length", () => {
    const out = floydSteinbergDither([10, 20, 30, 40], 2, 2, 128);
    expect(out.length).toBe(4);
  });
});

describe("validateThresholdOptions", () => {
  it("accepts valid threshold", () => {
    expect(validateThresholdOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects out-of-range threshold", () => {
    expect(validateThresholdOptions({ ...DEFAULT_OPTIONS, threshold: 300 })).toHaveProperty("error");
    expect(validateThresholdOptions({ ...DEFAULT_OPTIONS, threshold: -1 })).toHaveProperty("error");
  });
  it("rejects NaN threshold", () => {
    expect(validateThresholdOptions({ ...DEFAULT_OPTIONS, threshold: Number.NaN })).toHaveProperty("error");
  });
  it("rejects even window size", () => {
    expect(validateThresholdOptions({ ...DEFAULT_OPTIONS, windowSize: 10 })).toHaveProperty("error");
  });
  it("rejects out-of-range intensity", () => {
    expect(validateThresholdOptions({ ...DEFAULT_OPTIONS, intensity: 1.5 })).toHaveProperty("error");
  });
});

describe("thresholdStats", () => {
  it("counts white and black", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
    const s = thresholdStats(data);
    expect(s.white).toBe(1);
    expect(s.black).toBe(1);
    expect(s.total).toBe(2);
    expect(s.whiteRatio).toBe(0.5);
  });
  it("handles empty data", () => {
    const s = thresholdStats(new Uint8ClampedArray(0));
    expect(s.total).toBe(0);
    expect(s.whiteRatio).toBe(0);
  });
});

describe("batch + identity + format + nudge + presets", () => {
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("isIdentity true when intensity 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, intensity: 0 })).toBe(true);
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
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
    expect(findPreset("adaptive")?.options.method).toBe("adaptive");
  });
  it("has at least 7 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(7);
  });
  it("clampByte rounds", () => {
    expect(clampByte(127.6)).toBe(128);
    expect(clampByte(-5)).toBe(0);
  });
});
