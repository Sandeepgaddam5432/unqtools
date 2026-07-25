import { describe, it, expect } from "vitest";
import { buildGammaLut, applyGammaChannel, applyGamma, validateGammaOptions, srgbToLinear } from "./logic";

describe("buildGammaLut", () => {
  it("has 256 entries", () => {
    expect(buildGammaLut(2.2).length).toBe(256);
  });
  it("gamma 1 is identity", () => {
    const lut = buildGammaLut(1);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(i);
  });
  it("gamma 0.5 inverts gamma 2 approximately", () => {
    const a = buildGammaLut(2);
    const b = buildGammaLut(0.5);
    // applying both should approximately recover input
    for (let i = 0; i < 256; i += 16) {
      expect(b[a[i]!]).toBeGreaterThan(i - 5);
      expect(b[a[i]!]).toBeLessThan(i + 5);
    }
  });
});

describe("applyGammaChannel", () => {
  it("gamma 1 is identity", () => {
    expect(applyGammaChannel(123, 1)).toBe(123);
  });
  it("gamma > 1 brightens midtones", () => {
    expect(applyGammaChannel(128, 2.2)).toBeGreaterThan(128);
  });
  it("gamma < 1 darkens midtones", () => {
    expect(applyGammaChannel(128, 0.5)).toBeLessThan(128);
  });
  it("clamps to 255", () => {
    expect(applyGammaChannel(255, 0.1)).toBeLessThanOrEqual(255);
  });
});

describe("applyGamma", () => {
  it("applies to all channels", () => {
    const out = applyGamma({ r: 128, g: 128, b: 128 }, 1);
    expect(out).toEqual({ r: 128, g: 128, b: 128 });
  });
});

describe("validateGammaOptions", () => {
  it("accepts valid gamma", () => {
    expect(validateGammaOptions({ gamma: 2.2 })).toEqual({ ok: true });
  });
  it("rejects out-of-range gamma", () => {
    expect(validateGammaOptions({ gamma: 0.01 })).toHaveProperty("error");
    expect(validateGammaOptions({ gamma: 11 })).toHaveProperty("error");
  });
});

describe("srgbToLinear", () => {
  it("black is 0", () => expect(srgbToLinear(0)).toBe(0));
  it("white is 1", () => expect(srgbToLinear(255)).toBeCloseTo(1, 2));
});
