/**
 * Image Upscaler — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  computeOutputDimensions, multiStepPath, lanczosKernel, bicubicWeight,
  nearestSourceCoord, estimateMemory, qualityEstimate, unsharpKernel,
  applyKernel3x3, validateInput, calculateUpscale, buildFilename,
  canvasSmoothingQuality, shouldSmooth,
} from "./logic";
import type { UpscaleInput } from "./logic";

const validInput = (over: Partial<UpscaleInput> = {}): UpscaleInput => ({
  srcWidth: 1000, srcHeight: 800, scale: 2, method: "bicubic",
  sharpen: 0.3, format: "image/png", quality: 0.92, ...over,
});

describe("computeOutputDimensions", () => {
  it("doubles at 2x", () => {
    expect(computeOutputDimensions(1000, 800, 2)).toEqual({ width: 2000, height: 1600 });
  });
  it("handles fractional scale", () => {
    const d = computeOutputDimensions(1000, 800, 1.5);
    expect(d.width).toBe(1500);
  });
  it("clamps to 16000", () => {
    const d = computeOutputDimensions(10000, 10000, 4);
    expect(d.width).toBeLessThanOrEqual(16000);
  });
});

describe("multiStepPath", () => {
  it("returns single step for ≤2x", () => {
    const s = multiStepPath(100, 100, 2);
    expect(s.length).toBe(1);
  });
  it("returns multiple steps for >2x", () => {
    const s = multiStepPath(100, 100, 4);
    expect(s.length).toBe(2);
    expect(s[s.length - 1]).toEqual({ width: 400, height: 400 });
  });
  it("returns 3 steps for 8x", () => {
    const s = multiStepPath(100, 100, 8);
    expect(s.length).toBe(3);
  });
});

describe("lanczosKernel", () => {
  it("returns 1 at x=0", () => {
    expect(lanczosKernel(0)).toBe(1);
  });
  it("returns 0 outside window", () => {
    expect(lanczosKernel(4)).toBe(0);
    expect(lanczosKernel(-4)).toBe(0);
  });
  it("returns value inside window", () => {
    expect(lanczosKernel(0.5)).not.toBe(0);
  });
});

describe("bicubicWeight", () => {
  it("returns 1 at x=0", () => {
    expect(bicubicWeight(0)).toBe(1);
  });
  it("returns 0 at |x|≥2", () => {
    expect(bicubicWeight(2)).toBe(0);
    expect(bicubicWeight(-2)).toBe(0);
  });
});

describe("nearestSourceCoord", () => {
  it("computes floor division", () => {
    expect(nearestSourceCoord(0, 2)).toBe(0);
    expect(nearestSourceCoord(2, 2)).toBe(1);
    expect(nearestSourceCoord(4, 2)).toBe(2);
  });
});

describe("estimateMemory", () => {
  it("computes RGBA bytes", () => {
    expect(estimateMemory(1000, 1000)).toBe(4_000_000);
  });
});

describe("qualityEstimate", () => {
  it("nearest is lowest", () => {
    expect(qualityEstimate("nearest", 2, false)).toBeLessThan(qualityEstimate("bilinear", 2, false));
  });
  it("lanczos is highest", () => {
    expect(qualityEstimate("lanczos", 2, false)).toBeGreaterThan(qualityEstimate("bicubic", 2, false));
  });
  it("sharpen adds bonus", () => {
    expect(qualityEstimate("bicubic", 2, true)).toBeGreaterThan(qualityEstimate("bicubic", 2, false));
  });
  it("higher scale lowers quality", () => {
    expect(qualityEstimate("bicubic", 4, false)).toBeLessThan(qualityEstimate("bicubic", 2, false));
  });
});

describe("unsharpKernel", () => {
  it("returns 9 values", () => {
    expect(unsharpKernel(0.5).length).toBe(9);
  });
  it("center > 1 when strength > 0", () => {
    const k = unsharpKernel(0.5);
    expect(k[4]).toBeGreaterThan(1);
  });
  it("sides are negative", () => {
    const k = unsharpKernel(0.5);
    expect(k[1]).toBeLessThan(0);
    expect(k[3]).toBeLessThan(0);
  });
  it("sums to 1 (identity when kSum normalizes)", () => {
    const k = unsharpKernel(0.3);
    const sum = k.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe("applyKernel3x3", () => {
  it("identity kernel returns source value", () => {
    const pixels = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const kernel = [0, 0, 0, 0, 1, 0, 0, 0, 0];
    expect(applyKernel3x3(pixels, 2, 2, 0, 0, 0, kernel)).toBe(10);
  });
  it("clamps to 0-255", () => {
    const pixels = [200, 200, 200, 200];
    const kernel = [0, 0, 0, 0, 5, 0, 0, 0, 0];
    const r = applyKernel3x3(pixels, 1, 1, 0, 0, 0, kernel);
    expect(r).toBeLessThanOrEqual(255);
  });
});

describe("validateInput", () => {
  it("accepts valid", () => {
    expect("ok" in validateInput(validInput())).toBe(true);
  });
  it("errors on non-positive source", () => {
    expect("error" in validateInput(validInput({ srcWidth: 0 }))).toBe(true);
  });
  it("errors on scale > 16", () => {
    expect("error" in validateInput(validInput({ scale: 20 }))).toBe(true);
  });
  it("errors on out-of-range sharpen", () => {
    expect("error" in validateInput(validInput({ sharpen: 2 }))).toBe(true);
  });
});

describe("calculateUpscale", () => {
  it("returns dimensions and steps", () => {
    const r = calculateUpscale(validInput());
    if ("error" in r) throw new Error("should not error");
    expect(r.width).toBe(2000);
    expect(r.height).toBe(1600);
    expect(r.steps.length).toBeGreaterThanOrEqual(1);
    expect(r.estimatedMemoryBytes).toBeGreaterThan(0);
    expect(r.qualityScore).toBeGreaterThan(0);
  });
  it("warns on large output", () => {
    const r = calculateUpscale(validInput({ srcWidth: 5000, srcHeight: 5000, scale: 3 }));
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("memory"))).toBe(true);
  });
  it("warns on nearest method", () => {
    const r = calculateUpscale(validInput({ method: "nearest" }));
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Nearest"))).toBe(true);
  });
});

describe("buildFilename", () => {
  it("includes scale and method", () => {
    expect(buildFilename(2, "lanczos", "image/png")).toBe("upscaled-2x-lanczos.png");
  });
});

describe("canvasSmoothingQuality & shouldSmooth", () => {
  it("nearest → low", () => {
    expect(canvasSmoothingQuality("nearest")).toBe("low");
  });
  it("lanczos → high", () => {
    expect(canvasSmoothingQuality("lanczos")).toBe("high");
  });
  it("nearest does not smooth", () => {
    expect(shouldSmooth("nearest")).toBe(false);
  });
  it("bilinear smooths", () => {
    expect(shouldSmooth("bilinear")).toBe(true);
  });
});
