import { describe, it, expect } from "vitest";
import {
  validateCharcoal,
  SOBEL_X,
  SOBEL_Y,
  applyKernel,
  sobelMagnitude,
  sobelAngle,
  luma,
  edgeToCharcoal,
  edgeToCharcoalFull,
  meanEdgeMagnitude,
  paperTexture,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("luma + kernels", () => {
  it("luma of black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("luma of white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
  it("SOBEL_X has 9 entries", () => expect(SOBEL_X.length).toBe(9));
  it("SOBEL_Y has 9 entries", () => expect(SOBEL_Y.length).toBe(9));
});

describe("applyKernel + sobelMagnitude + sobelAngle", () => {
  const gray = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  it("applyKernel returns finite number", () => {
    expect(Number.isFinite(applyKernel(gray, 1, 1, 3, 3, SOBEL_X))).toBe(true);
  });
  it("sobelMagnitude returns non-negative number", () => {
    expect(sobelMagnitude(gray, 1, 1, 3, 3)).toBeGreaterThanOrEqual(0);
  });
  it("sobelMagnitude is 0 for uniform image", () => {
    const uniform = [50, 50, 50, 50, 50, 50, 50, 50, 50];
    expect(sobelMagnitude(uniform, 1, 1, 3, 3)).toBe(0);
  });
  it("sobelAngle returns 0..360", () => {
    const a = sobelAngle(gray, 1, 1, 3, 3);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(360);
  });
});

describe("edgeToCharcoal", () => {
  it("returns 255 (white) for zero magnitude", () => {
    expect(edgeToCharcoal(0, 0.5, 0, 0.5)).toBe(255);
  });
  it("returns lower value (darker) for high magnitude", () => {
    const low = edgeToCharcoal(50, 0.5, 0, 0.5);
    const high = edgeToCharcoal(200, 0.5, 0, 0.5);
    expect(high).toBeLessThan(low);
  });
  it("texture noise can shift value", () => {
    const a = edgeToCharcoal(100, 0.5, 0.5, 0.1);
    const b = edgeToCharcoal(100, 0.5, 0.5, 0.9);
    expect(a).not.toBe(b);
  });
});

describe("edgeToCharcoalFull", () => {
  it("with zero darkness returns 255", () => {
    const v = edgeToCharcoalFull(0, { ...DEFAULT_OPTIONS, darkness: 0 }, 0.5, 0);
    expect(v).toBe(255);
  });
  it("with full darkness returns 255 for zero magnitude", () => {
    const v = edgeToCharcoalFull(0, { ...DEFAULT_OPTIONS, darkness: 1 }, 0.5, 0);
    expect(v).toBe(255);
  });
  it("returns darker value for high magnitude", () => {
    const v = edgeToCharcoalFull(200, { ...DEFAULT_OPTIONS, darkness: 1 }, 0.5, 0);
    expect(v).toBeLessThan(255);
  });
});

describe("meanEdgeMagnitude + paperTexture", () => {
  it("meanEdgeMagnitude returns 0 for uniform", () => {
    expect(meanEdgeMagnitude([50, 50, 50, 50, 50, 50, 50, 50, 50], 3, 3)).toBe(0);
  });
  it("paperTexture returns 0..1", () => {
    const v = paperTexture(5, 7, 1);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  });
  it("paperTexture is deterministic", () => {
    expect(paperTexture(5, 7, 1)).toBe(paperTexture(5, 7, 1));
  });
});

describe("validateCharcoal", () => {
  it("returns options for valid input", () => {
    const r = validateCharcoal(DEFAULT_OPTIONS);
    expect("error" in r).toBe(false);
  });
  it("rejects bad strength", () => {
    expect("error" in validateCharcoal({ ...DEFAULT_OPTIONS, strength: 2 })).toBe(true);
  });
  it("rejects bad texture", () => {
    expect("error" in validateCharcoal({ ...DEFAULT_OPTIONS, texture: -1 })).toBe(true);
  });
  it("rejects bad darkness", () => {
    expect("error" in validateCharcoal({ ...DEFAULT_OPTIONS, darkness: 2 })).toBe(true);
  });
  it("rejects bad direction", () => {
    expect("error" in validateCharcoal({ ...DEFAULT_OPTIONS, direction: 400 })).toBe(true);
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when all zero", () => {
    expect(isIdentity({ strength: 0, texture: 0, darkness: 0, direction: 0 })).toBe(true);
  });
  it("isIdentity false for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments and decrements", () => {
    expect(nudgeValue(10, "arrowup", false)).toBe(11);
    expect(nudgeValue(10, "arrowdown", true)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("dark")?.options.darkness).toBe(1);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
