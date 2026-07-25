import { describe, it, expect } from "vitest";
import { normalizeDegrees, rgbToHsl, hslToRgb, rotateHue, validateHueOptions } from "./logic";

describe("normalizeDegrees", () => {
  it("normalizes within 0-360", () => {
    expect(normalizeDegrees(380)).toBe(20);
    expect(normalizeDegrees(-20)).toBe(340);
    expect(normalizeDegrees(360)).toBe(0);
  });

  it("returns 0 for NaN", () => {
    expect(normalizeDegrees(Number.NaN)).toBe(0);
  });
});

describe("rgbToHsl", () => {
  it("converts black", () => {
    expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 });
  });

  it("converts white", () => {
    expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 1 });
  });

  it("converts pure red", () => {
    expect(rgbToHsl(255, 0, 0).h).toBe(0);
    expect(rgbToHsl(255, 0, 0).s).toBe(1);
  });

  it("converts pure green", () => {
    expect(rgbToHsl(0, 255, 0).h).toBe(120);
  });

  it("converts pure blue", () => {
    expect(rgbToHsl(0, 0, 255).h).toBe(240);
  });
});

describe("hslToRgb", () => {
  it("round-trips black", () => {
    expect(hslToRgb({ h: 0, s: 0, l: 0 })).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("round-trips white", () => {
    expect(hslToRgb({ h: 0, s: 0, l: 1 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("round-trips red", () => {
    expect(hslToRgb({ h: 0, s: 1, l: 0.5 })).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("round-trips green", () => {
    expect(hslToRgb({ h: 120, s: 1, l: 0.5 })).toEqual({ r: 0, g: 255, b: 0 });
  });
});

describe("rotateHue", () => {
  it("rotates red to green by 120 degrees", () => {
    const out = rotateHue({ r: 255, g: 0, b: 0, a: 255 }, 120);
    expect(out.g).toBeGreaterThan(200);
    expect(out.r).toBeLessThan(50);
  });

  it("preserves alpha", () => {
    expect(rotateHue({ r: 100, g: 100, b: 100, a: 128 }, 180).a).toBe(128);
  });

  it("preserves gray under rotation (low saturation)", () => {
    const out = rotateHue({ r: 128, g: 128, b: 128, a: 255 }, 180);
    expect(out.r).toBe(128);
    expect(out.g).toBe(128);
    expect(out.b).toBe(128);
  });
});

describe("validateHueOptions", () => {
  it("accepts valid degrees", () => {
    expect(validateHueOptions({ degrees: 180 })).toEqual({ ok: true });
    expect(validateHueOptions({ degrees: 0 })).toEqual({ ok: true });
  });

  it("rejects NaN", () => {
    expect(validateHueOptions({ degrees: Number.NaN })).toHaveProperty("error");
  });
});
