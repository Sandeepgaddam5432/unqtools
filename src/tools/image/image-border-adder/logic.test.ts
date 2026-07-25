import { describe, it, expect } from "vitest";
import { computeOutputSize, mapToInput, isBorderPixel, parseHex, validateBorderOptions } from "./logic";

const opts = { top: 10, right: 20, bottom: 30, left: 40, color: { r: 0, g: 0, b: 0 } };

describe("computeOutputSize", () => {
  it("adds border to width and height", () => {
    expect(computeOutputSize(100, 50, opts)).toEqual({ width: 160, height: 90 });
  });
  it("handles zero border", () => {
    const z = { top: 0, right: 0, bottom: 0, left: 0, color: { r: 0, g: 0, b: 0 } };
    expect(computeOutputSize(100, 50, z)).toEqual({ width: 100, height: 50 });
  });
  it("handles asymmetric border", () => {
    const a = { top: 5, right: 15, bottom: 25, left: 35, color: { r: 0, g: 0, b: 0 } };
    expect(computeOutputSize(50, 50, a)).toEqual({ width: 100, height: 80 });
  });
});

describe("mapToInput", () => {
  it("maps interior pixels correctly", () => {
    expect(mapToInput(40, 10, opts)).toEqual({ x: 0, y: 0 });
    expect(mapToInput(50, 20, opts)).toEqual({ x: 10, y: 10 });
  });
  it("returns null for border pixels", () => {
    expect(mapToInput(0, 0, opts)).toBeNull();
    expect(mapToInput(39, 10, opts)).toBeNull();
    expect(mapToInput(40, 9, opts)).toBeNull();
  });
});

describe("isBorderPixel", () => {
  it("marks top-left border as border", () => {
    expect(isBorderPixel(0, 0, 100, 50, opts)).toBe(true);
  });
  it("marks interior as not border", () => {
    expect(isBorderPixel(50, 20, 100, 50, opts)).toBe(false);
  });
  it("marks right-bottom border as border", () => {
    expect(isBorderPixel(159, 89, 100, 50, opts)).toBe(true);
  });
  it("marks right edge past input width", () => {
    expect(isBorderPixel(140, 30, 100, 50, opts)).toBe(true);
  });
});

describe("parseHex", () => {
  it("parses 6-digit hex", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses 3-digit hex", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("returns null on invalid", () => {
    expect(parseHex("xyz")).toBeNull();
  });
});

describe("validateBorderOptions", () => {
  it("accepts valid options", () => {
    expect(validateBorderOptions(opts)).toEqual({ ok: true });
  });
  it("rejects negative border", () => {
    expect(validateBorderOptions({ ...opts, top: -1 })).toHaveProperty("error");
  });
  it("rejects overly large border", () => {
    expect(validateBorderOptions({ ...opts, left: 5000 })).toHaveProperty("error");
  });
});
