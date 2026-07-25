import { describe, it, expect } from "vitest";
import {
  validateDrosteOptions, toPolar, toCartesian, mapDrostePixel,
  spiralPoint, spiralPath, spiralTurns, spiralLength, levelTransform,
  batchValidate, levelAtRadius, computeCenter, computeMaxR, fmt,
} from "./logic";

const OPTS = { levels: 3, twist: 0, innerRadius: 0.5 };

describe("validateDrosteOptions", () => {
  it("accepts valid options", () => {
    expect(validateDrosteOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects non-integer levels", () => {
    expect(validateDrosteOptions({ levels: 2.5, twist: 0, innerRadius: 0.5 })).toHaveProperty("error");
  });
  it("rejects levels out of range", () => {
    expect(validateDrosteOptions({ levels: 0, twist: 0, innerRadius: 0.5 })).toHaveProperty("error");
    expect(validateDrosteOptions({ levels: 11, twist: 0, innerRadius: 0.5 })).toHaveProperty("error");
  });
  it("rejects innerRadius out of range", () => {
    expect(validateDrosteOptions({ levels: 3, twist: 0, innerRadius: 1.5 })).toHaveProperty("error");
    expect(validateDrosteOptions({ levels: 3, twist: 0, innerRadius: 0 })).toHaveProperty("error");
  });
  it("rejects twist out of range", () => {
    expect(validateDrosteOptions({ levels: 3, twist: 4, innerRadius: 0.5 })).toHaveProperty("error");
  });
  it("rejects bad center offset", () => {
    expect(validateDrosteOptions({ ...OPTS, cxOffset: 1 })).toHaveProperty("error");
    expect(validateDrosteOptions({ ...OPTS, cyOffset: -1 })).toHaveProperty("error");
  });
  it("rejects bad scale", () => {
    expect(validateDrosteOptions({ ...OPTS, scale: 3 })).toHaveProperty("error");
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
  it("respects center offset", () => {
    const p1 = mapDrostePixel(80, 50, 100, 100, { levels: 1, twist: 0, innerRadius: 0.5 });
    const p2 = mapDrostePixel(80, 50, 100, 100, { levels: 1, twist: 0, innerRadius: 0.5, cxOffset: 0.2 });
    // Different center → different source
    expect(Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)).toBeGreaterThan(0);
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

describe("spiralPath / spiralTurns / spiralLength", () => {
  it("generates a sequence of points", () => {
    const path = spiralPath(50, 50, 40, 0, 10);
    expect(path.length).toBe(11);
  });
  it("spiralTurns increases with twist", () => {
    expect(spiralTurns(1)).toBeGreaterThan(spiralTurns(0));
  });
  it("spiralLength returns positive value", () => {
    expect(spiralLength(50, 50, 40, 0.5, 50)).toBeGreaterThan(0);
  });
});

describe("levelTransform", () => {
  it("returns scale and rotation", () => {
    const t = levelTransform(2, { levels: 3, twist: 0.5, innerRadius: 0.5 });
    expect(t.scale).toBeCloseTo(0.25, 5);
    expect(t.rotation).toBeCloseTo(1, 5);
  });
});

describe("batchValidate", () => {
  it("validates each options object", () => {
    const r = batchValidate([OPTS, { ...OPTS, levels: 0 }]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
});

describe("levelAtRadius", () => {
  it("returns 0 at max radius", () => {
    expect(Math.abs(levelAtRadius(100, 100, 0.5))).toBe(0);
  });
  it("returns positive level inside", () => {
    expect(levelAtRadius(20, 100, 0.5)).toBeGreaterThan(0);
  });
  it("returns 0 for non-positive r", () => {
    expect(levelAtRadius(0, 100, 0.5)).toBe(0);
  });
});

describe("computeCenter / computeMaxR", () => {
  it("computes center without offset", () => {
    expect(computeCenter(100, 100, OPTS)).toEqual({ x: 50, y: 50 });
  });
  it("computes center with offset", () => {
    expect(computeCenter(100, 100, { ...OPTS, cxOffset: 0.1, cyOffset: -0.1 })).toEqual({ x: 60, y: 40 });
  });
  it("computes maxR based on scale", () => {
    expect(computeMaxR(100, 100, OPTS)).toBe(50);
    expect(computeMaxR(100, 100, { ...OPTS, scale: 2 })).toBe(100);
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
