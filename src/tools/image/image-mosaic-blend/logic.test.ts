import { describe, it, expect } from "vitest";
import {
  alphaBlend,
  fadeBlend,
  averagePixels,
  fadeWeights,
  validateSameSize,
} from "./logic";

describe("alphaBlend", () => {
  it("keeps opaque top fully over base", () => {
    const out = alphaBlend(
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 0, b: 0, a: 255 },
    );
    expect(out).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });

  it("preserves base when top is transparent", () => {
    const out = alphaBlend(
      { r: 50, g: 60, b: 70, a: 255 },
      { r: 255, g: 255, b: 255, a: 0 },
    );
    expect(out).toEqual({ r: 50, g: 60, b: 70, a: 255 });
  });

  it("mixes semi-transparent top with base", () => {
    const out = alphaBlend(
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 255, g: 255, b: 255, a: 128 },
    );
    expect(out.r).toBeCloseTo(128, 0);
    expect(out.a).toBe(255);
  });
});

describe("fadeBlend", () => {
  it("returns base at weight 0", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, 0))
      .toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });

  it("returns top at weight 1", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, 1))
      .toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  it("mixes at weight 0.5", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 100, g: 100, b: 100, a: 255 }, 0.5))
      .toEqual({ r: 50, g: 50, b: 50, a: 255 });
  });

  it("clamps weight outside [0,1]", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 0 }, { r: 255, g: 255, b: 255, a: 255 }, 5))
      .toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
});

describe("averagePixels", () => {
  it("averages pixel values", () => {
    const out = averagePixels([
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 100, g: 100, b: 100, a: 255 },
      { r: 200, g: 200, b: 200, a: 255 },
    ]);
    expect(out).toEqual({ r: 100, g: 100, b: 100, a: 255 });
  });

  it("returns zeros for empty list", () => {
    expect(averagePixels([])).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});

describe("fadeWeights", () => {
  it("returns single weight for count 1", () => {
    expect(fadeWeights(1)).toEqual([1]);
  });

  it("returns symmetrical cosine-eased weights", () => {
    const w = fadeWeights(3);
    expect(w.length).toBe(3);
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[2]).toBeCloseTo(1, 6);
    expect(w[1]).toBeCloseTo(0.5, 6);
  });
});

describe("validateSameSize", () => {
  it("accepts matching sizes", () => {
    expect(validateSameSize([{ width: 10, height: 20 }, { width: 10, height: 20 }]))
      .toEqual({ width: 10, height: 20 });
  });

  it("errors on empty input", () => {
    expect("error" in validateSameSize([])).toBe(true);
  });

  it("errors on mismatched sizes", () => {
    expect("error" in validateSameSize([{ width: 10, height: 10 }, { width: 11, height: 10 }]))
      .toBe(true);
  });
});
