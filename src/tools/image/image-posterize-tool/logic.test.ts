import { describe, it, expect } from "vitest";
import {
  quantize, buildQuantizeLut, posterizePixel, posterizePixelPerChannel,
  paletteForLevels, rgbToHsl, hslToRgb, nearestColor, getPresetPalette,
  applyToPixel, applyToRgba, buildCssFilter, buildPosterizeFilename,
  countUniqueColors, validatePosterizeOptions, DEFAULT_OPTIONS,
  type PosterizeOptions,
} from "./logic";

const baseOpts = (over: Partial<PosterizeOptions> = {}): PosterizeOptions => ({ ...DEFAULT_OPTIONS, ...over });

describe("quantize", () => {
  it("snaps to 2 levels (0 or 255)", () => {
    expect(quantize(0, 2)).toBe(0);
    expect(quantize(255, 2)).toBe(255);
    expect(quantize(128, 2)).toBe(255);
    expect(quantize(64, 2)).toBe(0);
  });
  it("snaps to 4 levels (0, 85, 170, 255)", () => {
    expect(quantize(0, 4)).toBe(0);
    expect(quantize(80, 4)).toBe(85);
    expect(quantize(200, 4)).toBe(170);
    expect(quantize(255, 4)).toBe(255);
  });
  it("returns identity for 256 levels", () => {
    expect(quantize(123, 256)).toBe(123);
  });
  it("returns 0 for levels <= 1", () => {
    expect(quantize(200, 1)).toBe(0);
  });
  it("clamps out-of-range input", () => {
    expect(quantize(300, 4)).toBe(255);
    expect(quantize(-10, 4)).toBe(0);
  });
});

describe("buildQuantizeLut", () => {
  it("has 256 entries", () => expect(buildQuantizeLut(4).length).toBe(256));
  it("matches per-value quantization", () => {
    const lut = buildQuantizeLut(8);
    for (let i = 0; i < 256; i++) expect(lut[i]).toBe(quantize(i, 8));
  });
});

describe("posterizePixel", () => {
  it("quantizes all channels", () => {
    const out = posterizePixel({ r: 100, g: 150, b: 200, a: 255 }, 2);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeLessThanOrEqual(255);
    expect(out.b).toBeLessThanOrEqual(255);
  });
  it("preserves alpha", () => {
    expect(posterizePixel({ r: 100, g: 100, b: 100, a: 128 }, 4).a).toBe(128);
  });
  it("reduces unique colors with fewer levels", () => {
    expect(posterizePixel({ r: 80, g: 80, b: 80, a: 255 }, 4).r).toBe(85);
  });
});

describe("posterizePixelPerChannel", () => {
  it("applies per-channel levels", () => {
    const out = posterizePixelPerChannel({ r: 80, g: 160, b: 240, a: 255 }, { r: 2, g: 4, b: 8 });
    expect(out.r).toBe(0); // 80 → 0 at 2 levels
    expect(out.g).toBe(170); // 160 → 170 at 4 levels
    expect(out.b).toBe(255); // 240 → 255 at 8 levels
  });
  it("preserves alpha", () => {
    expect(posterizePixelPerChannel({ r: 100, g: 100, b: 100, a: 200 }, { r: 4, g: 4, b: 4 }).a).toBe(200);
  });
});

describe("paletteForLevels", () => {
  it("returns N values", () => expect(paletteForLevels(4).length).toBe(4));
  it("includes 0 and 255", () => {
    const p = paletteForLevels(8);
    expect(p[0]).toBe(0);
    expect(p[p.length - 1]).toBe(255);
  });
  it("returns [0] for levels=1", () => expect(paletteForLevels(1)).toEqual([0]));
});

