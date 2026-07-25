import { describe, it, expect } from "vitest";
import { combinePixels, validateDimensions, ANAGLYPH_MODES } from "./logic";

describe("combinePixels — red-cyan", () => {
  it("takes red from left and green/blue from right", () => {
    const out = combinePixels(
      { r: 100, g: 50, b: 50, a: 255 },
      { r: 0, g: 200, b: 220, a: 255 },
    );
    expect(out).toEqual({ r: 100, g: 200, b: 220, a: 255 });
  });

  it("preserves max alpha", () => {
    const out = combinePixels(
      { r: 100, g: 50, b: 50, a: 128 },
      { r: 0, g: 200, b: 220, a: 255 },
    );
    expect(out.a).toBe(255);
  });
});

describe("combinePixels — other modes", () => {
  it("red-blue mode zeroes green", () => {
    const out = combinePixels(
      { r: 100, g: 50, b: 50, a: 255 },
      { r: 0, g: 200, b: 220, a: 255 },
      { mode: "red-blue" },
    );
    expect(out).toEqual({ r: 100, g: 0, b: 220, a: 255 });
  });

  it("green-magenta mode swaps channels", () => {
    const out = combinePixels(
      { r: 100, g: 50, b: 50, a: 255 },
      { r: 0, g: 200, b: 220, a: 255 },
      { mode: "green-magenta" },
    );
    expect(out).toEqual({ r: 0, g: 50, b: 220, a: 255 });
  });

  it("amber-blue mode averages red+green for amber", () => {
    const out = combinePixels(
      { r: 100, g: 60, b: 50, a: 255 },
      { r: 0, g: 200, b: 220, a: 255 },
      { mode: "amber-blue" },
    );
    expect(out.r).toBe(80);
    expect(out.b).toBe(220);
  });
});

describe("validateDimensions", () => {
  it("accepts matching dimensions", () => {
    expect(validateDimensions(100, 200, 100, 200)).toEqual({ width: 100, height: 200 });
  });

  it("errors on mismatched width", () => {
    const r = validateDimensions(100, 200, 101, 200);
    expect("error" in r).toBe(true);
  });

  it("errors on zero dimensions", () => {
    const r = validateDimensions(0, 200, 0, 200);
    expect("error" in r).toBe(true);
  });

  it("errors on mismatched height", () => {
    const r = validateDimensions(100, 100, 100, 200);
    expect("error" in r).toBe(true);
  });
});

describe("ANAGLYPH_MODES", () => {
  it("exposes red-cyan as the first mode", () => {
    expect(ANAGLYPH_MODES[0].value).toBe("red-cyan");
  });
});
