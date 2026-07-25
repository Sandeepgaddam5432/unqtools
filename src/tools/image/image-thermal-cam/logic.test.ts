import { describe, it, expect } from "vitest";
import { THERMAL_STOPS, validateThermal, luma, applyContrast, thermalColor, thermalPixel } from "./logic";

describe("validateThermal", () => {
  it("passes valid opts", () => {
    expect(validateThermal({ contrast: 1.2, invert: false })).toEqual({ contrast: 1.2, invert: false });
  });
  it("errors on bad contrast", () => {
    expect(validateThermal({ contrast: 3, invert: false })).toHaveProperty("error");
  });
  it("coerces invert to boolean", () => {
    expect(validateThermal({ contrast: 1, invert: 1 as unknown as boolean }).invert).toBe(true);
  });
});

describe("THERMAL_STOPS", () => {
  it("has 6 stops from 0 to 1", () => {
    expect(THERMAL_STOPS.length).toBe(6);
    expect(THERMAL_STOPS[0]![0]).toBe(0);
    expect(THERMAL_STOPS[THERMAL_STOPS.length - 1]![0]).toBe(1);
  });
  it("stops are monotonically increasing in t", () => {
    for (let i = 1; i < THERMAL_STOPS.length; i++) {
      expect(THERMAL_STOPS[i]![0]).toBeGreaterThanOrEqual(THERMAL_STOPS[i - 1]![0]);
    }
  });
});

describe("luma", () => {
  it("is 0 for black, ~255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
});

describe("applyContrast", () => {
  it("identity at contrast 1", () => {
    expect(applyContrast(0.5, 1)).toBeCloseTo(0.5);
  });
  it("boosts midtones for contrast > 1", () => {
    expect(applyContrast(0.5, 2)).toBeGreaterThan(0.5);
  });
});

describe("thermalColor", () => {
  it("returns first stop color at t=0", () => {
    expect(thermalColor(0, false)).toEqual([0, 0, 0]);
  });
  it("returns last stop color at t=1", () => {
    expect(thermalColor(1, false)).toEqual([255, 255, 255]);
  });
  it("returns blue-ish at low t", () => {
    const [r, g, b] = thermalColor(0.2, false);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });
  it("inverts when invert=true", () => {
    const normal = thermalColor(0.1, false);
    const inverted = thermalColor(0.1, true);
    expect(inverted).not.toEqual(normal);
  });
  it("clamps out-of-range t", () => {
    expect(thermalColor(-5, false)).toEqual([0, 0, 0]);
    expect(thermalColor(5, false)).toEqual([255, 255, 255]);
  });
});

describe("thermalPixel", () => {
  it("maps black pixel to first stop", () => {
    expect(thermalPixel(0, 0, 0, { contrast: 1, invert: false })).toEqual([0, 0, 0]);
  });
  it("maps white pixel to last stop", () => {
    expect(thermalPixel(255, 255, 255, { contrast: 1, invert: false })).toEqual([255, 255, 255]);
  });
});
