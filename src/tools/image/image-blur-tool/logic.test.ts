/**
 * Image Blur Tool — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  computeBlurParams,
  horizontalOffsets,
  effectiveSigma,
  validateDimensions,
  motionBlurOffsets,
  radialBlurSamples,
  zoomBlurSamples,
  pointInMask,
  featherWeight,
  pointInBrushes,
  addBrushPoint,
  pixelateCellSize,
  privacyWarning,
  batchBlurParams,
  blurTypeLabel,
  preservesAlpha,
  type BrushStroke,
  type MaskRegion,
} from "./logic";

describe("computeBlurParams", () => {
  it("rounds radius", () => {
    expect(computeBlurParams({ radius: 3.6, passes: 3, type: "gaussian" })).toEqual({ radius: 4, passes: 3, type: "gaussian" });
  });
  it("clamps passes to [1, 5]", () => {
    expect(computeBlurParams({ radius: 5, passes: 0, type: "box" }).passes).toBe(1);
    expect(computeBlurParams({ radius: 5, passes: 10, type: "box" }).passes).toBe(5);
  });
  it("errors on negative radius", () => {
    expect(computeBlurParams({ radius: -1, passes: 3, type: "gaussian" })).toHaveProperty("error");
  });
  it("errors on extremely large radius", () => {
    expect(computeBlurParams({ radius: 500, passes: 3, type: "gaussian" })).toHaveProperty("error");
  });
  it("accepts radius 0 (no-op)", () => {
    expect(computeBlurParams({ radius: 0, passes: 3, type: "gaussian" })).toEqual({ radius: 0, passes: 3, type: "gaussian" });
  });
  it("preserves blur type", () => {
    expect(computeBlurParams({ radius: 5, passes: 3, type: "motion" }).type).toBe("motion");
  });
});

describe("horizontalOffsets", () => {
  it("returns symmetric offsets", () => {
    expect(horizontalOffsets(2)).toEqual([-2, -1, 0, 1, 2]);
  });
  it("returns single offset for radius 0", () => {
    expect(horizontalOffsets(0)).toEqual([0]);
  });
  it("has length 2r+1", () => {
    expect(horizontalOffsets(5).length).toBe(11);
  });
});

describe("effectiveSigma", () => {
  it("is 0 for radius 0", () => {
    expect(effectiveSigma(0, 3)).toBe(0);
  });
  it("increases with radius", () => {
    expect(effectiveSigma(10, 3)).toBeGreaterThan(effectiveSigma(5, 3));
  });
  it("increases with passes", () => {
    expect(effectiveSigma(5, 5)).toBeGreaterThan(effectiveSigma(5, 1));
  });
});

describe("validateDimensions", () => {
  it("accepts valid dims", () => {
    expect(validateDimensions(100, 100)).toEqual({ ok: true });
  });
  it("rejects non-positive dims", () => {
    expect(validateDimensions(0, 100)).toHaveProperty("error");
  });
  it("rejects enormous images", () => {
    expect(validateDimensions(10000, 10000)).toHaveProperty("error");
  });
});

describe("motionBlurOffsets", () => {
  it("returns 2r+1 offsets", () => {
    expect(motionBlurOffsets(3, 0).length).toBe(7);
  });
  it("points along (1, 0) for angle 0", () => {
    const off = motionBlurOffsets(2, 0);
    expect(off[0]!.x).toBeCloseTo(-2, 5);
    expect(off[0]!.y).toBeCloseTo(0, 5);
    expect(off[4]!.x).toBeCloseTo(2, 5);
  });
  it("points along (0, 1) for angle 90", () => {
    const off = motionBlurOffsets(1, 90);
    expect(off[0]!.y).toBeLessThan(0);
    expect(off[2]!.y).toBeGreaterThan(0);
  });
});

describe("radialBlurSamples", () => {
  it("returns samples per ring", () => {
    const s = radialBlurSamples(2, 1);
    expect(s.length).toBeGreaterThan(0);
    // Each sample has r in (0, 1] and theta in [0, 2π)
    for (const sample of s) {
      expect(sample.r).toBeGreaterThan(0);
      expect(sample.r).toBeLessThanOrEqual(1);
      expect(sample.theta).toBeGreaterThanOrEqual(0);
      expect(sample.theta).toBeLessThan(Math.PI * 2);
    }
  });
  it("has more samples in outer rings", () => {
    const s1 = radialBlurSamples(1, 1);
    const s3 = radialBlurSamples(3, 1);
    expect(s3.length).toBeGreaterThan(s1.length);
  });
});

describe("zoomBlurSamples", () => {
  it("returns count samples with decreasing scale", () => {
    const s = zoomBlurSamples(5, 0.8);
    expect(s.length).toBe(5);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!.scale).toBeLessThan(s[i - 1]!.scale);
    }
  });
  it("scale stays positive", () => {
    const s = zoomBlurSamples(10, 0.5);
    for (const sample of s) expect(sample.scale).toBeGreaterThan(0);
  });
});

describe("pointInMask", () => {
  const rect: MaskRegion = { shape: "rect", bounds: { x: 10, y: 10, w: 50, h: 50 }, feather: 0 };
  const ellipse: MaskRegion = { shape: "ellipse", bounds: { x: 0, y: 0, w: 100, h: 100 }, feather: 0 };

  it("rect contains interior points", () => {
    expect(pointInMask(30, 30, rect)).toBe(true);
  });
  it("rect excludes exterior points", () => {
    expect(pointInMask(5, 30, rect)).toBe(false);
  });
  it("ellipse contains center", () => {
    expect(pointInMask(50, 50, ellipse)).toBe(true);
  });
  it("ellipse excludes corner", () => {
    expect(pointInMask(0, 0, ellipse)).toBe(false);
  });
  it("brush always returns false (no single-point test)", () => {
    expect(pointInMask(10, 10, { shape: "brush", bounds: { x: 0, y: 0, w: 0, h: 0 }, feather: 0 })).toBe(false);
  });
});

describe("featherWeight", () => {
  it("returns 1 deep inside a rect with feather 0", () => {
    const r: MaskRegion = { shape: "rect", bounds: { x: 0, y: 0, w: 100, h: 100 }, feather: 0 };
    expect(featherWeight(50, 50, r)).toBe(1);
  });
  it("returns 0 outside with feather 0", () => {
    const r: MaskRegion = { shape: "rect", bounds: { x: 0, y: 0, w: 100, h: 100 }, feather: 0 };
    expect(featherWeight(200, 200, r)).toBe(0);
  });
  it("tapers inside near edge with feather > 0", () => {
    const r: MaskRegion = { shape: "rect", bounds: { x: 0, y: 0, w: 100, h: 100 }, feather: 10 };
    // 1px from edge → weight ~0.1
    expect(featherWeight(1, 50, r)).toBeCloseTo(0.1, 1);
    // 5px from edge → weight 0.5
    expect(featherWeight(5, 50, r)).toBeCloseTo(0.5, 1);
  });
  it("tapers outside near edge with feather > 0", () => {
    const r: MaskRegion = { shape: "rect", bounds: { x: 0, y: 0, w: 100, h: 100 }, feather: 10 };
    // 1px outside → weight 0.9
    expect(featherWeight(-1, 50, r)).toBeCloseTo(0.9, 1);
  });
  it("ellipse feather works for center", () => {
    const r: MaskRegion = { shape: "ellipse", bounds: { x: 0, y: 0, w: 100, h: 100 }, feather: 10 };
    expect(featherWeight(50, 50, r)).toBe(1);
  });
});

describe("pointInBrushes", () => {
  it("finds points within brush radius", () => {
    const strokes: BrushStroke[] = [{ points: [{ x: 50, y: 50 }], size: 10 }];
    expect(pointInBrushes(52, 48, strokes)).toBe(true);
  });
  it("excludes points outside brush radius", () => {
    const strokes: BrushStroke[] = [{ points: [{ x: 50, y: 50 }], size: 10 }];
    expect(pointInBrushes(100, 100, strokes)).toBe(false);
  });
});

describe("addBrushPoint", () => {
  it("returns a new stroke with the point appended", () => {
    const stroke: BrushStroke = { points: [{ x: 0, y: 0 }], size: 5 };
    const next = addBrushPoint(stroke, { x: 10, y: 10 });
    expect(next.points).toHaveLength(2);
    expect(next.points[1]).toEqual({ x: 10, y: 10 });
    // original is not mutated
    expect(stroke.points).toHaveLength(1);
  });
});

describe("pixelateCellSize", () => {
  it("returns 1 at strength 0", () => {
    expect(pixelateCellSize(0, 1000)).toBe(1);
  });
  it("returns larger cells at strength 1", () => {
    expect(pixelateCellSize(1, 1000)).toBeGreaterThan(1);
  });
  it("clamps strength above 1", () => {
    expect(pixelateCellSize(2, 1000)).toBe(pixelateCellSize(1, 1000));
  });
  it("scales with image dimension", () => {
    expect(pixelateCellSize(0.5, 2000)).toBeGreaterThan(pixelateCellSize(0.5, 500));
  });
});

describe("privacyWarning", () => {
  it("returns a non-empty warning string", () => {
    expect(privacyWarning().length).toBeGreaterThan(0);
    expect(privacyWarning()).toContain("irreversible");
  });
});

describe("batchBlurParams", () => {
  it("computes params for valid files", () => {
    const r = batchBlurParams(
      [{ name: "a.png", width: 100, height: 100 }],
      { radius: 5, passes: 3, type: "gaussian" },
    );
    expect(r[0]!.result).toMatchObject({ radius: 5, passes: 3, type: "gaussian" });
  });
  it("propagates dimension errors", () => {
    const r = batchBlurParams(
      [{ name: "huge.png", width: 20000, height: 20000 }],
      { radius: 5, passes: 3, type: "gaussian" },
    );
    expect(r[0]!.result).toHaveProperty("error");
  });
});

describe("blurTypeLabel", () => {
  it("labels all types", () => {
    expect(blurTypeLabel("gaussian")).toContain("Gaussian");
    expect(blurTypeLabel("box")).toContain("Box");
    expect(blurTypeLabel("motion")).toContain("Motion");
    expect(blurTypeLabel("radial")).toContain("Radial");
    expect(blurTypeLabel("zoom")).toContain("Zoom");
    expect(blurTypeLabel("lens")).toContain("Lens");
    expect(blurTypeLabel("pixelate")).toContain("Pixelate");
  });
});

describe("preservesAlpha", () => {
  it("returns true for PNG/WebP, false for JPEG", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/webp")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});
