import { describe, it, expect } from "vitest";
import { validateDrosteOptions, toPolar, toCartesian, mapDrostePixel, spiralPoint } from "./logic";

describe("validateDrosteOptions", () => {
  it("accepts valid options", () => {
    expect(validateDrosteOptions({ levels: 3, twist: 0, innerRadius: 0.5 })).toEqual({ ok: true });
  });
  it("rejects non-integer levels", () => {
    expect(validateDrosteOptions({ levels: 2.5, twist: 0, innerRadius: 0.5 })).toHaveProperty("error");
  });
  it("rejects innerRadius out of range", () => {
    expect(validateDrosteOptions({ levels: 3, twist: 0, innerRadius: 1.5 })).toHaveProperty("error");
  });
});

describe("toPolar / toCartesian round trip", () => {
  it("recovers original point", () => {
    const cx = 50, cy = 50;
    const { r, theta } = toPolar(70, 80, cx, cy);
    const p = toCartesian(r, theta, cx, cy);
    expect(p.x).toBeCloseTo(70, 5);
    expect(p.y).toBeCloseTo(80, 5);
  });
  it("origin gives r=0", () => {
    expect(toPolar(50, 50, 50, 50).r).toBe(0);
  });
});

describe("mapDrostePixel", () => {
  it("returns finite coordinates within bounds", () => {
    const p = mapDrostePixel(20, 20, 100, 100, { levels: 3, twist: 0.3, innerRadius: 0.5 });
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThan(100);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThan(100);
  });
  it("preserves center approximately when inner radius is small", () => {
    const p = mapDrostePixel(50, 50, 100, 100, { levels: 1, twist: 0, innerRadius: 0.9 });
    expect(p.x).toBeCloseTo(50, 0);
    expect(p.y).toBeCloseTo(50, 0);
  });
});

describe("spiralPoint", () => {
  it("starts at max radius", () => {
    const p = spiralPoint(0, 50, 50, 40, 0);
    expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(40, 5);
  });
  it("radius shrinks as t increases", () => {
    const a = Math.hypot(spiralPoint(0, 50, 50, 40, 0).x - 50, spiralPoint(0, 50, 50, 40, 0).y - 50);
    const b = Math.hypot(spiralPoint(0.5, 50, 50, 40, 0).x - 50, spiralPoint(0.5, 50, 50, 40, 0).y - 50);
    expect(b).toBeLessThan(a);
  });
});
