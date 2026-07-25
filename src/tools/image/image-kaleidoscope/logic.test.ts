import { describe, it, expect } from "vitest";
import {
  segmentAngle,
  toPolar,
  toCartesian,
  mirrorToWedge,
  validateSegments,
  KALEIDOSCOPE_PRESETS,
} from "./logic";

describe("segmentAngle", () => {
  it("divides a circle evenly", () => {
    expect(segmentAngle(2)).toBeCloseTo(Math.PI, 6);
    expect(segmentAngle(4)).toBeCloseTo(Math.PI / 2, 6);
    expect(segmentAngle(6)).toBeCloseTo(Math.PI / 3, 6);
  });

  it("clamps to min 2 segments", () => {
    expect(segmentAngle(1)).toBeCloseTo(Math.PI, 6);
  });
});

describe("toPolar / toCartesian", () => {
  it("converts cartesian to polar", () => {
    const p = toPolar(110, 100, 100, 100);
    expect(p.r).toBeCloseTo(10, 6);
    expect(p.theta).toBeCloseTo(0, 6);
  });

  it("round-trips cartesian ↔ polar", () => {
    const c = toCartesian(15, Math.PI / 4, 100, 100);
    const p = toPolar(c.x, c.y, 100, 100);
    expect(p.r).toBeCloseTo(15, 6);
    expect(p.theta).toBeCloseTo(Math.PI / 4, 6);
  });
});

describe("mirrorToWedge", () => {
  it("maps the first wedge to itself", () => {
    const angle = segmentAngle(4); // π/2
    const m = mirrorToWedge(angle * 0.25, 4);
    expect(m.theta).toBeGreaterThanOrEqual(0);
    expect(m.theta).toBeLessThan(angle);
  });

  it("mirrors the second wedge back to the first", () => {
    const angle = segmentAngle(4);
    const a = angle * 0.25;
    const m1 = mirrorToWedge(a, 4);
    const m2 = mirrorToWedge(angle + a, 4);
    expect(m2.theta).toBeCloseTo(angle - a, 6);
    expect(m1.theta).toBeCloseTo(a, 6);
  });

  it("handles rotation offset", () => {
    const m = mirrorToWedge(0.5, 4, 0.25);
    expect(m.theta).toBeGreaterThanOrEqual(0);
  });

  it("handles full circle wrap", () => {
    const m = mirrorToWedge(Math.PI * 3, 4);
    expect(m.theta).toBeGreaterThanOrEqual(0);
    expect(m.theta).toBeLessThan(segmentAngle(4));
  });
});

describe("validateSegments", () => {
  it("accepts 2..16", () => {
    expect(validateSegments(2)).toBe(2);
    expect(validateSegments(16)).toBe(16);
  });

  it("rejects below 2", () => {
    expect("error" in validateSegments(1)).toBe(true);
  });

  it("rejects above 16", () => {
    expect("error" in validateSegments(17)).toBe(true);
  });

  it("rejects non-integers", () => {
    expect("error" in validateSegments(3.5)).toBe(true);
  });

  it("rejects NaN", () => {
    expect("error" in validateSegments(NaN)).toBe(true);
  });
});

describe("KALEIDOSCOPE_PRESETS", () => {
  it("includes 6 and 8", () => {
    expect(KALEIDOSCOPE_PRESETS).toContain(6);
    expect(KALEIDOSCOPE_PRESETS).toContain(8);
  });
});
