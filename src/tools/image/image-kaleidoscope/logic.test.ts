import { describe, it, expect } from "vitest";
import {
  segmentAngle,
  toPolar,
  toCartesian,
  mirrorToWedge,
  validateSegments,
  validateKaleidoscope,
  mapAngle,
  blendPixels,
  isIdentity,
  batchValidate,
  preservesAlpha,
  computeCenter,
  degToRad,
  normalizeAngle,
  radialMask,
  luma,
  transformedRatio,
  meanDelta,
  findPreset,
  PRESETS,
  KALEIDOSCOPE_PRESETS,
  clampByte,
  type KaleidoscopeOptions,
} from "./logic";

const DEFAULT_OPTS: KaleidoscopeOptions = {
  segments: 8, rotation: 0, mirror: true, blend: "overwrite", offsetX: 0, offsetY: 0,
};

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
    const angle = segmentAngle(4);
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

describe("mapAngle + blendPixels", () => {
  it("mapAngle with mirror matches mirrorToWedge", () => {
    const a = mapAngle(0.5, 4, 0, true);
    expect(a).toBeCloseTo(mirrorToWedge(0.5, 4, 0).theta, 6);
  });
  it("mapAngle without mirror repeats wedge", () => {
    const angle = segmentAngle(4);
    const a = mapAngle(angle + 0.1, 4, 0, false);
    expect(a).toBeCloseTo(0.1, 6);
  });
  it("blendPixels overwrite returns b", () => {
    expect(blendPixels([10, 20, 30], [40, 50, 60], "overwrite")).toEqual([40, 50, 60]);
  });
  it("blendPixels average averages", () => {
    expect(blendPixels([10, 20, 30], [50, 60, 70], "average")).toEqual([30, 40, 50]);
  });
  it("blendPixels additive clamps", () => {
    expect(blendPixels([200, 200, 200], [200, 200, 200], "additive")).toEqual([255, 255, 255]);
  });
});

describe("validateSegments + validateKaleidoscope", () => {
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
  it("validateKaleidoscope accepts valid opts", () => {
    expect("error" in validateKaleidoscope(DEFAULT_OPTS)).toBe(false);
  });
  it("validateKaleidoscope rejects bad blend", () => {
    expect("error" in validateKaleidoscope({ ...DEFAULT_OPTS, blend: "bad" as never })).toBe(true);
  });
  it("validateKaleidoscope rejects bad offset", () => {
    expect("error" in validateKaleidoscope({ ...DEFAULT_OPTS, offsetX: 1 })).toBe(true);
  });
});

describe("helpers + presets", () => {
  it("isIdentity always false", () => {
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
  it("computeCenter applies offset", () => {
    const c = computeCenter(100, 0.1, -0.1);
    expect(c.cx).toBeCloseTo(60, 0);
    expect(c.cy).toBeCloseTo(40, 0);
  });
  it("degToRad converts", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI, 6);
  });
  it("normalizeAngle wraps to [0, 2π)", () => {
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI, 6);
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 6);
  });
  it("radialMask returns 1 inside innerR", () => {
    expect(radialMask(5, 10, 20)).toBe(1);
  });
  it("radialMask returns 0 outside outerR", () => {
    expect(radialMask(25, 10, 20)).toBe(0);
  });
  it("radialMask linear between", () => {
    expect(radialMask(15, 10, 20)).toBeCloseTo(0.5, 6);
  });
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
  it("transformedRatio counts non-transparent pixels", () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]);
    expect(transformedRatio(data)).toBeCloseTo(0.5, 5);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("p6")?.options.segments).toBe(6);
  });
  it("has at least 6 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
  });
  it("KALEIDOSCOPE_PRESETS includes 6 and 8", () => {
    expect(KALEIDOSCOPE_PRESETS).toContain(6);
    expect(KALEIDOSCOPE_PRESETS).toContain(8);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
