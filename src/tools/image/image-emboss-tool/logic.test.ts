import { describe, it, expect } from "vitest";
import {
  embossKernel,
  embossKernel5,
  applyKernel,
  flipKernel,
  blendChannel,
  validateEmbossOptions,
  isIdentity,
  batchValidate,
  preservesAlpha,
  luma,
  meanDelta,
  findPreset,
  PRESETS,
  clampByte,
  type EmbossDirection,
  type EmbossOptions,
} from "./logic";

const DEFAULT_OPTS: EmbossOptions = {
  direction: "top", amount: 100, depth: 3, blend: "replace", baseline: 128,
};

describe("embossKernel", () => {
  it("is 3x3", () => {
    const k = embossKernel("top");
    expect(k.length).toBe(3);
    k.forEach((row) => expect(row.length).toBe(3));
  });
  it("center is always 0", () => {
    (["top", "left", "topleft", "bottomright"] as EmbossDirection[]).forEach((d) => {
      expect(embossKernel(d)[1]![1]).toBe(0);
    });
  });
  it("top has -1 at (0,1) and +1 at (2,1)", () => {
    const k = embossKernel("top");
    expect(k[0]![1]).toBe(-1);
    expect(k[2]![1]).toBe(1);
  });
  it("topleft has -1 at (0,0) and +1 at (2,2)", () => {
    const k = embossKernel("topleft");
    expect(k[0]![0]).toBe(-1);
    expect(k[2]![2]).toBe(1);
  });
});

describe("embossKernel5", () => {
  it("is 5x5", () => {
    const k = embossKernel5("top");
    expect(k.length).toBe(5);
    k.forEach((row) => expect(row.length).toBe(5));
  });
  it("topleft has -1 at (0,0) and +1 at (4,4)", () => {
    const k = embossKernel5("topleft");
    expect(k[0]![0]).toBe(-1);
    expect(k[4]![4]).toBe(1);
  });
});

describe("applyKernel", () => {
  it("returns 128 baseline when neighbors equal center", () => {
    const k = embossKernel("top");
    const v = applyKernel(k, 100, [100, 100, 100, 100, 100, 100, 100, 100], 100);
    expect(v).toBe(128);
  });
  it("clamps to 0..255", () => {
    const k = embossKernel("top");
    const v = applyKernel(k, 0, [255, 255, 255, 255, 255, 255, 255, 255], 200);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(255);
  });
  it("respects custom baseline", () => {
    const k = embossKernel("top");
    const v = applyKernel(k, 100, [100, 100, 100, 100, 100, 100, 100, 100], 100, 64);
    expect(v).toBe(64);
  });
});

describe("flipKernel + blendChannel", () => {
  it("flipKernel reverses kernel values", () => {
    const k = embossKernel("top");
    const flipped = flipKernel(k);
    expect(flipped[0]![1]).toBe(1);
    expect(flipped[2]![1]).toBe(-1);
  });
  it("blendChannel replace returns embossed", () => {
    expect(blendChannel(100, 200, "replace")).toBe(200);
  });
  it("blendChannel overlay offsets from baseline", () => {
    expect(blendChannel(100, 178, "overlay")).toBe(150);
  });
});

describe("validateEmbossOptions", () => {
  it("accepts valid options", () => {
    expect(validateEmbossOptions(DEFAULT_OPTS)).toEqual({ ok: true });
  });
  it("rejects invalid direction", () => {
    expect(validateEmbossOptions({ ...DEFAULT_OPTS, direction: "x" as never })).toHaveProperty("error");
  });
  it("rejects out-of-range amount", () => {
    expect(validateEmbossOptions({ ...DEFAULT_OPTS, amount: 300 })).toHaveProperty("error");
  });
  it("rejects bad depth", () => {
    expect(validateEmbossOptions({ ...DEFAULT_OPTS, depth: 4 as never })).toHaveProperty("error");
  });
  it("rejects bad blend", () => {
    expect(validateEmbossOptions({ ...DEFAULT_OPTS, blend: "bad" as never })).toHaveProperty("error");
  });
  it("rejects bad baseline", () => {
    expect(validateEmbossOptions({ ...DEFAULT_OPTS, baseline: 300 })).toHaveProperty("error");
  });
});

describe("helpers + presets", () => {
  it("isIdentity true when amount 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTS, amount: 0 })).toBe(true);
  });
  it("isIdentity false for defaults", () => {
    expect(isIdentity(DEFAULT_OPTS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTS);
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("luma of black is 0, white is 255", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255, 0);
  });
  it("meanDelta returns 0 for identical", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("carved")?.options.depth).toBe(5);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
