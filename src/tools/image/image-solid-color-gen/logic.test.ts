/**
 * Solid Color Image Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  parseHex, toHex, toRgbString, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb,
  complementary, analogous, addToHistory, toCssVar, paletteToJson, paletteToCss,
  randomColor, validateInput, clampDimension, buildFilename,
} from "./logic";

describe("parseHex", () => {
  it("parses #rrggbb", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });
  it("parses #rgb shorthand", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });
  it("parses #rrggbbaa", () => {
    const c = parseHex("#ff880080");
    expect(c).not.toBeNull();
    expect(c!.a).toBeCloseTo(0.5, 2);
  });
  it("returns null for invalid", () => {
    expect(parseHex("nope")).toBeNull();
  });
});

describe("toHex", () => {
  it("formats 6-digit hex for opaque", () => {
    expect(toHex({ r: 255, g: 136, b: 0, a: 1 })).toBe("#ff8800");
  });
  it("formats 8-digit hex for translucent", () => {
    expect(toHex({ r: 255, g: 136, b: 0, a: 0.5 })).toMatch(/^#ff8800[0-9a-f]{2}$/);
  });
});

describe("toRgbString", () => {
  it("uses rgb() when opaque", () => {
    expect(toRgbString({ r: 10, g: 20, b: 30, a: 1 })).toBe("rgb(10, 20, 30)");
  });
  it("uses rgba() when translucent", () => {
    expect(toRgbString({ r: 10, g: 20, b: 30, a: 0.5 })).toContain("rgba");
  });
});

describe("rgbToHsl / hslToRgb", () => {
  it("converts pure red", () => {
    const hsl = rgbToHsl(255, 0, 0);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });
  it("converts pure green", () => {
    const hsl = rgbToHsl(0, 255, 0);
    expect(hsl.h).toBe(120);
  });
  it("converts gray to s=0", () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.s).toBe(0);
  });
  it("round-trips RGB ↔ HSL", () => {
    const orig = { r: 100, g: 150, b: 200 };
    const back = hslToRgb(rgbToHsl(orig.r, orig.g, orig.b).h, rgbToHsl(orig.r, orig.g, orig.b).s, rgbToHsl(orig.r, orig.g, orig.b).l);
    expect(back.r).toBeCloseTo(orig.r, -1);
    expect(back.g).toBeCloseTo(orig.g, -1);
    expect(back.b).toBeCloseTo(orig.b, -1);
  });
});

describe("rgbToHsv / hsvToRgb", () => {
  it("converts pure red", () => {
    const hsv = rgbToHsv(255, 0, 0);
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
  });
  it("round-trips RGB ↔ HSV", () => {
    const orig = { r: 80, g: 160, b: 240 };
    const hsv = rgbToHsv(orig.r, orig.g, orig.b);
    const back = hsvToRgb(hsv.h, hsv.s, hsv.v);
    expect(back.r).toBeCloseTo(orig.r, -1);
    expect(back.g).toBeCloseTo(orig.g, -1);
    expect(back.b).toBeCloseTo(orig.b, -1);
  });
});

describe("complementary / analogous", () => {
  it("complementary rotates 180°", () => {
    const c = complementary({ r: 255, g: 0, b: 0 });
    const hsl = rgbToHsl(c.r, c.g, c.b);
    expect(hsl.h).toBeCloseTo(180, 0);
  });
  it("analogous returns 2 colors", () => {
    const arr = analogous({ r: 255, g: 0, b: 0 });
    expect(arr.length).toBe(2);
  });
});

describe("addToHistory", () => {
  it("prepends new color", () => {
    const h = addToHistory([], { r: 1, g: 2, b: 3, a: 1 });
    expect(h.length).toBe(1);
  });
  it("dedups by hex", () => {
    const c = { r: 255, g: 0, b: 0, a: 1 };
    const h = addToHistory([c], c);
    expect(h.length).toBe(1);
  });
  it("caps at maxLen", () => {
    let h: ReturnType<typeof addToHistory> = [];
    for (let i = 0; i < 20; i++) h = addToHistory(h, { r: i, g: i, b: i, a: 1 });
    expect(h.length).toBeLessThanOrEqual(12);
  });
});

describe("toCssVar / paletteToJson / paletteToCss", () => {
  it("builds CSS var string", () => {
    expect(toCssVar({ r: 255, g: 0, b: 0, a: 1 })).toBe("--color: rgb(255, 0, 0);");
  });
  it("builds JSON palette", () => {
    const json = paletteToJson([{ r: 255, g: 0, b: 0, a: 1 }]);
    const parsed = JSON.parse(json);
    expect(parsed[0].hex).toBe("#ff0000");
  });
  it("builds CSS palette", () => {
    const css = paletteToCss([{ r: 255, g: 0, b: 0, a: 1 }]);
    expect(css).toContain("--color-1");
    expect(css).toContain(":root");
  });
});

describe("randomColor", () => {
  it("returns valid RGBA", () => {
    const c = randomColor();
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(255);
    expect(c.a).toBe(1);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect("ok" in validateInput(600, 400, "image/png", 1)).toBe(true);
  });
  it("errors on zero width", () => {
    expect("error" in validateInput(0, 400, "image/png", 1)).toBe(true);
  });
  it("errors on too-large dimensions", () => {
    expect("error" in validateInput(9000, 400, "image/png", 1)).toBe(true);
  });
  it("errors on JPEG with alpha", () => {
    expect("error" in validateInput(600, 400, "image/jpeg", 0.5)).toBe(true);
  });
  it("allows PNG with alpha", () => {
    expect("ok" in validateInput(600, 400, "image/png", 0.5)).toBe(true);
  });
});

describe("clampDimension & buildFilename", () => {
  it("clamps to 1 minimum", () => {
    expect(clampDimension(0)).toBe(1);
  });
  it("clamps to 8000 maximum", () => {
    expect(clampDimension(9999)).toBe(8000);
  });
  it("builds filename", () => {
    expect(buildFilename(600, 400, "image/png")).toBe("solid-color-600x400.png");
  });
});
