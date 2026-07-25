import { describe, it, expect } from "vitest";
import {
  colorDistance,
  averageColor,
  sampleCornerColors,
  isBackground,
  isBackgroundMulti,
  computeAlpha,
  floodFillMask,
  validateBgRemoveOptions,
  validateImageBounds,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("colorDistance", () => {
  it("is 0 for same color", () => {
    expect(colorDistance({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBe(0);
  });
  it("computes Euclidean distance", () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 0, b: 0 })).toBe(255);
  });
  it("is symmetric", () => {
    const a = { r: 10, g: 20, b: 30 };
    const b = { r: 100, g: 200, b: 50 };
    expect(colorDistance(a, b)).toBeCloseTo(colorDistance(b, a), 5);
  });
  it("max distance is ~442", () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(441.67, 1);
  });
});

describe("averageColor + sampleCornerColors", () => {
  it("returns average of region", () => {
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,
      200, 200, 200, 255,
      100, 100, 100, 255,
      200, 200, 200, 255,
    ]);
    const avg = averageColor(data, 2, 0, 0, 2);
    expect(avg.r).toBe(150);
    expect(avg.g).toBe(150);
    expect(avg.b).toBe(150);
  });
  it("returns 0 for empty region", () => {
    const data = new Uint8ClampedArray(0);
    const avg = averageColor(data, 2, 0, 0, 2);
    expect(avg).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("sampleCornerColors returns 4 colors", () => {
    const data = new Uint8ClampedArray(16);
    data.fill(128);
    const corners = sampleCornerColors(data, 2, 2, 1);
    expect(corners.length).toBe(4);
  });
});

describe("isBackground + isBackgroundMulti", () => {
  it("isBackground true for matching pixel", () => {
    expect(isBackground({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 }, 30)).toBe(true);
  });
  it("isBackground false for distant pixel", () => {
    expect(isBackground({ r: 0, g: 0, b: 0 }, { r: 200, g: 200, b: 200 }, 30)).toBe(false);
  });
  it("isBackgroundMulti checks all bgs", () => {
    const bgs = [{ r: 100, g: 100, b: 100 }, { r: 200, g: 200, b: 200 }];
    expect(isBackgroundMulti({ r: 100, g: 100, b: 100 }, bgs, 30)).toBe(true);
    expect(isBackgroundMulti({ r: 200, g: 200, b: 200 }, bgs, 30)).toBe(true);
    expect(isBackgroundMulti({ r: 0, g: 0, b: 0 }, bgs, 30)).toBe(false);
  });
});

describe("computeAlpha", () => {
  it("returns 0 for matching pixel", () => {
    expect(computeAlpha({ r: 100, g: 100, b: 100 }, [{ r: 100, g: 100, b: 100 }], 30, 0)).toBe(0);
  });
  it("returns 255 for non-matching pixel with no feather", () => {
    expect(computeAlpha({ r: 0, g: 0, b: 0 }, [{ r: 200, g: 200, b: 200 }], 30, 0)).toBe(255);
  });
  it("returns intermediate value with feather", () => {
    const alpha = computeAlpha({ r: 80, g: 80, b: 80 }, [{ r: 100, g: 100, b: 100 }], 30, 30);
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(255);
  });
});

describe("floodFillMask", () => {
  it("marks corner pixels as bg", () => {
    // 2x4 image (8 pixels, 32 bytes): all white except pixel (1,1) which is black
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 0, 0, 0, 255,
      255, 255, 255, 255, 255, 255, 255, 255,
      255, 255, 255, 255, 255, 255, 255, 255,
    ]);
    const mask = floodFillMask(data, 2, 4, [{ r: 255, g: 255, b: 255 }], 30);
    // Corner (0,0) → mask[0], Corner (1,0) → mask[1]
    expect(mask[0]).toBe(1);
    expect(mask[1]).toBe(1);
    // Corner (0,3) → mask[6], Corner (1,3) → mask[7]
    expect(mask[6]).toBe(1);
    expect(mask[7]).toBe(1);
    // Pixel (1,1) = mask[3] is black, not connected to corners via bg path, stays 0
    expect(mask[3]).toBe(0);
  });
  it("does not mark isolated non-bg pixels", () => {
    // 2x2 image: (0,0)=white, (1,0)=black, (0,1)=white, (1,1)=white
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, 0, 0, 0, 255,
      255, 255, 255, 255, 255, 255, 255, 255,
    ]);
    const mask = floodFillMask(data, 2, 2, [{ r: 255, g: 255, b: 255 }], 30);
    expect(mask[0]).toBe(1); // (0,0) corner
    expect(mask[2]).toBe(1); // (0,1) corner
    expect(mask[3]).toBe(1); // (1,1) corner
    expect(mask[1]).toBe(0); // (1,0) black, isolated
  });
});

describe("validateBgRemoveOptions", () => {
  it("accepts valid options", () => {
    expect(validateBgRemoveOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects bad threshold", () => {
    expect(validateBgRemoveOptions({ ...DEFAULT_OPTIONS, threshold: 500 })).toHaveProperty("error");
    expect(validateBgRemoveOptions({ ...DEFAULT_OPTIONS, threshold: -1 })).toHaveProperty("error");
  });
  it("rejects bad sample size", () => {
    expect(validateBgRemoveOptions({ ...DEFAULT_OPTIONS, sampleSize: 0 })).toHaveProperty("error");
    expect(validateBgRemoveOptions({ ...DEFAULT_OPTIONS, sampleSize: 200 })).toHaveProperty("error");
  });
  it("rejects bad feather", () => {
    expect(validateBgRemoveOptions({ ...DEFAULT_OPTIONS, feather: 100 })).toHaveProperty("error");
  });
  it("rejects bad replace color", () => {
    expect(validateBgRemoveOptions({ ...DEFAULT_OPTIONS, replaceColor: [300, 0, 0] })).toHaveProperty("error");
  });
});

describe("validateImageBounds", () => {
  it("accepts valid bounds", () => {
    expect(validateImageBounds(100, 100)).toEqual({ ok: true });
  });
  it("rejects tiny images", () => {
    expect(validateImageBounds(1, 1)).toHaveProperty("error");
  });
  it("rejects huge images", () => {
    expect(validateImageBounds(6000, 5000)).toHaveProperty("error");
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity always false", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments and decrements", () => {
    expect(nudgeValue(30, "arrowup", false)).toBe(31);
    expect(nudgeValue(30, "arrowdown", true)).toBe(20);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("greenscreen")?.options.threshold).toBe(80);
  });
  it("has at least 6 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
