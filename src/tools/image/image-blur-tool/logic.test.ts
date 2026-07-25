import { describe, it, expect } from "vitest";
import { computeBlurParams, horizontalOffsets, effectiveSigma, validateDimensions } from "./logic";

describe("computeBlurParams", () => {
  it("rounds radius", () => {
    expect(computeBlurParams({ radius: 3.6, passes: 3 })).toEqual({ radius: 4, passes: 3 });
  });

  it("clamps passes to [1, 5]", () => {
    expect(computeBlurParams({ radius: 5, passes: 0 }).passes).toBe(1);
    expect(computeBlurParams({ radius: 5, passes: 10 }).passes).toBe(5);
  });

  it("errors on negative radius", () => {
    expect(computeBlurParams({ radius: -1, passes: 3 })).toHaveProperty("error");
  });

  it("errors on extremely large radius", () => {
    expect(computeBlurParams({ radius: 500, passes: 3 })).toHaveProperty("error");
  });

  it("accepts radius 0 (no-op)", () => {
    expect(computeBlurParams({ radius: 0, passes: 3 })).toEqual({ radius: 0, passes: 3 });
  });
});

describe("horizontalOffsets", () => {
  it("returns symmetric offsets", () => {
    const offsets = horizontalOffsets(2);
    expect(offsets).toEqual([-2, -1, 0, 1, 2]);
  });

  it("returns single offset for radius 0", () => {
    expect(horizontalOffsets(0)).toEqual([0]);
  });

  it("has length 2r+1", () => {
    expect(horizontalOffsets(5).length).toBe(11);
  });
});

describe("effectiveSigma", () => {
  it("is 0 for radius 0", () => {
    expect(effectiveSigma(0, 3)).toBe(0);
  });

  it("increases with radius", () => {
    expect(effectiveSigma(10, 3)).toBeGreaterThan(effectiveSigma(5, 3));
  });

  it("increases with passes", () => {
    expect(effectiveSigma(5, 5)).toBeGreaterThan(effectiveSigma(5, 1));
  });
});

describe("validateDimensions", () => {
  it("accepts valid dims", () => {
    expect(validateDimensions(100, 100)).toEqual({ ok: true });
  });

  it("rejects non-positive dims", () => {
    expect(validateDimensions(0, 100)).toHaveProperty("error");
  });

  it("rejects enormous images", () => {
    expect(validateDimensions(10000, 10000)).toHaveProperty("error");
  });
});
