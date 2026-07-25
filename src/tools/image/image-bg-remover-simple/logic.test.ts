import { describe, it, expect } from "vitest";
import { colorDistance, averageColor, isBackground, validateBgRemoveOptions, validateImageBounds } from "./logic";

describe("colorDistance", () => {
  it("is 0 for identical colors", () => {
    expect(colorDistance({ r: 100, g: 50, b: 25 }, { r: 100, g: 50, b: 25 })).toBe(0);
  });

  it("computes Euclidean distance", () => {
    const d = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 0, b: 0 });
    expect(d).toBeCloseTo(255, 5);
  });

  it("max distance is ~441.67", () => {
    const d = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(d).toBeCloseTo(441.67, 1);
  });

  it("is symmetric", () => {
    const a = { r: 100, g: 50, b: 25 };
    const b = { r: 30, g: 200, b: 90 };
    expect(colorDistance(a, b)).toBeCloseTo(colorDistance(b, a), 5);
  });
});

describe("averageColor", () => {
  it("averages a region", () => {
    const data = new Uint8ClampedArray([
      100, 0, 0, 255, 200, 0, 0, 255,
      100, 0, 0, 255, 200, 0, 0, 255,
    ]);
    const c = averageColor(data, 2, 0, 0, 2);
    expect(c).toEqual({ r: 150, g: 0, b: 0 });
  });

  it("handles single pixel", () => {
    const data = new Uint8ClampedArray([50, 100, 150, 255]);
    expect(averageColor(data, 1, 0, 0, 1)).toEqual({ r: 50, g: 100, b: 150 });
  });

  it("handles empty region gracefully", () => {
    const data = new Uint8ClampedArray([]);
    expect(averageColor(data, 0, 0, 0, 1)).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("isBackground", () => {
  it("returns true for identical pixel", () => {
    expect(isBackground({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 }, 10)).toBe(true);
  });

  it("returns false when distance exceeds threshold", () => {
    expect(isBackground({ r: 0, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }, 10)).toBe(false);
  });

  it("respects boundary threshold", () => {
    expect(isBackground({ r: 0, g: 0, b: 0 }, { r: 5, g: 0, b: 0 }, 5)).toBe(true);
  });
});

describe("validateBgRemoveOptions", () => {
  it("accepts valid options", () => {
    expect(validateBgRemoveOptions({ threshold: 50, sampleSize: 4 })).toEqual({ ok: true });
  });

  it("rejects invalid threshold", () => {
    expect(validateBgRemoveOptions({ threshold: 500, sampleSize: 4 })).toHaveProperty("error");
    expect(validateBgRemoveOptions({ threshold: -1, sampleSize: 4 })).toHaveProperty("error");
  });

  it("rejects invalid sample size", () => {
    expect(validateBgRemoveOptions({ threshold: 50, sampleSize: 0 })).toHaveProperty("error");
  });
});

describe("validateImageBounds", () => {
  it("accepts valid bounds", () => {
    expect(validateImageBounds(100, 100)).toEqual({ ok: true });
  });

  it("rejects tiny images", () => {
    expect(validateImageBounds(1, 1)).toHaveProperty("error");
  });

  it("rejects huge images", () => {
    expect(validateImageBounds(10000, 10000)).toHaveProperty("error");
  });
});
