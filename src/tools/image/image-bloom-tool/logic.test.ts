import { describe, it, expect } from "vitest";
import { validateBloom, luma, passesThreshold, effectiveSigma, addBloom } from "./logic";

describe("validateBloom", () => {
  it("passes valid opts", () => {
    expect(validateBloom({ threshold: 200, intensity: 0.5, radius: 8 })).toEqual({ threshold: 200, intensity: 0.5, radius: 8 });
  });
  it("rounds radius", () => {
    expect(validateBloom({ threshold: 100, intensity: 0.3, radius: 4.7 }).radius).toBe(5);
  });
  it("errors on bad threshold", () => {
    expect(validateBloom({ threshold: 300, intensity: 0.5, radius: 5 })).toHaveProperty("error");
  });
  it("errors on bad intensity", () => {
    expect(validateBloom({ threshold: 100, intensity: -1, radius: 5 })).toHaveProperty("error");
  });
  it("errors on bad radius", () => {
    expect(validateBloom({ threshold: 100, intensity: 0.5, radius: 200 })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("matches BT.601 for white", () => {
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
  it("is 0 for black", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
  it("weights red less than green", () => {
    expect(luma(255, 0, 0)).toBeLessThan(luma(0, 255, 0));
  });
});

describe("passesThreshold", () => {
  it("true when luma >= threshold", () => {
    expect(passesThreshold(255, 255, 255, 200)).toBe(true);
  });
  it("false when luma < threshold", () => {
    expect(passesThreshold(0, 0, 0, 200)).toBe(false);
  });
  it("boundary inclusive", () => {
    expect(passesThreshold(100, 100, 100, luma(100, 100, 100))).toBe(true);
  });
});

describe("effectiveSigma", () => {
  it("is 0 for radius 0", () => {
    expect(effectiveSigma(0)).toBe(0);
  });
  it("increases with radius", () => {
    expect(effectiveSigma(10)).toBeGreaterThan(effectiveSigma(5));
  });
});

describe("addBloom", () => {
  it("adds bloom scaled by intensity", () => {
    expect(addBloom([0, 0, 0, 255], [100, 100, 100], 0.5)).toEqual([50, 50, 50, 255]);
  });
  it("clamps at 255", () => {
    expect(addBloom([200, 200, 200, 255], [200, 200, 200], 1)).toEqual([255, 255, 255, 255]);
  });
  it("no bloom when intensity 0", () => {
    expect(addBloom([10, 20, 30, 255], [100, 100, 100], 0)).toEqual([10, 20, 30, 255]);
  });
});
