import { describe, it, expect } from "vitest";
import {
  plasmaValue,
  normalizePlasma,
  plasmaToRgb,
  hsvToRgb,
  firePalette,
  icePalette,
  rainbowPalette,
  plasmaPixel,
  mulberry32,
  valueNoise,
  addTurbulence,
  validatePlasmaOptions,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("plasmaValue", () => {
  it("returns value in [-4, 4] range", () => {
    const v = plasmaValue(10, 20, DEFAULT_OPTIONS);
    expect(v).toBeGreaterThanOrEqual(-4);
    expect(v).toBeLessThanOrEqual(4);
  });
  it("is 0 at origin for symmetric options", () => {
    const v = plasmaValue(0, 0, DEFAULT_OPTIONS);
    expect(v).toBe(0);
  });
});

describe("normalizePlasma", () => {
  it("maps -4 to 0", () => expect(normalizePlasma(-4)).toBe(0));
  it("maps 4 to 1", () => expect(normalizePlasma(4)).toBe(1));
  it("maps 0 to 0.5", () => expect(normalizePlasma(0)).toBe(0.5));
});

describe("hsvToRgb", () => {
  it("red at h=0", () => expect(hsvToRgb(0, 1, 1)).toEqual({ r: 255, g: 0, b: 0 }));
  it("green at h=120", () => expect(hsvToRgb(120, 1, 1)).toEqual({ r: 0, g: 255, b: 0 }));
  it("blue at h=240", () => expect(hsvToRgb(240, 1, 1)).toEqual({ r: 0, g: 0, b: 255 }));
  it("white at v=0", () => expect(hsvToRgb(0, 1, 0)).toEqual({ r: 0, g: 0, b: 0 }));
});

describe("firePalette + icePalette + rainbowPalette", () => {
  it("firePalette at 0 is dark", () => {
    const c = firePalette(0);
    expect(c.r).toBeLessThanOrEqual(c.b + 50);
  });
  it("firePalette at 1 is bright", () => {
    const c = firePalette(1);
    expect(c.r).toBe(255);
  });
  it("icePalette at 1 is bright", () => {
    const c = icePalette(1);
    expect(c.b).toBeGreaterThan(200);
  });
  it("rainbowPalette returns valid color", () => {
    const c = rainbowPalette(0.5, 0);
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.b).toBeLessThanOrEqual(255);
  });
});

describe("plasmaToRgb", () => {
  it("grayscale returns equal R/G/B", () => {
    const c = plasmaToRgb(0.5, { ...DEFAULT_OPTIONS, palette: "grayscale" });
    expect(c.r).toBe(c.g);
    expect(c.g).toBe(c.b);
  });
  it("fire palette returns red-ish", () => {
    const c = plasmaToRgb(0.8, { ...DEFAULT_OPTIONS, palette: "fire" });
    expect(c.r).toBeGreaterThan(c.b);
  });
  it("ice palette returns blue-ish", () => {
    const c = plasmaToRgb(0.5, { ...DEFAULT_OPTIONS, palette: "ice" });
    expect(c.b).toBeGreaterThan(c.r);
  });
});

describe("plasmaPixel", () => {
  it("returns 4-channel RGBA", () => {
    const p = plasmaPixel(10, 10, DEFAULT_OPTIONS);
    expect(p).toHaveProperty("r");
    expect(p).toHaveProperty("g");
    expect(p).toHaveProperty("b");
    expect(p).toHaveProperty("a");
    expect(p.a).toBe(255);
  });
});

describe("mulberry32 + valueNoise + addTurbulence", () => {
  it("mulberry32 produces deterministic sequence", () => {
    const r1 = mulberry32(123)();
    const r2 = mulberry32(123)();
    expect(r1).toBe(r2);
  });
  it("mulberry32 produces 0..1", () => {
    const r = mulberry32(1)();
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
  it("valueNoise returns 0..1", () => {
    const v = valueNoise(1.5, 2.5, 1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(1);
  });
  it("addTurbulence is identity when turbulence 0", () => {
    expect(addTurbulence(10, 10, 0.5, DEFAULT_OPTIONS)).toBe(0.5);
  });
  it("addTurbulence changes value when turbulence > 0", () => {
    const out = addTurbulence(10, 10, 0.5, { ...DEFAULT_OPTIONS, turbulence: 2 });
    // Could be more or less, but should differ from 0.5
    expect(out).not.toBe(0.5);
  });
});

describe("validatePlasmaOptions", () => {
  it("accepts valid options", () => {
    expect(validatePlasmaOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects zero a", () => {
    expect(validatePlasmaOptions({ ...DEFAULT_OPTIONS, a: 0 })).toHaveProperty("error");
  });
  it("rejects negative b", () => {
    expect(validatePlasmaOptions({ ...DEFAULT_OPTIONS, b: -1 })).toHaveProperty("error");
  });
  it("rejects bad hue offset", () => {
    expect(validatePlasmaOptions({ ...DEFAULT_OPTIONS, hueOffset: 400 })).toHaveProperty("error");
  });
  it("rejects bad turbulence", () => {
    expect(validatePlasmaOptions({ ...DEFAULT_OPTIONS, turbulence: 10 })).toHaveProperty("error");
  });
});

describe("batch + format + nudge + presets + clampByte", () => {
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments and decrements", () => {
    expect(nudgeValue(10, "arrowup", false)).toBe(11);
    expect(nudgeValue(10, "arrowdown", true)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("fire")?.options.palette).toBe("fire");
  });
  it("has at least 6 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
