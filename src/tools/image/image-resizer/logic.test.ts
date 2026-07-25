/**
 * Image Resizer — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  calculateResize, calculateDownscaleSteps, estimateFileSize,
  calculateTargetSizeScale, needsDimensionSwap, getEffectiveDimensions,
  encodeResizeParams, decodeResizeParams, formatFileSize,
  SOCIAL_PRESETS, GENERIC_PRESETS,
} from "./logic";

describe("calculateResize — pixels mode", () => {
  it("resizes by width with aspect lock", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "pixels", targetWidth: 1000, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(1000);
    expect(r.height).toBe(500);
    expect(r.scale).toBe(0.5);
  });
  it("resizes by height with aspect lock", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "pixels", targetHeight: 250, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(500);
    expect(r.height).toBe(250);
  });
  it("fits within both dimensions (smaller scale)", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "pixels", targetWidth: 1000, targetHeight: 1000, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(1000);
    expect(r.height).toBe(500);
  });
  it("unlocked aspect uses exact dimensions", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "pixels", targetWidth: 800, targetHeight: 600, lockAspect: false, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(800);
    expect(r.height).toBe(600);
  });
  it("errors without any dimension", () => {
    expect("error" in calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "pixels", lockAspect: true, preventEnlarge: false })).toBe(true);
  });
  it("errors on non-positive original", () => {
    expect("error" in calculateResize({ originalWidth: 0, originalHeight: 1000, mode: "pixels", targetWidth: 100, lockAspect: true, preventEnlarge: false })).toBe(true);
  });
});

describe("calculateResize — percent mode", () => {
  it("scales by 50%", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "percent", scalePercent: 50, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(1000);
    expect(r.height).toBe(500);
  });
  it("scales by 200% (upscale)", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, mode: "percent", scalePercent: 200, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(2000);
    expect(r.height).toBe(1000);
    expect(r.isUpscaling).toBe(true);
  });
  it("errors on zero or negative percent", () => {
    expect("error" in calculateResize({ originalWidth: 1000, originalHeight: 500, mode: "percent", scalePercent: 0, lockAspect: true, preventEnlarge: false })).toBe(true);
  });
});

describe("calculateResize — preventEnlarge guard", () => {
  it("prevents enlargement when guard is on", () => {
    const r = calculateResize({ originalWidth: 500, originalHeight: 250, mode: "percent", scalePercent: 200, lockAspect: true, preventEnlarge: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(500);
    expect(r.height).toBe(250);
    expect(r.scale).toBe(1);
    expect(r.warnings.some((w) => w.includes("enlarge"))).toBe(true);
  });
  it("allows enlargement when guard is off", () => {
    const r = calculateResize({ originalWidth: 500, originalHeight: 250, mode: "percent", scalePercent: 200, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(1000);
  });
  it("warns about upscaling", () => {
    const r = calculateResize({ originalWidth: 500, originalHeight: 250, mode: "percent", scalePercent: 150, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.isUpscaling).toBe(true);
    expect(r.warnings.some((w) => w.includes("Upscaling"))).toBe(true);
  });
});

describe("calculateResize — preset mode", () => {
  it("resizes to Instagram Square preset", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 2000, mode: "preset", presetName: "Instagram Square", lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(1080);
    expect(r.height).toBe(1080);
  });
  it("errors on unknown preset", () => {
    expect("error" in calculateResize({ originalWidth: 2000, originalHeight: 2000, mode: "preset", presetName: "Nonexistent", lockAspect: true, preventEnlarge: false })).toBe(true);
  });
});

describe("calculateResize — target-size mode", () => {
  it("calculates scale for target KB", () => {
    const r = calculateResize({ originalWidth: 4000, originalHeight: 3000, mode: "target-size", targetSizeKB: 100, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBeLessThan(4000);
    expect(r.warnings.some((w) => w.includes("Target size"))).toBe(true);
  });
  it("errors on zero target size", () => {
    expect("error" in calculateResize({ originalWidth: 4000, originalHeight: 3000, mode: "target-size", targetSizeKB: 0, lockAspect: true, preventEnlarge: false })).toBe(true);
  });
});

describe("calculateResize — EXIF orientation", () => {
  it("swaps dimensions for orientation 6 (90° CW)", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "percent", scalePercent: 100, lockAspect: true, preventEnlarge: false, exifOrientation: 6 });
    if ("error" in r) throw new Error("Should not error");
    // After EXIF correction: effective = 1000×2000 → scale 100% → 1000×2000
    expect(r.width).toBe(1000);
    expect(r.height).toBe(2000);
  });
  it("does not swap for orientation 1 (normal)", () => {
    const r = calculateResize({ originalWidth: 2000, originalHeight: 1000, mode: "percent", scalePercent: 100, lockAspect: true, preventEnlarge: false, exifOrientation: 1 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.width).toBe(2000);
    expect(r.height).toBe(1000);
  });
});

describe("calculateDownscaleSteps", () => {
  it("returns single step when no downscale needed", () => {
    const steps = calculateDownscaleSteps(1000, 500, 1000, 500);
    expect(steps.length).toBe(1);
    expect(steps[0]).toEqual({ width: 1000, height: 500 });
  });
  it("returns multi-step path for large downscale", () => {
    const steps = calculateDownscaleSteps(4000, 2000, 500, 250);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps[0]!.width).toBeLessThan(4000);
    expect(steps[steps.length - 1]).toEqual({ width: 500, height: 250 });
  });
});

describe("estimateFileSize", () => {
  it("returns positive size for PNG", () => {
    expect(estimateFileSize(1000, 1000, "image/png", 1, false)).toBeGreaterThan(0);
  });
  it("returns smaller size for JPEG than PNG", () => {
    const png = estimateFileSize(1000, 1000, "image/png", 1, false);
    const jpeg = estimateFileSize(1000, 1000, "image/jpeg", 0.85, false);
    expect(jpeg).toBeLessThan(png);
  });
  it("returns smaller size for WebP than JPEG", () => {
    const jpeg = estimateFileSize(1000, 1000, "image/jpeg", 0.85, false);
    const webp = estimateFileSize(1000, 1000, "image/webp", 0.85, false);
    expect(webp).toBeLessThan(jpeg);
  });
});

describe("calculateTargetSizeScale", () => {
  it("finds a scale that fits within target", () => {
    const r = calculateTargetSizeScale(4000, 3000, 100, "image/jpeg", 0.85, false);
    expect(r.scale).toBeGreaterThan(0);
    expect(r.scale).toBeLessThanOrEqual(1);
    expect(r.estimatedKB).toBeLessThanOrEqual(100);
  });
});

describe("needsDimensionSwap", () => {
  it("returns true for orientations 5-8", () => {
    expect(needsDimensionSwap(5)).toBe(true);
    expect(needsDimensionSwap(6)).toBe(true);
    expect(needsDimensionSwap(7)).toBe(true);
    expect(needsDimensionSwap(8)).toBe(true);
  });
  it("returns false for orientations 1-4", () => {
    expect(needsDimensionSwap(1)).toBe(false);
    expect(needsDimensionSwap(2)).toBe(false);
    expect(needsDimensionSwap(3)).toBe(false);
    expect(needsDimensionSwap(4)).toBe(false);
  });
});

describe("getEffectiveDimensions", () => {
  it("swaps for orientation 6", () => {
    expect(getEffectiveDimensions(2000, 1000, 6)).toEqual({ width: 1000, height: 2000 });
  });
  it("does not swap for orientation 1", () => {
    expect(getEffectiveDimensions(2000, 1000, 1)).toEqual({ width: 2000, height: 1000 });
  });
});

describe("encodeResizeParams / decodeResizeParams", () => {
  it("round-trips params", () => {
    const encoded = encodeResizeParams({ w: 1000, h: 500, mode: "pixels", lock: true });
    const decoded = decodeResizeParams(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.mode).toBe("pixels");
    expect(decoded!.w).toBe("1000");
    expect(decoded!.lock).toBe("1");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => { expect(formatFileSize(500)).toBe("500 B"); });
  it("formats KB", () => { expect(formatFileSize(2048)).toBe("2.0 KB"); });
  it("formats MB", () => { expect(formatFileSize(5 * 1024 * 1024)).toBe("5.00 MB"); });
});

describe("SOCIAL_PRESETS", () => {
  it("includes Instagram presets", () => {
    expect(SOCIAL_PRESETS.some((p) => p.platform === "Instagram")).toBe(true);
  });
  it("includes Twitter/X presets", () => {
    expect(SOCIAL_PRESETS.some((p) => p.platform === "Twitter/X")).toBe(true);
  });
  it("includes LinkedIn presets", () => {
    expect(SOCIAL_PRESETS.some((p) => p.platform === "LinkedIn")).toBe(true);
  });
  it("has at least 10 presets", () => {
    expect(SOCIAL_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("calculateResize — warnings", () => {
  it("includes transparency warning for JPEG", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, mode: "percent", scalePercent: 50, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("transparency"))).toBe(true);
  });
  it("includes downscale steps for large downscale", () => {
    const r = calculateResize({ originalWidth: 4000, originalHeight: 2000, mode: "percent", scalePercent: 10, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.downscaleSteps.length).toBeGreaterThan(1);
  });
  it("returns estimated size", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, mode: "percent", scalePercent: 50, lockAspect: true, preventEnlarge: false });
    if ("error" in r) throw new Error("Should not error");
    expect(r.estimatedSizeBytes).toBeGreaterThan(0);
  });
});
