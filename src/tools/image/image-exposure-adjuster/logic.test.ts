import { describe, it, expect } from "vitest";
import {
  stopsToFactor,
  applyExposureChannel,
  applyExposure,
  applyAll,
  applyGamma,
  highlightProtect,
  shadowProtect,
  validateExposureOptions,
  formatStops,
  computeHistogram,
  meanLuma,
  autoExposure,
  exposureDelta,
  batchValidate,
  isIdentity,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("stopsToFactor", () => {
  it("0 stops = factor 1", () => expect(stopsToFactor(0)).toBe(1));
  it("+1 stop = factor 2", () => expect(stopsToFactor(1)).toBe(2));
  it("-1 stop = factor 0.5", () => expect(stopsToFactor(-1)).toBe(0.5));
  it("+2 stops = factor 4", () => expect(stopsToFactor(2)).toBe(4));
  it("-2 stops = factor 0.25", () => expect(stopsToFactor(-2)).toBe(0.25));
});

describe("applyExposureChannel", () => {
  it("doubles value at +1 stop", () => expect(applyExposureChannel(100, 1)).toBe(200));
  it("halves value at -1 stop", () => expect(applyExposureChannel(100, -1)).toBe(50));
  it("clamps to 255", () => expect(applyExposureChannel(200, 2)).toBe(255));
  it("clamps to 0", () => expect(applyExposureChannel(10, -5)).toBe(0));
});

describe("applyExposure", () => {
  it("applies to all channels", () => {
    expect(applyExposure({ r: 50, g: 100, b: 150 }, 1)).toEqual({ r: 100, g: 200, b: 255 });
  });
  it("preserves no alpha (basic shape)", () => {
    const out = applyExposure({ r: 50, g: 50, b: 50 }, 0);
    expect(out).toEqual({ r: 50, g: 50, b: 50 });
  });
});

describe("highlightProtect / shadowProtect", () => {
  it("highlightProtect is identity when amount 0", () => {
    expect(highlightProtect(220, 0)).toBe(220);
  });
  it("highlightProtect compresses high values", () => {
    expect(highlightProtect(240, 100)).toBeLessThan(240);
  });
  it("highlightProtect leaves low values alone", () => {
    expect(highlightProtect(100, 100)).toBe(100);
  });
  it("shadowProtect is identity when amount 0", () => {
    expect(shadowProtect(30, 0)).toBe(30);
  });
  it("shadowProtect lifts shadows", () => {
    expect(shadowProtect(20, 100)).toBeGreaterThan(20);
  });
  it("shadowProtect leaves high values alone", () => {
    expect(shadowProtect(200, 100)).toBe(200);
  });
});

describe("applyGamma", () => {
  it("gamma 1 is identity", () => {
    expect(applyGamma(128, 1)).toBe(128);
  });
  it("gamma 2 brightens midtones", () => {
    expect(applyGamma(64, 2)).toBeGreaterThan(64);
  });
  it("gamma 0.5 darkens midtones", () => {
    expect(applyGamma(192, 0.5)).toBeLessThan(192);
  });
});

describe("applyAll", () => {
  it("identity options produce identity output", () => {
    const out = applyAll({ r: 100, g: 150, b: 200, a: 255 }, DEFAULT_OPTIONS);
    expect(out.r).toBe(100);
    expect(out.g).toBe(150);
    expect(out.b).toBe(200);
    expect(out.a).toBe(255);
  });
  it("applies stops + gamma + protections together", () => {
    const out = applyAll({ r: 50, g: 50, b: 50, a: 255 }, { ...DEFAULT_OPTIONS, stops: 1, gamma: 2 });
    expect(out.r).toBeGreaterThan(50);
  });
  it("per-channel multipliers work", () => {
    const out = applyAll(
      { r: 100, g: 100, b: 100, a: 255 },
      { ...DEFAULT_OPTIONS, channels: { r: 1.5, g: 1, b: 0.5 } },
    );
    expect(out.r).toBeGreaterThan(out.g);
    expect(out.g).toBeGreaterThan(out.b);
  });
});

describe("validateExposureOptions", () => {
  it("accepts valid stops", () => expect(validateExposureOptions(DEFAULT_OPTIONS)).toEqual({ ok: true }));
  it("rejects out-of-range stops", () => {
    expect(validateExposureOptions({ ...DEFAULT_OPTIONS, stops: 10 })).toHaveProperty("error");
  });
  it("rejects negative-out-of-range stops", () => {
    expect(validateExposureOptions({ ...DEFAULT_OPTIONS, stops: -10 })).toHaveProperty("error");
  });
  it("rejects bad gamma", () => {
    expect(validateExposureOptions({ ...DEFAULT_OPTIONS, gamma: 0 })).toHaveProperty("error");
  });
  it("rejects bad highlight protection", () => {
    expect(validateExposureOptions({ ...DEFAULT_OPTIONS, highlightProtection: 200 })).toHaveProperty("error");
  });
  it("rejects bad channel multiplier", () => {
    expect(validateExposureOptions({ ...DEFAULT_OPTIONS, channels: { r: 10, g: 1, b: 1 } })).toHaveProperty("error");
  });
});

describe("formatStops", () => {
  it("formats positive with sign", () => expect(formatStops(1)).toBe("+1.00 EV"));
  it("formats negative without extra sign", () => expect(formatStops(-0.5)).toBe("-0.50 EV"));
  it("formats zero", () => expect(formatStops(0)).toBe("0.00 EV"));
});

describe("computeHistogram + meanLuma + autoExposure", () => {
  it("histogram counts each channel", () => {
    const data = new Uint8ClampedArray([0, 100, 200, 255, 50, 150, 250, 255]);
    const h = computeHistogram(data);
    expect(h.r[0]).toBe(1);
    expect(h.r[50]).toBe(1);
    expect(h.g[100]).toBe(1);
    expect(h.g[150]).toBe(1);
    expect(h.b[200]).toBe(1);
    expect(h.b[250]).toBe(1);
  });
  it("meanLuma computes weighted mean", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(meanLuma(data)).toBeCloseTo(255, 0);
  });
  it("autoExposure suggests positive stops for dark image", () => {
    const data = new Uint8ClampedArray([32, 32, 32, 255]);
    expect(autoExposure(data, 128)).toBeCloseTo(2, 1);
  });
  it("autoExposure suggests negative stops for bright image", () => {
    const data = new Uint8ClampedArray([255, 255, 255, 255]);
    expect(autoExposure(data, 128)).toBeLessThan(0);
  });
});

