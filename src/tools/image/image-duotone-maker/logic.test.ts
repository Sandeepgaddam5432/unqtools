import { describe, it, expect } from "vitest";
import { validateDuotone, luma, applyContrast, lerpColor, duotonePixel } from "./logic";

describe("validateDuotone", () => {
  it("passes valid opts", () => {
    const o = { shadow: [0, 0, 0] as [number, number, number], highlight: [255, 255, 255] as [number, number, number], contrast: 1 };
    expect(validateDuotone(o)).toEqual(o);
  });
  it("errors on bad shadow", () => {
    expect(validateDuotone({ shadow: [-1, 0, 0], highlight: [0, 0, 0], contrast: 1 })).toHaveProperty("error");
  });
  it("errors on bad highlight", () => {
    expect(validateDuotone({ shadow: [0, 0, 0], highlight: [300, 0, 0], contrast: 1 })).toHaveProperty("error");
  });
  it("errors on bad contrast", () => {
    expect(validateDuotone({ shadow: [0, 0, 0], highlight: [255, 0, 0], contrast: 3 })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("is 0 for black, ~255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
});

describe("applyContrast", () => {
  it("is identity when contrast = 1", () => {
    expect(applyContrast(0.5, 1)).toBeCloseTo(0.5);
  });
  it("boosts midtones when contrast > 1", () => {
    const v = applyContrast(0.5, 2);
    expect(v).toBeGreaterThan(0.5);
  });
  it("flattens midtones when contrast < 1", () => {
    const v = applyContrast(0.5, 0.5);
    expect(v).toBeLessThan(0.5);
  });
  it("clamps to [0,1]", () => {
    expect(applyContrast(0, 2)).toBe(0);
    expect(applyContrast(1, 2)).toBe(1);
  });
});

describe("lerpColor", () => {
  it("returns shadow at t=0", () => {
    expect(lerpColor([10, 20, 30], [200, 100, 50], 0)).toEqual([10, 20, 30]);
  });
  it("returns highlight at t=1", () => {
    expect(lerpColor([10, 20, 30], [200, 100, 50], 1)).toEqual([200, 100, 50]);
  });
  it("midpoint at t=0.5", () => {
    expect(lerpColor([0, 0, 0], [100, 100, 100], 0.5)).toEqual([50, 50, 50]);
  });
  it("clamps t > 1", () => {
    expect(lerpColor([0, 0, 0], [100, 100, 100], 5)).toEqual([100, 100, 100]);
  });
});

describe("duotonePixel", () => {
  it("returns shadow color for black pixel", () => {
    expect(duotonePixel(0, 0, 0, { shadow: [10, 20, 30], highlight: [200, 100, 50], contrast: 1 })).toEqual([10, 20, 30]);
  });
  it("returns highlight color for white pixel", () => {
    expect(duotonePixel(255, 255, 255, { shadow: [10, 20, 30], highlight: [200, 100, 50], contrast: 1 })).toEqual([200, 100, 50]);
  });
  it("midpoint for mid-gray", () => {
    const [r, g, b] = duotonePixel(128, 128, 128, { shadow: [0, 0, 0], highlight: [100, 100, 100], contrast: 1 });
    expect(r).toBeGreaterThan(40);
    expect(r).toBeLessThan(70);
  });
});
