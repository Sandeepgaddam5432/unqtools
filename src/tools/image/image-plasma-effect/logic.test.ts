import { describe, it, expect } from "vitest";
import { plasmaValue, normalizePlasma, plasmaToRgb, hsvToRgb, validatePlasmaOptions } from "./logic";

const OPTS = { a: 8, b: 8, c: 16, d: 16, hueOffset: 0 };

describe("plasmaValue", () => {
  it("is 0 at origin", () => {
    expect(plasmaValue(0, 0, OPTS)).toBeCloseTo(0, 5);
  });
  it("stays within [-4, 4]", () => {
    for (let i = 0; i < 100; i++) {
      const v = plasmaValue(i * 7, i * 13, OPTS);
      expect(v).toBeGreaterThanOrEqual(-4);
      expect(v).toBeLessThanOrEqual(4);
    }
  });
  it("varies smoothly with position", () => {
    const a = plasmaValue(10, 10, OPTS);
    const b = plasmaValue(11, 11, OPTS);
    expect(Math.abs(b - a)).toBeLessThan(1);
  });
});

describe("normalizePlasma", () => {
  it("maps -4 to 0", () => {
    expect(normalizePlasma(-4)).toBeCloseTo(0, 5);
  });
  it("maps 4 to 1", () => {
    expect(normalizePlasma(4)).toBeCloseTo(1, 5);
  });
  it("maps 0 to 0.5", () => {
    expect(normalizePlasma(0)).toBeCloseTo(0.5, 5);
  });
});

describe("hsvToRgb", () => {
  it("returns red for hue 0", () => {
    expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("returns green for hue 120", () => {
    expect(hsvToRgb(120, 1, 1)).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("returns blue for hue 240", () => {
    expect(hsvToRgb(240, 1, 1)).toEqual({ r: 0, g: 0, b: 255 });
  });
});

describe("plasmaToRgb", () => {
  it("returns valid RGB byte values", () => {
    const out = plasmaToRgb(0.5, 0);
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(255);
  });
  it("shifts with hue offset", () => {
    const a = plasmaToRgb(0.5, 0);
    const b = plasmaToRgb(0.5, 180);
    expect(a).not.toEqual(b);
  });
});

describe("validatePlasmaOptions", () => {
  it("accepts valid options", () => {
    expect(validatePlasmaOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects zero frequency", () => {
    expect(validatePlasmaOptions({ ...OPTS, a: 0 })).toHaveProperty("error");
  });
  it("rejects bad hue offset", () => {
    expect(validatePlasmaOptions({ ...OPTS, hueOffset: 400 })).toHaveProperty("error");
  });
});
