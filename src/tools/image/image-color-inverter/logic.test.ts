import { describe, it, expect } from "vitest";
import {
  invertPixel,
  invertChannel,
  applyInvert,
  validateInvertOptions,
  luma,
  clampByte,
  clamp01,
  toCssFilter,
  computeStats,
  inversionDelta,
  batchValidate,
  isIdentity,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
} from "./logic";

describe("invertChannel", () => {
  it("fully inverts at strength 1", () => {
    expect(invertChannel(0, 1)).toBe(255);
    expect(invertChannel(255, 1)).toBe(0);
    expect(invertChannel(128, 1)).toBe(127);
  });
  it("leaves value unchanged at strength 0", () => {
    expect(invertChannel(100, 0)).toBe(100);
  });
  it("blends at strength 0.5", () => {
    expect(invertChannel(0, 0.5)).toBeCloseTo(128, -1);
  });
  it("clamps out-of-range strength", () => {
    expect(invertChannel(100, 5)).toBe(155);
  });
});

describe("invertPixel", () => {
  it("fully inverts at strength 1", () => {
    expect(invertPixel({ r: 0, g: 128, b: 255, a: 255 }, 1)).toEqual({ r: 255, g: 127, b: 0, a: 255 });
  });
  it("leaves pixel unchanged at strength 0", () => {
    expect(invertPixel({ r: 10, g: 20, b: 30, a: 255 }, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });
  it("preserves alpha", () => {
    expect(invertPixel({ r: 100, g: 100, b: 100, a: 128 }, 1).a).toBe(128);
  });
  it("blends at strength 0.5", () => {
    const r = invertPixel({ r: 0, g: 0, b: 0, a: 255 }, 0.5);
    expect(r.r).toBeCloseTo(128, -1);
  });
  it("clamps out-of-range strength", () => {
    const r = invertPixel({ r: 100, g: 100, b: 100, a: 255 }, 5);
    expect(r.r).toBe(155);
  });
});

describe("applyInvert — per-channel + selective", () => {
  it("inverts only red channel when configured", () => {
    const out = applyInvert(
      { r: 0, g: 100, b: 200, a: 255 },
      { ...DEFAULT_OPTIONS, channels: { r: true, g: false, b: false } },
    );
    expect(out).toEqual({ r: 255, g: 100, b: 200, a: 255 });
  });
  it("inverts only green channel when configured", () => {
    const out = applyInvert(
      { r: 0, g: 100, b: 200, a: 255 },
      { ...DEFAULT_OPTIONS, channels: { r: false, g: true, b: false } },
    );
    expect(out.g).toBe(155);
    expect(out.r).toBe(0);
    expect(out.b).toBe(200);
  });
  it("skips pixels outside luma range when selective", () => {
    const opts = { ...DEFAULT_OPTIONS, selective: true, lumaLow: 100, lumaHigh: 200 };
    // Luma of (50,50,50) = 50, outside
    const out = applyInvert({ r: 50, g: 50, b: 50, a: 255 }, opts);
    expect(out).toEqual({ r: 50, g: 50, b: 50, a: 255 });
  });
  it("inverts pixels inside luma range when selective", () => {
    const opts = { ...DEFAULT_OPTIONS, selective: true, lumaLow: 100, lumaHigh: 200 };
    // Luma of (100,100,100) = 100, inside
    const out = applyInvert({ r: 100, g: 100, b: 100, a: 255 }, opts);
    expect(out.r).toBe(155);
  });
  it("preserves alpha in all modes", () => {
    const out = applyInvert({ r: 100, g: 100, b: 100, a: 64 }, DEFAULT_OPTIONS);
    expect(out.a).toBe(64);
  });
});

describe("validateInvertOptions", () => {
  it("accepts valid strength", () => {
    expect(validateInvertOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects negative strength", () => {
    expect(validateInvertOptions({ ...DEFAULT_OPTIONS, strength: -0.1 })).toHaveProperty("error");
  });
  it("rejects strength > 1", () => {
    expect(validateInvertOptions({ ...DEFAULT_OPTIONS, strength: 1.5 })).toHaveProperty("error");
  });
  it("rejects lumaLow > lumaHigh", () => {
    expect(validateInvertOptions({ ...DEFAULT_OPTIONS, lumaLow: 200, lumaHigh: 100 })).toHaveProperty("error");
  });
  it("rejects blend out of range", () => {
    expect(validateInvertOptions({ ...DEFAULT_OPTIONS, blend: 2 })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("black is 0", () => expect(luma({ r: 0, g: 0, b: 0 })).toBe(0));
  it("white is 255", () => expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0));
  it("weights green most", () => {
    expect(luma({ r: 0, g: 255, b: 0 })).toBeGreaterThan(luma({ r: 255, g: 0, b: 0 }));
  });
});

describe("clamp helpers", () => {
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
    expect(clampByte(128.6)).toBe(129);
  });
  it("clamp01 clamps to [0,1]", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe("toCssFilter", () => {
  it("returns none for zero strength", () => {
    expect(toCssFilter({ ...DEFAULT_OPTIONS, strength: 0 })).toBe("none");
  });
  it("returns invert() for full-channel full-strength", () => {
    expect(toCssFilter({ ...DEFAULT_OPTIONS, strength: 1 })).toBe("invert(100%)");
  });
  it("returns none when only one channel enabled", () => {
    expect(toCssFilter({ ...DEFAULT_OPTIONS, channels: { r: true, g: false, b: false } })).toBe("none");
  });
});

describe("computeStats", () => {
  it("computes mean values", () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);
    const s = computeStats(data);
    expect(s.count).toBe(2);
    expect(s.meanR).toBe(127.5);
    expect(s.meanLuma).toBeCloseTo(127.5, 0);
  });
  it("handles empty data", () => {
    expect(computeStats(new Uint8ClampedArray(0)).count).toBe(0);
  });
});

describe("inversionDelta", () => {
  it("is large for high-contrast data", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    expect(inversionDelta(data)).toBeGreaterThan(100);
  });
  it("is zero for mid-gray data", () => {
    const data = new Uint8ClampedArray([128, 128, 128, 255]);
    expect(inversionDelta(data)).toBeLessThan(2);
  });
  it("handles empty data", () => {
    expect(inversionDelta(new Uint8ClampedArray(0))).toBe(0);
  });
});

describe("batch + identity + format", () => {
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }, { name: "b.png" }], DEFAULT_OPTIONS);
    expect(r).toHaveLength(2);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("isIdentity true when strength 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, strength: 0 })).toBe(true);
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("preservesAlpha correct for each format", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/webp")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("nudgeValue", () => {
  it("increments by 1", () => expect(nudgeValue(10, "arrowup", false)).toBe(11));
  it("decrements by 1", () => expect(nudgeValue(10, "arrowdown", false)).toBe(9));
  it("increments by 10 with shift", () => expect(nudgeValue(10, "arrowup", true)).toBe(20));
  it("ignores other keys", () => expect(nudgeValue(10, "enter", false)).toBe(10));
});

describe("PRESETS + findPreset", () => {
  it("has at least 8 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(8);
  });
  it("findPreset returns matching preset", () => {
    const p = findPreset("full");
    expect(p).toBeDefined();
    expect(p!.options.strength).toBe(1);
  });
  it("findPreset returns undefined for missing", () => {
    expect(findPreset("does-not-exist")).toBeUndefined();
  });
  it("red-only preset inverts only red channel", () => {
    const p = findPreset("red-only");
    expect(p!.options.channels).toEqual({ r: true, g: false, b: false });
  });
});