describe("exposureDelta + batchValidate + identity + format", () => {
  it("exposureDelta returns 0 for identity options", () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255]);
    expect(exposureDelta(data, DEFAULT_OPTIONS)).toBe(0);
  });
  it("exposureDelta returns positive for non-identity", () => {
    const data = new Uint8ClampedArray([100, 150, 200, 255]);
    expect(exposureDelta(data, { ...DEFAULT_OPTIONS, stops: 1 })).toBeGreaterThan(0);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("isIdentity true for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("nudgeValue + presets", () => {
  it("increments by 0.05", () => expect(nudgeValue(1, "arrowup", false)).toBeCloseTo(1.05));
  it("decrements by 0.05", () => expect(nudgeValue(1, "arrowdown", false)).toBeCloseTo(0.95));
  it("increments by 1 with shift", () => expect(nudgeValue(1, "arrowup", true)).toBe(2));
  it("ignores other keys", () => expect(nudgeValue(1, "x", false)).toBe(1));
  it("findPreset returns matching", () => {
    expect(findPreset("plus2")?.options.stops).toBe(2);
  });
  it("has at least 7 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(7);
  });
});

describe("clampByte", () => {
  it("clamps negative to 0", () => expect(clampByte(-5)).toBe(0));
  it("clamps over 255 to 255", () => expect(clampByte(300)).toBe(255));
  it("rounds to nearest integer", () => expect(clampByte(127.6)).toBe(128));
});
