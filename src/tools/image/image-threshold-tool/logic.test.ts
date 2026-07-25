import { describe, it, expect } from "vitest";
import { luma, applyThreshold, clampThreshold, validateThresholdOptions } from "./logic";

describe("luma", () => {
  it("black is 0", () => {
    expect(luma({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it("white is 255", () => {
    expect(luma({ r: 255, g: 255, b: 255 })).toBeCloseTo(255, 0);
  });
  it("weights green most heavily", () => {
    const greenLuma = luma({ r: 0, g: 255, b: 0 });
    const redLuma = luma({ r: 255, g: 0, b: 0 });
    expect(greenLuma).toBeGreaterThan(redLuma);
  });
});

describe("applyThreshold", () => {
  it("returns white for pixels above threshold", () => {
    const out = applyThreshold({ r: 200, g: 200, b: 200, a: 255 }, { threshold: 128, invert: false });
    expect(out).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
  it("returns black for pixels below threshold", () => {
    const out = applyThreshold({ r: 50, g: 50, b: 50, a: 255 }, { threshold: 128, invert: false });
    expect(out).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
  it("inverts when invert is true", () => {
    const out = applyThreshold({ r: 200, g: 200, b: 200, a: 255 }, { threshold: 128, invert: true });
    expect(out).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
  it("preserves alpha", () => {
    const out = applyThreshold({ r: 200, g: 200, b: 200, a: 128 }, { threshold: 128, invert: false });
    expect(out.a).toBe(128);
  });
  it("treats equal to threshold as above", () => {
    const out = applyThreshold({ r: 128, g: 128, b: 128, a: 255 }, { threshold: 128, invert: false });
    expect(out.r).toBe(255);
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

describe("validateThresholdOptions", () => {
  it("accepts valid threshold", () => {
    expect(validateThresholdOptions({ threshold: 128, invert: false })).toEqual({ ok: true });
    expect(validateThresholdOptions({ threshold: 0, invert: true })).toEqual({ ok: true });
    expect(validateThresholdOptions({ threshold: 255, invert: false })).toEqual({ ok: true });
  });
  it("rejects out-of-range", () => {
    expect(validateThresholdOptions({ threshold: 300, invert: false })).toHaveProperty("error");
    expect(validateThresholdOptions({ threshold: -1, invert: false })).toHaveProperty("error");
  });
  it("rejects NaN", () => {
    expect(validateThresholdOptions({ threshold: Number.NaN, invert: false })).toHaveProperty("error");
  });
});
