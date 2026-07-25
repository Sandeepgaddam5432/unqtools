import { describe, it, expect } from "vitest";
import { iterate, escapeIterations, iterToColor, pixelToComplex, validateFractalOptions } from "./logic";

const OPTS: import("./logic").FractalOptions = {
  cx: -0.5, cy: 0, zoom: 1, maxIter: 100, julia: false, jx: 0, jy: 0, escape: 4,
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

describe("iterToColor", () => {
  it("returns black for bounded points", () => {
    expect(iterToColor(-1, 100)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("returns valid RGB bytes", () => {
    const c = iterToColor(50, 100);
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(255);
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
});
