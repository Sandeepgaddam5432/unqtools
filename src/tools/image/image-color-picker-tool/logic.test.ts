import { describe, it, expect } from "vitest";
import { rgbToHsl, hslToRgb, rgbToHex, hexToRgb, relativeLuminance, contrastText } from "./logic";

describe("rgbToHsl", () => {
  it("red is h=0, s=1, l=0.5", () => {
    const { h, s, l } = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(h).toBeCloseTo(0, 0); expect(s).toBeCloseTo(1, 1); expect(l).toBeCloseTo(0.5, 1);
  });
  it("gray is s=0", () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0);
  });
});

describe("hslToRgb round trip", () => {
  it("recovers original RGB", () => {
    const orig = { r: 123, g: 200, b: 50 };
    const hsl = rgbToHsl(orig);
    const back = hslToRgb(hsl);
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});

describe("rgbToHex", () => {
  it("formats 6-digit hex", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe("#ff0080");
  });
  it("zero-pads", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });
});

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ff0080")).toEqual({ r: 255, g: 0, b: 128 });
  });
  it("parses 3-digit hex", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("returns null for invalid input", () => {
    expect(hexToRgb("nope")).toBeNull();
  });
});

describe("relativeLuminance", () => {
  it("white is 1", () => expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2));
  it("black is 0", () => expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0));
});

describe("contrastText", () => {
  it("returns black for white background", () => {
    expect(contrastText({ r: 255, g: 255, b: 255 })).toBe("#000000");
  });
  it("returns white for black background", () => {
    expect(contrastText({ r: 0, g: 0, b: 0 })).toBe("#ffffff");
  });
});
