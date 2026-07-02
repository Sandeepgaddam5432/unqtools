import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToCss,
  hslToCss,
  relativeLuminance,
  contrastRatio,
  checkContrast,
  generateShades,
  complementary,
} from "./logic";

describe("hexToRgb", () => {
  it("parses 3-digit hex", () => {
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255, a: undefined });
    expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0, a: undefined });
  });

  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0, a: undefined });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0, a: undefined });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255, a: undefined });
  });

  it("parses 8-digit hex with alpha", () => {
    const r = hexToRgb("#ff000080");
    expect(r?.r).toBe(255);
    expect(r?.g).toBe(0);
    expect(r?.b).toBe(0);
    expect(r?.a).toBeCloseTo(0.5, 2);
  });

  it("handles hex without #", () => {
    expect(hexToRgb("ffffff")).toEqual({ r: 255, g: 255, b: 255, a: undefined });
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("#gggggg")).toBeNull();
    expect(hexToRgb("#ff")).toBeNull();
    expect(hexToRgb("")).toBeNull();
  });
});

describe("rgbToHex", () => {
  it("converts RGB to 6-digit hex", () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#FFFFFF");
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#FF0000");
  });

  it("includes alpha when requested", () => {
    const hex = rgbToHex({ r: 255, g: 0, b: 0, a: 0.5 }, true);
    expect(hex.startsWith("#FF0000")).toBe(true);
    expect(hex.length).toBe(9);
  });

  it("clamps out-of-range values", () => {
    expect(rgbToHex({ r: 300, g: -5, b: 128 })).toBe("#FF0080");
  });
});

describe("RGB ↔ HSL round-trip", () => {
  const samples = [
    { r: 255, g: 0, b: 0 }, // red
    { r: 0, g: 255, b: 0 }, // green
    { r: 0, g: 0, b: 255 }, // blue
    { r: 255, g: 255, b: 255 }, // white
    { r: 0, g: 0, b: 0 }, // black
    { r: 128, g: 128, b: 128 }, // gray
    { r: 255, g: 128, b: 0 }, // orange
  ];

  for (const sample of samples) {
    it(`round-trips rgb(${sample.r}, ${sample.g}, ${sample.b})`, () => {
      const hsl = rgbToHsl(sample);
      const back = hslToRgb(hsl);
      // Allow ±1 for rounding
      expect(Math.abs(back.r - sample.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - sample.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - sample.b)).toBeLessThanOrEqual(1);
    });
  }
});

describe("RGB ↔ HSV round-trip", () => {
  const samples = [
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 100, g: 150, b: 200 },
    { r: 255, g: 255, b: 0 },
  ];

  for (const sample of samples) {
    it(`round-trips rgb(${sample.r}, ${sample.g}, ${sample.b})`, () => {
      const hsv = rgbToHsv(sample);
      const back = hsvToRgb(hsv);
      expect(Math.abs(back.r - sample.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.g - sample.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(back.b - sample.b)).toBeLessThanOrEqual(2);
    });
  }
});

describe("specific known conversions", () => {
  it("red → HSL", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50, a: undefined });
  });

  it("green → HSL", () => {
    expect(rgbToHsl({ r: 0, g: 255, b: 0 })).toEqual({ h: 120, s: 100, l: 50, a: undefined });
  });

  it("blue → HSL", () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50, a: undefined });
  });

  it("white → HSL", () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100, a: undefined });
  });

  it("black → HSL", () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0, a: undefined });
  });
});

describe("rgbToCss / hslToCss", () => {
  it("formats RGB without alpha", () => {
    expect(rgbToCss({ r: 255, g: 0, b: 0 })).toBe("rgb(255, 0, 0)");
  });

  it("formats RGBA with alpha", () => {
    expect(rgbToCss({ r: 255, g: 0, b: 0, a: 0.5 })).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("formats HSL without alpha", () => {
    expect(hslToCss({ h: 0, s: 100, l: 50 })).toBe("hsl(0, 100%, 50%)");
  });

  it("formats HSLA with alpha", () => {
    expect(hslToCss({ h: 0, s: 100, l: 50, a: 0.5 })).toBe("hsla(0, 100%, 50%, 0.5)");
  });
});

describe("relativeLuminance", () => {
  it("white has luminance 1", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it("black has luminance 0", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  it("red has luminance 0.2126", () => {
    expect(relativeLuminance({ r: 255, g: 0, b: 0 })).toBeCloseTo(0.2126, 3);
  });
});

describe("contrastRatio", () => {
  it("black on white = 21", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it("same color = 1", () => {
    expect(contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 })).toBeCloseTo(1, 5);
  });

  it("is symmetric", () => {
    const a = { r: 100, g: 50, b: 200 };
    const b = { r: 255, g: 255, b: 255 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });
});

describe("checkContrast", () => {
  it("black on white passes all WCAG levels", () => {
    const r = checkContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r.aaNormal).toBe(true);
    expect(r.aaLarge).toBe(true);
    expect(r.aaaNormal).toBe(true);
    expect(r.aaaLarge).toBe(true);
  });

  it("gray on white has known ratio — passes AA large but fails AA normal", () => {
    const r = checkContrast({ r: 128, g: 128, b: 128 }, { r: 255, g: 255, b: 255 });
    // ratio is ~3.95 — passes AA large (>=3.0) but fails AA normal (>=4.5)
    expect(r.aaLarge).toBe(true);
    expect(r.aaNormal).toBe(false);
  });
});

describe("generateShades", () => {
  it("generates the requested count", () => {
    expect(generateShades({ r: 128, g: 64, b: 200 }, 11).length).toBe(11);
  });

  it("50% is the original color", () => {
    const shades = generateShades({ r: 128, g: 64, b: 200 }, 11);
    const mid = shades[5]!;
    expect(mid.hex).toBe("#8040C8");
  });

  it("0% is black", () => {
    const shades = generateShades({ r: 128, g: 64, b: 200 }, 11);
    expect(shades[0]!.hex).toBe("#000000");
  });

  it("100% is white", () => {
    const shades = generateShades({ r: 128, g: 64, b: 200 }, 11);
    expect(shades[10]!.hex).toBe("#FFFFFF");
  });
});

describe("complementary", () => {
  it("red → cyan (180°)", () => {
    const comp = complementary({ r: 255, g: 0, b: 0 });
    const hsl = rgbToHsl(comp);
    expect(hsl.h).toBe(180);
  });

  it("is symmetric (complement of complement = original)", () => {
    const original = { r: 100, g: 50, b: 200 };
    const comp1 = complementary(original);
    const comp2 = complementary(comp1);
    expect(Math.abs(comp2.r - original.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(comp2.g - original.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(comp2.b - original.b)).toBeLessThanOrEqual(2);
  });
});
