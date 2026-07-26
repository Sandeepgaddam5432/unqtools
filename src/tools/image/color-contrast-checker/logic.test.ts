import { describe, it, expect } from "vitest";
import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, rgbToHsv,
  getContrastRatio, getWcagGrade, complementary, analogous,
  triadic, shades, randomColor, isValidHex, namedToHex,
  getAllNamedColors,
} from "./logic";

describe("Color Contrast Checker (WCAG)", () => {
  it("converts hex to rgb", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb("#0000ff")).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("converts rgb to hex", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe("#00ff00");
  });

  it("round-trips hex → rgb → hex", () => {
    expect(rgbToHex(hexToRgb("#3b82f6")!)).toBe("#3b82f6");
  });

  it("converts rgb to hsl", () => {
    const hsl = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });

  it("converts hsl to rgb", () => {
    const rgb = hslToRgb({ h: 0, s: 100, l: 50 });
    expect(rgb.r).toBe(255);
    expect(rgb.g).toBe(0);
    expect(rgb.b).toBe(0);
  });

  it("calculates contrast ratio", () => {
    const ratio = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBe(21);
  });

  it("checks WCAG grades", () => {
    const grade = getWcagGrade(7);
    expect(grade.aa).toBe(true);
    expect(grade.aaa).toBe(true);
  });

  it("finds complementary color", () => {
    expect(complementary("#000000")).toBe("#ffffff");
    expect(complementary("#ff0000")).toBe("#00ffff");
  });

  it("finds analogous colors", () => {
    const result = analogous("#ff0000");
    expect(result).toHaveLength(2);
  });

  it("finds triadic colors", () => {
    const result = triadic("#ff0000");
    expect(result).toHaveLength(2);
  });

  it("generates shades", () => {
    const result = shades("#ff0000", 5);
    expect(result).toHaveLength(5);
  });

  it("generates random color", () => {
    const c = randomColor();
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("validates hex", () => {
    expect(isValidHex("#ff0000")).toBe(true);
    expect(isValidHex("ff0000")).toBe(true);
    expect(isValidHex("#f00")).toBe(true);
    expect(isValidHex("xyz")).toBe(false);
  });

  it("converts named color to hex", () => {
    expect(namedToHex("red")).toBe("#ff0000");
    expect(namedToHex("blue")).toBe("#0000ff");
  });

  it("lists all named colors", () => {
    const colors = getAllNamedColors();
    expect(colors.length).toBeGreaterThan(10);
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("invalid")).toBeNull();
  });
});
