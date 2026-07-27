import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, getContrastRatio, checkContrast } from "./logic";

describe("Color Contrast Checker", () => {
  it("converts hex to rgb", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("converts rgb to hex", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
  });
  it("calculates contrast ratio", () => {
    const ratio = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBe(21);
  });
  it("checks AA compliance", () => {
    const result = checkContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(result.aa).toBe(true);
    expect(result.aaa).toBe(true);
  });
  it("detects insufficient contrast", () => {
    const result = checkContrast({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
    expect(result.aa).toBe(false);
  });
});
