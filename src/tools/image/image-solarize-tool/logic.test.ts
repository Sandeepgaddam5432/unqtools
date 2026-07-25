import { describe, it, expect } from "vitest";
import { solarizeChannel, solarize, validateSolarizeOptions, buildSolarizeLut } from "./logic";

describe("solarizeChannel", () => {
  it("inverts values above threshold", () => {
    expect(solarizeChannel(200, 128)).toBe(55);
  });
  it("preserves values at or below threshold", () => {
    expect(solarizeChannel(100, 128)).toBe(100);
  });
  it("threshold 255 preserves all (no inversion)", () => {
    expect(solarizeChannel(200, 255)).toBe(200);
  });
  it("threshold 0 inverts all", () => {
    expect(solarizeChannel(100, 0)).toBe(155);
  });
});

describe("solarize", () => {
  it("applies to all channels", () => {
    const out = solarize({ r: 200, g: 100, b: 50 }, 128);
    expect(out).toEqual({ r: 55, g: 100, b: 50 });
  });
});

describe("validateSolarizeOptions", () => {
  it("accepts valid threshold", () => {
    expect(validateSolarizeOptions({ threshold: 128 })).toEqual({ ok: true });
  });
  it("rejects out-of-range threshold", () => {
    expect(validateSolarizeOptions({ threshold: 300 })).toHaveProperty("error");
    expect(validateSolarizeOptions({ threshold: -1 })).toHaveProperty("error");
  });
});

describe("buildSolarizeLut", () => {
  it("has 256 entries matching per-channel logic", () => {
    const lut = buildSolarizeLut(128);
    expect(lut.length).toBe(256);
    for (let i = 0; i < 256; i++) {
      expect(lut[i]).toBe(solarizeChannel(i, 128));
    }
  });
});
