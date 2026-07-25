import { describe, it, expect } from "vitest";
import { validateWatercolor, windowAverage, blendSoft, spreadWeight } from "./logic";

describe("validateWatercolor", () => {
  it("passes valid opts", () => {
    expect(validateWatercolor({ radius: 3, spread: 0.5, soften: 0.4 })).toEqual({ radius: 3, spread: 0.5, soften: 0.4 });
  });
  it("rounds radius", () => {
    expect(validateWatercolor({ radius: 3.6, spread: 0.5, soften: 0.4 }).radius).toBe(4);
  });
  it("errors on bad radius", () => {
    expect(validateWatercolor({ radius: 30, spread: 0.5, soften: 0.4 })).toHaveProperty("error");
  });
  it("errors on bad spread", () => {
    expect(validateWatercolor({ radius: 3, spread: 2, soften: 0.4 })).toHaveProperty("error");
  });
  it("errors on bad soften", () => {
    expect(validateWatercolor({ radius: 3, spread: 0.5, soften: -1 })).toHaveProperty("error");
  });
});

describe("windowAverage", () => {
  it("averages window colors", () => {
    const px = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) { px[i * 4] = 90; px[i * 4 + 1] = 180; px[i * 4 + 2] = 30; px[i * 4 + 3] = 255; }
    const [r, g, b] = windowAverage(px, 3, 3, 1, 1, 1);
    expect(r).toBeCloseTo(90);
    expect(g).toBeCloseTo(180);
    expect(b).toBeCloseTo(30);
  });
  it("returns 0,0,0 for out-of-bounds", () => {
    const px = new Uint8ClampedArray(0);
    expect(windowAverage(px, 0, 0, 0, 0, 0)).toEqual([0, 0, 0]);
  });
  it("ignores out-of-window pixels", () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 100; px[1] = 100; px[2] = 100; px[3] = 255;
    const [r] = windowAverage(px, 1, 1, 0, 0, 5);
    expect(r).toBeCloseTo(100);
  });
});

describe("blendSoft", () => {
  it("blends toward target", () => {
    expect(blendSoft([0, 0, 0, 255], [100, 100, 100], 0.5)).toEqual([50, 50, 50, 255]);
  });
  it("no blend at amount 0", () => {
    expect(blendSoft([10, 20, 30, 255], [200, 200, 200], 0)).toEqual([10, 20, 30, 255]);
  });
  it("full blend at amount 1", () => {
    expect(blendSoft([10, 20, 30, 255], [200, 200, 200], 1)).toEqual([200, 200, 200, 255]);
  });
  it("clamps >1", () => {
    expect(blendSoft([0, 0, 0, 255], [300, 300, 300], 5)).toEqual([255, 255, 255, 255]);
  });
});

describe("spreadWeight", () => {
  it("is 1 at center", () => {
    expect(spreadWeight(0, 5)).toBe(1);
  });
  it("is 0 at or beyond radius", () => {
    expect(spreadWeight(5, 5)).toBe(0);
    expect(spreadWeight(10, 5)).toBe(0);
  });
  it("is 1 for radius 0", () => {
    expect(spreadWeight(100, 0)).toBe(1);
  });
  it("decreases linearly", () => {
    expect(spreadWeight(2, 5)).toBeCloseTo(0.6);
  });
});
