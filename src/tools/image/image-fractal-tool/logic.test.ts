import { describe, it, expect } from "vitest";
import {
  iterate,
  escapeIterations,
  smoothEscape,
  iterToColor,
  pixelToComplex,
  validateFractalOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  findPreset,
  PRESETS,
  clampByte,
  meanDelta,
  luma,
  type FractalOptions,
} from "./logic";

const OPTS: FractalOptions = {
  cx: -0.5, cy: 0, zoom: 1, maxIter: 100, julia: false, jx: 0, jy: 0,
  escape: 4, palette: "default", smooth: false,
};

describe("iterate", () => {
  it("computes z² + c correctly", () => {
    const r = iterate(1, 1, 0, 0);
    expect(r.x).toBeCloseTo(0, 5);
    expect(r.y).toBeCloseTo(2, 5);
  });
  it("handles c=0 (identity squared)", () => {
    const r = iterate(2, 3, 0, 0);
    expect(r.x).toBeCloseTo(-5, 5);
    expect(r.y).toBeCloseTo(12, 5);
  });
});

describe("escapeIterations", () => {
  it("returns -1 for bounded points (Mandelbrot origin)", () => {
    const i = escapeIterations(0, 0, OPTS);
    expect(i).toBe(-1);
  });
  it("returns small iter for escaping points", () => {
    const i = escapeIterations(2, 0, OPTS);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(5);
  });
  it("returns -1 for points inside the main cardioid", () => {
    const i = escapeIterations(-0.5, 0, OPTS);
    expect(i).toBe(-1);
  });
});

describe("smoothEscape", () => {
  it("returns -1 for bounded points", () => {
    expect(smoothEscape(0, 0, OPTS)).toBe(-1);
  });
  it("returns positive value for escaping points", () => {
    const v = smoothEscape(2, 0, OPTS);
    expect(v).toBeGreaterThanOrEqual(0);
  });
});

describe("iterToColor", () => {
  it("returns black for bounded points", () => {
    expect(iterToColor(-1, 100)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("returns valid RGB bytes", () => {
    const c = iterToColor(50, 100);
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(255);
  });
  it("fire palette returns valid colors", () => {
    const c = iterToColor(50, 100, "fire");
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(255);
  });
  it("ocean palette returns valid colors", () => {
    const c = iterToColor(50, 100, "ocean");
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(255);
  });
  it("grayscale palette returns equal R=G=B", () => {
    const c = iterToColor(50, 100, "grayscale");
    expect(c.r).toBe(c.g);
    expect(c.g).toBe(c.b);
  });
});

describe("pixelToComplex", () => {
  it("maps center to view center", () => {
    const p = pixelToComplex(50, 50, 100, 100, OPTS);
    expect(p.x).toBeCloseTo(OPTS.cx, 5);
    expect(p.y).toBeCloseTo(OPTS.cy, 5);
  });
  it("zooms in when zoom > 1", () => {
    const a = pixelToComplex(0, 0, 100, 100, OPTS);
    const b = pixelToComplex(0, 0, 100, 100, { ...OPTS, zoom: 2 });
    expect(Math.abs(b.x - OPTS.cx)).toBeLessThan(Math.abs(a.x - OPTS.cx));
  });
});

describe("validateFractalOptions", () => {
  it("accepts valid options", () => {
    expect(validateFractalOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects zero iterations", () => {
    expect(validateFractalOptions({ ...OPTS, maxIter: 0 })).toHaveProperty("error");
  });
  it("rejects non-positive zoom", () => {
    expect(validateFractalOptions({ ...OPTS, zoom: 0 })).toHaveProperty("error");
  });
  it("rejects bad palette", () => {
    expect(validateFractalOptions({ ...OPTS, palette: "bad" as never })).toHaveProperty("error");
  });
});

describe("helpers + presets", () => {
  it("isIdentity always false", () => {
    expect(isIdentity(OPTS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], OPTS);
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("spiral")?.options.zoom).toBe(8);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
});
