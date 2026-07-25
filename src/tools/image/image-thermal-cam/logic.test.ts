import { describe, it, expect } from "vitest";
import {
  THERMAL_STOPS,
  IRON_STOPS,
  RAINBOW_STOPS,
  getStops,
  validateThermal,
  luma,
  applyContrast,
  applyIntensity,
  thermalColor,
  thermalPixel,
  isIdentity,
  batchValidate,
  preservesAlpha,
  meanDelta,
  findPreset,
  PRESETS,
  clampByte,
  type ThermalOptions,
} from "./logic";

const DEFAULT_OPTS: ThermalOptions = {
  contrast: 1, invert: false, palette: "thermal", intensity: 1, threshold: 0,
};

describe("validateThermal", () => {
  it("passes valid opts", () => {
    expect(validateThermal(DEFAULT_OPTS)).toEqual(DEFAULT_OPTS);
  });
  it("errors on bad contrast", () => {
    expect(validateThermal({ ...DEFAULT_OPTS, contrast: 3 })).toHaveProperty("error");
  });
  it("coerces invert to boolean", () => {
    expect(validateThermal({ ...DEFAULT_OPTS, invert: 1 as unknown as boolean }).invert).toBe(true);
  });
  it("errors on bad palette", () => {
    expect(validateThermal({ ...DEFAULT_OPTS, palette: "bad" as never })).toHaveProperty("error");
  });
  it("errors on bad intensity", () => {
    expect(validateThermal({ ...DEFAULT_OPTS, intensity: 5 })).toHaveProperty("error");
  });
  it("errors on bad threshold", () => {
    expect(validateThermal({ ...DEFAULT_OPTS, threshold: 2 })).toHaveProperty("error");
  });
});

describe("THERMAL_STOPS + IRON_STOPS + RAINBOW_STOPS", () => {
  it("THERMAL_STOPS has 6 stops from 0 to 1", () => {
    expect(THERMAL_STOPS.length).toBe(6);
    expect(THERMAL_STOPS[0]![0]).toBe(0);
    expect(THERMAL_STOPS[THERMAL_STOPS.length - 1]![0]).toBe(1);
  });
  it("stops are monotonically increasing in t", () => {
    for (let i = 1; i < THERMAL_STOPS.length; i++) {
      expect(THERMAL_STOPS[i]![0]).toBeGreaterThanOrEqual(THERMAL_STOPS[i - 1]![0]);
    }
  });
  it("IRON_STOPS and RAINBOW_STOPS have 6 stops each", () => {
    expect(IRON_STOPS.length).toBe(6);
    expect(RAINBOW_STOPS.length).toBe(6);
  });
  it("getStops returns correct palette", () => {
    expect(getStops("iron")).toBe(IRON_STOPS);
    expect(getStops("rainbow")).toBe(RAINBOW_STOPS);
    expect(getStops("thermal")).toBe(THERMAL_STOPS);
  });
});

describe("luma + applyContrast + applyIntensity", () => {
  it("luma is 0 for black, ~255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
  it("applyContrast identity at 1", () => {
    expect(applyContrast(0.5, 1)).toBeCloseTo(0.5);
  });
  it("applyContrast boosts midtones for > 1", () => {
    expect(applyContrast(0.5, 2)).toBeGreaterThan(0.5);
  });
  it("applyIntensity multiplies value", () => {
    expect(applyIntensity(0.5, 2)).toBe(1);
    expect(applyIntensity(0.5, 1)).toBe(0.5);
  });
});

describe("thermalColor", () => {
  it("returns first stop color at t=0", () => {
    expect(thermalColor(0, DEFAULT_OPTS)).toEqual([0, 0, 0]);
  });
  it("returns last stop color at t=1", () => {
    expect(thermalColor(1, DEFAULT_OPTS)).toEqual([255, 255, 255]);
  });
  it("returns blue-ish at low t", () => {
    const [r, g, b] = thermalColor(0.2, DEFAULT_OPTS);
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });
  it("inverts when invert=true", () => {
    const normal = thermalColor(0.1, DEFAULT_OPTS);
    const inverted = thermalColor(0.1, { ...DEFAULT_OPTS, invert: true });
    expect(inverted).not.toEqual(normal);
  });
  it("clamps out-of-range t", () => {
    expect(thermalColor(-5, DEFAULT_OPTS)).toEqual([0, 0, 0]);
    expect(thermalColor(5, DEFAULT_OPTS)).toEqual([255, 255, 255]);
  });
  it("returns black below threshold", () => {
    expect(thermalColor(0.1, { ...DEFAULT_OPTS, threshold: 0.5 })).toEqual([0, 0, 0]);
  });
});

describe("thermalPixel", () => {
  it("maps black pixel to first stop", () => {
    expect(thermalPixel(0, 0, 0, DEFAULT_OPTS)).toEqual([0, 0, 0]);
  });
  it("maps white pixel to last stop", () => {
    expect(thermalPixel(255, 255, 255, DEFAULT_OPTS)).toEqual([255, 255, 255]);
  });
});

describe("helpers + presets", () => {
  it("isIdentity true for grayscale defaults", () => {
    expect(isIdentity({ ...DEFAULT_OPTS, palette: "grayscale" })).toBe(true);
  });
  it("isIdentity false for thermal palette", () => {
    expect(isIdentity(DEFAULT_OPTS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("iron")?.options.palette).toBe("iron");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
