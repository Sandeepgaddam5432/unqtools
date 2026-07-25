import { describe, it, expect } from "vitest";
import {
  alphaBlend,
  fadeBlend,
  gradientWeight,
  featherMask,
  blendAt,
  averagePixels,
  fadeWeights,
  validateSameSize,
  validateBlendOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  findPreset,
  PRESETS,
  clampByte,
  meanDelta,
  luma,
  type BlendOptions,
} from "./logic";

const OPTS: BlendOptions = { mode: "fade", weight: 0.5, feather: 10, gradientDir: "horizontal" };

describe("alphaBlend", () => {
  it("keeps opaque top fully over base", () => {
    expect(alphaBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 0, b: 0, a: 255 }))
      .toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });
  it("preserves base when top is transparent", () => {
    expect(alphaBlend({ r: 50, g: 60, b: 70, a: 255 }, { r: 255, g: 255, b: 255, a: 0 }))
      .toEqual({ r: 50, g: 60, b: 70, a: 255 });
  });
  it("mixes semi-transparent top with base", () => {
    const out = alphaBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 128 });
    expect(out.r).toBeCloseTo(128, 0);
    expect(out.a).toBe(255);
  });
});

describe("fadeBlend", () => {
  it("returns base at weight 0", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, 0))
      .toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
  it("returns top at weight 1", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }, 1))
      .toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
  it("mixes at weight 0.5", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 255 }, { r: 100, g: 100, b: 100, a: 255 }, 0.5))
      .toEqual({ r: 50, g: 50, b: 50, a: 255 });
  });
  it("clamps weight outside [0,1]", () => {
    expect(fadeBlend({ r: 0, g: 0, b: 0, a: 0 }, { r: 255, g: 255, b: 255, a: 255 }, 5))
      .toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
});

describe("gradientWeight + featherMask", () => {
  it("gradientWeight horizontal goes 0..1 left-to-right", () => {
    expect(gradientWeight(0, 0, 100, 100, "horizontal")).toBe(0);
    expect(gradientWeight(99, 0, 100, 100, "horizontal")).toBe(1);
  });
  it("gradientWeight vertical goes 0..1 top-to-bottom", () => {
    expect(gradientWeight(0, 0, 100, 100, "vertical")).toBe(0);
    expect(gradientWeight(0, 99, 100, 100, "vertical")).toBe(1);
  });
  it("featherMask is 0 at edge", () => {
    expect(featherMask(0, 0, 100, 100, 10)).toBe(0);
  });
  it("featherMask is 1 in interior", () => {
    expect(featherMask(50, 50, 100, 100, 10)).toBe(1);
  });
  it("featherMask is 1 when radius is 0", () => {
    expect(featherMask(0, 0, 100, 100, 0)).toBe(1);
  });
});

describe("blendAt", () => {
  it("alpha mode uses alphaBlend", () => {
    const out = blendAt({ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 0, b: 0, a: 255 }, 0, 0, 10, 10, { ...OPTS, mode: "alpha" });
    expect(out).toEqual({ r: 255, g: 0, b: 0, a: 255 });
  });
  it("gradient mode varies with position", () => {
    const a = blendAt({ r: 0, g: 0, b: 0, a: 255 }, { r: 100, g: 100, b: 100, a: 255 }, 0, 0, 10, 10, { ...OPTS, mode: "gradient", gradientDir: "horizontal" });
    const b = blendAt({ r: 0, g: 0, b: 0, a: 255 }, { r: 100, g: 100, b: 100, a: 255 }, 9, 0, 10, 10, { ...OPTS, mode: "gradient", gradientDir: "horizontal" });
    expect(b.r).toBeGreaterThan(a.r);
  });
});

describe("averagePixels", () => {
  it("averages pixel values", () => {
    const out = averagePixels([
      { r: 0, g: 0, b: 0, a: 255 },
      { r: 100, g: 100, b: 100, a: 255 },
      { r: 200, g: 200, b: 200, a: 255 },
    ]);
    expect(out).toEqual({ r: 100, g: 100, b: 100, a: 255 });
  });
  it("returns zeros for empty list", () => {
    expect(averagePixels([])).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});

describe("fadeWeights", () => {
  it("returns single weight for count 1", () => {
    expect(fadeWeights(1)).toEqual([1]);
  });
  it("returns symmetrical cosine-eased weights", () => {
    const w = fadeWeights(3);
    expect(w.length).toBe(3);
    expect(w[0]).toBeCloseTo(0, 6);
    expect(w[2]).toBeCloseTo(1, 6);
    expect(w[1]).toBeCloseTo(0.5, 6);
  });
});

describe("validateSameSize", () => {
  it("accepts matching sizes", () => {
    expect(validateSameSize([{ width: 10, height: 20 }, { width: 10, height: 20 }]))
      .toEqual({ width: 10, height: 20 });
  });
  it("errors on empty input", () => {
    expect("error" in validateSameSize([])).toBe(true);
  });
  it("errors on mismatched sizes", () => {
    expect("error" in validateSameSize([{ width: 10, height: 10 }, { width: 11, height: 10 }])).toBe(true);
  });
});

describe("validateBlendOptions + helpers + presets", () => {
  it("accepts valid options", () => {
    expect(validateBlendOptions(OPTS)).toEqual({ ok: true });
  });
  it("rejects bad mode", () => {
    expect(validateBlendOptions({ ...OPTS, mode: "bad" as never })).toHaveProperty("error");
  });
  it("rejects bad weight", () => {
    expect(validateBlendOptions({ ...OPTS, weight: 2 })).toHaveProperty("error");
  });
  it("rejects bad feather", () => {
    expect(validateBlendOptions({ ...OPTS, feather: 1000 })).toHaveProperty("error");
  });
  it("isIdentity true when fade and weight 0", () => {
    expect(isIdentity({ ...OPTS, mode: "fade", weight: 0 })).toBe(true);
  });
  it("isIdentity false for alpha mode", () => {
    expect(isIdentity({ ...OPTS, mode: "alpha" })).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], OPTS);
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("gradient-h")?.options.mode).toBe("gradient");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
});
