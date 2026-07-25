import { describe, it, expect } from "vitest";
import {
  solarizeChannel, solarizeChannelSmooth, solarize, applyToPixel, applyToRgba,
  buildSolarizeLut, buildSmoothSolarizeLut, computeBrightnessDelta,
  buildCssFilter, buildSolarizeFilename, validateSolarizeOptions, getPreset,
  DEFAULT_OPTIONS, type SolarizeOptions,
} from "./logic";

const baseOpts = (over: Partial<SolarizeOptions> = {}): SolarizeOptions => ({ ...DEFAULT_OPTIONS, ...over });

describe("solarizeChannel", () => {
  it("inverts values above threshold", () => expect(solarizeChannel(200, 128)).toBe(55));
  it("preserves values at or below threshold", () => expect(solarizeChannel(100, 128)).toBe(100));
  it("threshold 255 preserves all (no inversion)", () => expect(solarizeChannel(200, 255)).toBe(200));
  it("threshold 0 inverts all", () => expect(solarizeChannel(100, 0)).toBe(155));
});

describe("solarizeChannelSmooth", () => {
  it("returns sharp result when smoothness is 0", () => {
    expect(solarizeChannelSmooth(200, 128, 0)).toBe(55);
  });
  it("returns original far below threshold", () => {
    expect(solarizeChannelSmooth(0, 128, 50)).toBe(0);
  });
  it("returns inverted far above threshold", () => {
    expect(solarizeChannelSmooth(255, 128, 50)).toBe(0);
  });
  it("smoothly blends near threshold", () => {
    // Value 140 with threshold 128: sharp would invert (115), smooth blends.
    const sharp = solarizeChannelSmooth(140, 128, 0);
    const smooth = solarizeChannelSmooth(140, 128, 50);
    expect(sharp).toBe(115);
    expect(smooth).not.toBe(sharp);
  });
});

describe("solarize", () => {
  it("applies to all channels", () => {
    expect(solarize({ r: 200, g: 100, b: 50 }, 128)).toEqual({ r: 55, g: 100, b: 50 });
  });
});

describe("applyToPixel", () => {
  it("applies uniform threshold", () => {
    const out = applyToPixel({ r: 200, g: 100, b: 50, a: 255 }, baseOpts({ threshold: 128 }));
    expect(out).toEqual({ r: 55, g: 100, b: 50, a: 255 });
  });
  it("applies per-channel thresholds", () => {
    const out = applyToPixel({ r: 200, g: 100, b: 50, a: 255 }, baseOpts({ usePerChannel: true, perChannel: { r: 100, g: 50, b: 0 } }));
    expect(out.r).toBe(55); // 200 > 100 → 55
    expect(out.g).toBe(155); // 100 > 50 → 155
    expect(out.b).toBe(205); // 50 > 0 → 205
  });
  it("preserves alpha", () => {
    const out = applyToPixel({ r: 200, g: 100, b: 50, a: 128 }, baseOpts());
    expect(out.a).toBe(128);
  });
  it("respects intensity blend", () => {
    const out = applyToPixel({ r: 200, g: 100, b: 50, a: 255 }, baseOpts({ threshold: 128, intensity: 50 }));
    expect(out.r).toBeGreaterThan(55);
    expect(out.r).toBeLessThan(200);
  });
  it("no-ops at intensity 0", () => {
    const out = applyToPixel({ r: 200, g: 100, b: 50, a: 255 }, baseOpts({ intensity: 0 }));
    expect(out).toEqual({ r: 200, g: 100, b: 50, a: 255 });
  });
});

describe("buildSolarizeLut", () => {
  it("has 256 entries matching per-channel logic", () => {
    const lut = buildSolarizeLut(128);
    expect(lut.length).toBe(256);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(solarizeChannel(i, 128));
  });
});

describe("buildSmoothSolarizeLut", () => {
  it("has 256 entries", () => {
    expect(buildSmoothSolarizeLut(128, 50).length).toBe(256);
  });
  it("matches per-value smooth logic", () => {
    const lut = buildSmoothSolarizeLut(128, 30);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(solarizeChannelSmooth(i, 128, 30));
  });
});