describe("rgbToHsl / hslToRgb round trip", () => {
  it("recovers original RGB", () => {
    const orig = { r: 100, g: 150, b: 200 };
    const hsl = rgbToHsl(orig);
    const back = hslToRgb(hsl.h, hsl.s, hsl.l);
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});

describe("nearestColor", () => {
  it("finds the exact match if present", () => {
    const palette = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
    expect(nearestColor({ r: 0, g: 0, b: 0 }, palette)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("finds nearest by Euclidean distance", () => {
    const palette = [{ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }];
    expect(nearestColor({ r: 100, g: 100, b: 100 }, palette)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("returns target when palette is empty", () => {
    expect(nearestColor({ r: 100, g: 100, b: 100 }, [])).toEqual({ r: 100, g: 100, b: 100 });
  });
});

describe("getPresetPalette", () => {
  it("gameboy has 4 colors", () => expect(getPresetPalette("gameboy").length).toBe(4));
  it("cga has 4 colors", () => expect(getPresetPalette("cga").length).toBe(4));
  it("ega has 16 colors", () => expect(getPresetPalette("ega").length).toBe(16));
  it("websafe has 216 colors", () => expect(getPresetPalette("websafe").length).toBe(216));
  it("none returns empty", () => expect(getPresetPalette("none")).toEqual([]));
});

describe("applyToPixel", () => {
  it("posterizes without dithering", () => {
    const { result } = applyToPixel({ r: 80, g: 80, b: 80, a: 255 }, baseOpts({ levels: 4 }));
    expect(result.r).toBe(85);
  });
  it("respects intensity blend", () => {
    const { result } = applyToPixel({ r: 80, g: 80, b: 80, a: 255 }, baseOpts({ levels: 4, intensity: 50 }));
    expect(result.r).toBeGreaterThan(80);
    expect(result.r).toBeLessThan(85);
  });
  it("snaps to palette when set", () => {
    const { result } = applyToPixel({ r: 80, g: 80, b: 80, a: 255 }, baseOpts({ palette: "cga" }));
    expect(getPresetPalette("cga")).toContainEqual({ r: result.r, g: result.g, b: result.b });
  });
  it("propagates error for dithering", () => {
    const { error } = applyToPixel({ r: 80, g: 80, b: 80, a: 255 }, baseOpts({ levels: 4 }));
    expect(error.r).toBe(80 - 85);
  });
});

describe("applyToRgba", () => {
  it("returns same length buffer", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const out = applyToRgba(rgba, 4, 4, baseOpts());
    expect(out.length).toBe(rgba.length);
  });
  it("applies dithering without crashing", () => {
    const rgba = new Uint8ClampedArray(8 * 8 * 4).fill(128);
    const out = applyToRgba(rgba, 8, 8, baseOpts({ dither: true }));
    expect(out.length).toBe(rgba.length);
  });
  it("uses palette when set", () => {
    const rgba = new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]);
    const out = applyToRgba(rgba, 2, 1, baseOpts({ palette: "cga" }));
    const palette = getPresetPalette("cga");
    expect(palette).toContainEqual({ r: out[0], g: out[1], b: out[2] });
    expect(palette).toContainEqual({ r: out[4], g: out[5], b: out[6] });
  });
});

describe("buildCssFilter", () => {
  it("emits a posterize() filter string", () => {
    expect(buildCssFilter(baseOpts({ levels: 4 }))).toBe("posterize(4)");
  });
  it("uses minimum per-channel levels", () => {
    expect(buildCssFilter(baseOpts({ usePerChannel: true, perChannel: { r: 4, g: 8, b: 16 } }))).toBe("posterize(4)");
  });
});

describe("buildPosterizeFilename", () => {
  it("uniform mode", () => {
    expect(buildPosterizeFilename("photo.png", baseOpts({ levels: 4 }))).toBe("photo-posterized-4.png");
  });
  it("per-channel mode", () => {
    expect(buildPosterizeFilename("photo.png", baseOpts({ usePerChannel: true, perChannel: { r: 2, g: 4, b: 8 } }))).toBe("photo-posterized-r2g4b8.png");
  });
  it("dither suffix", () => {
    expect(buildPosterizeFilename("photo.png", baseOpts({ levels: 4, dither: true }))).toBe("photo-posterized-4-dither.png");
  });
});

describe("countUniqueColors", () => {
  it("counts distinct colors", () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 255,
      0, 0, 0, 255, 128, 128, 128, 255,
    ]);
    expect(countUniqueColors(rgba)).toBe(3);
  });
});

describe("validatePosterizeOptions", () => {
  it("accepts valid levels", () => {
    expect(validatePosterizeOptions(baseOpts({ levels: 4 }))).toEqual({ ok: true });
    expect(validatePosterizeOptions(baseOpts({ levels: 256 }))).toEqual({ ok: true });
  });
  it("rejects levels < 2", () => {
    expect(validatePosterizeOptions(baseOpts({ levels: 1 }))).toHaveProperty("error");
  });
  it("rejects non-integer", () => {
    expect(validatePosterizeOptions(baseOpts({ levels: 4.5 }))).toHaveProperty("error");
  });
  it("rejects levels > 256", () => {
    expect(validatePosterizeOptions(baseOpts({ levels: 500 }))).toHaveProperty("error");
  });
  it("rejects bad per-channel", () => {
    expect(validatePosterizeOptions(baseOpts({ usePerChannel: true, perChannel: { r: 1, g: 4, b: 4 } }))).toHaveProperty("error");
  });
  it("rejects bad intensity", () => {
    expect(validatePosterizeOptions(baseOpts({ intensity: 200 }))).toHaveProperty("error");
  });
});
