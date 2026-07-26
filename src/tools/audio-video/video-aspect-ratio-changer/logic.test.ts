import { describe, it, expect } from "vitest";
import {
  parseRatio, computeTargetDimensions, roundEven, centerCrop, computeAspect,
  cropEfficiency, padWaste, ASPECT_RATIOS, detectClosestRatio, formatDimensions,
  estimateRelativeSize, toCssPreview,
} from "./logic";

describe("parseRatio", () => {
  it("returns ratio for each variant", () => {
    expect(parseRatio("16:9")).toEqual({ w: 16, h: 9 });
    expect(parseRatio("1:1")).toEqual({ w: 1, h: 1 });
  });
});

describe("roundEven", () => {
  it("rounds to even", () => {
    expect(roundEven(15)).toBe(16);
    expect(roundEven(16)).toBe(16);
    expect(roundEven(17)).toBe(18);
  });
});

describe("computeTargetDimensions", () => {
  it("16:9 from 4:3 source keeps height", () => {
    const r = computeTargetDimensions(640, 480, "16:9");
    expect(r.height).toBe(480);
    expect(r.width).toBe(854); // 480 * 16/9 ≈ 853.33 → rounded to 854
  });
  it("9:16 from 16:9 source keeps width", () => {
    const r = computeTargetDimensions(1920, 1080, "9:16");
    expect(r.width).toBe(1920);
    expect(r.height).toBe(3414); // 1920 * 16/9
  });
  it("produces even dimensions", () => {
    const r = computeTargetDimensions(1920, 1080, "1:1");
    expect(r.width % 2).toBe(0);
    expect(r.height % 2).toBe(0);
  });
});

describe("centerCrop", () => {
  it("centers crop", () => {
    const c = centerCrop(100, 100, 50, 50);
    expect(c.x).toBe(25);
    expect(c.y).toBe(25);
  });
  it("clamps negatives to 0", () => {
    const c = centerCrop(50, 50, 100, 100);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
  });
});

describe("computeAspect", () => {
  it("crop mode produces crop rectangle", () => {
    const r = computeAspect({ sourceWidth: 1920, sourceHeight: 1080, targetRatio: "1:1", mode: "crop" });
    expect(r.cropWidth).toBeLessThanOrEqual(1920);
    expect(r.cropHeight).toBeLessThanOrEqual(1080);
    expect(r.mode).toBe("crop");
  });
  it("pad mode produces pad rectangle", () => {
    const r = computeAspect({ sourceWidth: 640, sourceHeight: 480, targetRatio: "16:9", mode: "pad" });
    expect(r.padWidth).toBeLessThanOrEqual(r.targetWidth);
    expect(r.padHeight).toBeLessThanOrEqual(r.targetHeight);
  });
  it("blur mode keeps full source", () => {
    const r = computeAspect({ sourceWidth: 1920, sourceHeight: 1080, targetRatio: "9:16", mode: "blur" });
    expect(r.cropWidth).toBe(1920);
    expect(r.cropHeight).toBe(1080);
  });
  it("stretch mode just resizes", () => {
    const r = computeAspect({ sourceWidth: 100, sourceHeight: 100, targetRatio: "16:9", mode: "stretch" });
    expect(r.mode).toBe("stretch");
    expect(r.targetWidth).toBeGreaterThan(0);
  });
  it("includes description text", () => {
    const r = computeAspect({ sourceWidth: 1920, sourceHeight: 1080, targetRatio: "1:1", mode: "crop" });
    expect(r.description.length).toBeGreaterThan(0);
  });
});

describe("cropEfficiency", () => {
  it("100% when no crop", () => {
    expect(cropEfficiency(100, 100, 100, 100)).toBe(100);
  });
  it("25% when quarter area", () => {
    expect(cropEfficiency(100, 100, 50, 50)).toBe(25);
  });
  it("0 for zero source", () => {
    expect(cropEfficiency(0, 0, 10, 10)).toBe(0);
  });
});

describe("padWaste", () => {
  it("0% when no padding", () => {
    expect(padWaste(100, 100, 100, 100)).toBe(0);
  });
  it("75% when quarter area used", () => {
    expect(padWaste(100, 100, 50, 50)).toBe(75);
  });
});

describe("ASPECT_RATIOS", () => {
  it("has at least 4 ratios", () => {
    expect(ASPECT_RATIOS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("detectClosestRatio", () => {
  it("detects 16:9 for HD", () => {
    expect(detectClosestRatio(1920, 1080)).toBe("16:9");
  });
  it("detects 9:16 for vertical", () => {
    expect(detectClosestRatio(1080, 1920)).toBe("9:16");
  });
  it("detects 1:1 for square", () => {
    expect(detectClosestRatio(500, 500)).toBe("1:1");
  });
  it("defaults for zero", () => {
    expect(detectClosestRatio(0, 0)).toBe("16:9");
  });
});

describe("formatters", () => {
  it("formatDimensions", () => {
    expect(formatDimensions(1920, 1080)).toBe("1920×1080");
  });
  it("estimateRelativeSize", () => {
    expect(estimateRelativeSize(1920, 1080, 1920, 1080)).toBe(1);
    expect(estimateRelativeSize(1920, 1080, 3840, 2160)).toBe(4);
  });
  it("toCssPreview", () => {
    const r = computeAspect({ sourceWidth: 1920, sourceHeight: 1080, targetRatio: "1:1", mode: "crop" });
    const css = toCssPreview(r);
    expect(css).toContain("width:");
    expect(css).toContain("height:");
  });
});