describe("applyToRgba", () => {
  it("returns same length buffer", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const out = applyToRgba(rgba, 4, 4, baseOpts());
    expect(out.length).toBe(rgba.length);
  });
  it("uses LUT when applicable (intensity 100)", () => {
    const rgba = new Uint8ClampedArray([200, 100, 50, 255, 100, 200, 50, 255]);
    const out = applyToRgba(rgba, 2, 1, baseOpts({ threshold: 128 }));
    expect(out[0]).toBe(55); // 200 → 55
    expect(out[4]).toBe(100); // 100 unchanged
  });
  it("applies per-channel thresholds", () => {
    const rgba = new Uint8ClampedArray([200, 100, 50, 255]);
    const out = applyToRgba(rgba, 1, 1, baseOpts({ usePerChannel: true, perChannel: { r: 100, g: 50, b: 0 } }));
    expect(out[0]).toBe(55);
    expect(out[1]).toBe(155);
    expect(out[2]).toBe(205);
  });
});

describe("computeBrightnessDelta", () => {
  it("returns 0 for identical buffers", () => {
    const rgba = new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]);
    expect(computeBrightnessDelta(rgba, rgba)).toBe(0);
  });
  it("returns positive delta for differing buffers", () => {
    const orig = new Uint8ClampedArray([200, 200, 200, 255]);
    const result = new Uint8ClampedArray([55, 55, 55, 255]);
    expect(computeBrightnessDelta(orig, result)).toBeCloseTo(145, 0);
  });
});

describe("buildCssFilter", () => {
  it("emits an invert() filter string", () => {
    expect(buildCssFilter(baseOpts({ threshold: 128 }))).toContain("invert(");
  });
  it("uses minimum per-channel threshold", () => {
    const s = buildCssFilter(baseOpts({ usePerChannel: true, perChannel: { r: 64, g: 128, b: 200 } }));
    expect(s).toContain("invert(");
  });
});

describe("buildSolarizeFilename", () => {
  it("uniform mode", () => {
    expect(buildSolarizeFilename("photo.png", baseOpts({ threshold: 128 }))).toBe("photo-solarized-128.png");
  });
  it("per-channel mode", () => {
    expect(buildSolarizeFilename("photo.png", baseOpts({ usePerChannel: true, perChannel: { r: 64, g: 128, b: 200 } }))).toBe("photo-solarized-r64g128b200.png");
  });
  it("smoothness suffix", () => {
    expect(buildSolarizeFilename("photo.png", baseOpts({ threshold: 128, smoothness: 30 }))).toBe("photo-solarized-128-smooth30.png");
  });
});

describe("validateSolarizeOptions", () => {
  it("accepts valid threshold", () => {
    expect(validateSolarizeOptions(baseOpts({ threshold: 128 }))).toEqual({ ok: true });
  });
  it("rejects out-of-range threshold", () => {
    expect(validateSolarizeOptions(baseOpts({ threshold: 300 }))).toHaveProperty("error");
    expect(validateSolarizeOptions(baseOpts({ threshold: -1 }))).toHaveProperty("error");
  });
  it("rejects bad per-channel", () => {
    expect(validateSolarizeOptions(baseOpts({ usePerChannel: true, perChannel: { r: 300, g: 128, b: 128 } }))).toHaveProperty("error");
  });
  it("rejects bad intensity", () => {
    expect(validateSolarizeOptions(baseOpts({ intensity: 200 }))).toHaveProperty("error");
  });
  it("rejects bad smoothness", () => {
    expect(validateSolarizeOptions(baseOpts({ smoothness: 200 }))).toHaveProperty("error");
  });
});

describe("getPreset", () => {
  it("returns valid options for each preset", () => {
    const presets = ["classic", "harsh", "subtle", "inverted", "two-tone"] as const;
    for (const p of presets) {
      expect(validateSolarizeOptions(getPreset(p))).toEqual({ ok: true });
    }
  });
  it("harsh has lower threshold than classic", () => {
    expect(getPreset("harsh").threshold).toBeLessThan(getPreset("classic").threshold);
  });
  it("two-tone uses per-channel", () => {
    expect(getPreset("two-tone").usePerChannel).toBe(true);
  });
});
