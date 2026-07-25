import { describe, it, expect } from "vitest";
import { validateFisheyeOptions, mapPixel, distortionFactor, bilinearSample } from "./logic";

describe("validateFisheyeOptions", () => {
  it("accepts valid options", () => {
    expect(validateFisheyeOptions({ strength: 0.5, zoom: 1 })).toEqual({ ok: true });
  });
  it("rejects out-of-range strength", () => {
    expect(validateFisheyeOptions({ strength: 2, zoom: 1 })).toHaveProperty("error");
  });
  it("rejects negative zoom", () => {
    expect(validateFisheyeOptions({ strength: 0.5, zoom: -1 })).toHaveProperty("error");
  });
});

describe("mapPixel", () => {
  it("returns center for center pixel", () => {
    const { x, y } = mapPixel(50, 50, 100, 100, { strength: 0.5, zoom: 1 });
    expect(x).toBeCloseTo(50, 5);
    expect(y).toBeCloseTo(50, 5);
  });
  it("preserves identity when strength is 0", () => {
    const { x, y } = mapPixel(20, 30, 100, 100, { strength: 0, zoom: 1 });
    expect(x).toBeCloseTo(20, 5);
    expect(y).toBeCloseTo(30, 5);
  });
  it("produces finite coordinates for edge pixels", () => {
    const { x, y } = mapPixel(0, 0, 100, 100, { strength: 0.9, zoom: 1 });
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe("distortionFactor", () => {
  it("returns 1 at r=0", () => {
    expect(distortionFactor(0, 0.5)).toBe(1);
  });
  it("barrel distortion increases factor", () => {
    expect(distortionFactor(0.5, 0.5)).toBeGreaterThan(1);
  });
  it("pincushion distortion decreases factor", () => {
    expect(distortionFactor(0.5, -0.5)).toBeLessThan(1);
  });
});

describe("bilinearSample", () => {
  it("samples exact pixel when no fraction", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 40, 50, 60, 70, 80]);
    const [r, g, b, a] = bilinearSample(rgba, 2, 1, 0, 0);
    expect([r, g, b, a]).toEqual([10, 20, 30, 40]);
  });
  it("interpolates between pixels", () => {
    const rgba = new Uint8ClampedArray([0, 0, 0, 0, 100, 100, 100, 100]);
    const [r] = bilinearSample(rgba, 2, 1, 0.5, 0);
    expect(r).toBe(50);
  });
});
