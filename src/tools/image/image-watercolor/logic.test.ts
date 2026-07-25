import { describe, it, expect } from "vitest";
import {
  validateWatercolor,
  windowAverage,
  blendSoft,
  spreadWeight,
  paperNoise,
  applyPaper,
  applyPigment,
  watercolorPixel,
  isIdentity,
  meanDelta,
  batchValidate,
  findPreset,
  preservesAlpha,
  luma,
  clampByte,
  PRESETS,
  DEFAULT_OPTIONS,
} from "./logic";

describe("validateWatercolor", () => {
  it("passes valid opts", () => {
    expect(validateWatercolor(DEFAULT_OPTIONS)).toEqual({ ...DEFAULT_OPTIONS, radius: 3 });
  });
  it("rounds radius", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, radius: 3.6 }).radius).toBe(4);
  });
  it("errors on bad radius", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, radius: 30 })).toHaveProperty("error");
  });
  it("errors on bad spread", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, spread: 2 })).toHaveProperty("error");
  });
  it("errors on bad soften", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, soften: -1 })).toHaveProperty("error");
  });
  it("errors on bad paper", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, paper: 5 })).toHaveProperty("error");
  });
  it("errors on bad wet", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, wet: 2 })).toHaveProperty("error");
  });
  it("errors on bad pigment", () => {
    expect(validateWatercolor({ ...DEFAULT_OPTIONS, pigment: 3 })).toHaveProperty("error");
  });
});

describe("windowAverage", () => {
  it("averages window colors", () => {
    const px = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) { px[i * 4] = 90; px[i * 4 + 1] = 180; px[i * 4 + 2] = 30; px[i * 4 + 3] = 255; }
    const [r, g, b] = windowAverage(px, 3, 3, 1, 1, 1);
    expect(r).toBeCloseTo(90);
    expect(g).toBeCloseTo(180);
    expect(b).toBeCloseTo(30);
  });
  it("returns 0,0,0 for out-of-bounds", () => {
    const px = new Uint8ClampedArray(0);
    expect(windowAverage(px, 0, 0, 0, 0, 0)).toEqual([0, 0, 0]);
  });
  it("ignores out-of-window pixels", () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 100; px[1] = 100; px[2] = 100; px[3] = 255;
    const [r] = windowAverage(px, 1, 1, 0, 0, 5);
    expect(r).toBeCloseTo(100);
  });
});

describe("blendSoft", () => {
  it("blends toward target", () => {
    expect(blendSoft([0, 0, 0, 255], [100, 100, 100], 0.5)).toEqual([50, 50, 50, 255]);
  });
  it("no blend at amount 0", () => {
    expect(blendSoft([10, 20, 30, 255], [200, 200, 200], 0)).toEqual([10, 20, 30, 255]);
  });
  it("full blend at amount 1", () => {
    expect(blendSoft([10, 20, 30, 255], [200, 200, 200], 1)).toEqual([200, 200, 200, 255]);
  });
  it("clamps >1", () => {
    expect(blendSoft([0, 0, 0, 255], [300, 300, 300], 5)).toEqual([255, 255, 255, 255]);
  });
});

describe("spreadWeight", () => {
  it("is 1 at center", () => {
    expect(spreadWeight(0, 5)).toBe(1);
  });
  it("is 0 at or beyond radius", () => {
    expect(spreadWeight(5, 5)).toBe(0);
    expect(spreadWeight(10, 5)).toBe(0);
  });
  it("is 1 for radius 0", () => {
    expect(spreadWeight(100, 0)).toBe(1);
  });
  it("decreases linearly", () => {
    expect(spreadWeight(2, 5)).toBeCloseTo(0.6);
  });
});

describe("paperNoise + applyPaper", () => {
  it("paperNoise returns value in [0,1)", () => {
    for (let i = 0; i < 20; i++) {
      const v = paperNoise(i, i * 2, i + 1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it("applyPaper is identity at amount 0", () => {
    expect(applyPaper([100, 100, 100], 0.5, 0)).toEqual([100, 100, 100]);
  });
  it("applyPaper can shift values", () => {
    const v = applyPaper([100, 100, 100], 0.1, 1);
    expect(v[0]).not.toBe(100);
  });
});

describe("applyPigment", () => {
  it("is identity at pigment 1", () => {
    expect(applyPigment([100, 50, 25], 1)).toEqual([100, 50, 25]);
  });
  it("boosts saturation at pigment > 1", () => {
    const v = applyPigment([100, 50, 25], 2);
    expect(v[0]).toBeGreaterThan(100);
    expect(v[2]).toBeLessThan(25);
  });
});

describe("watercolorPixel", () => {
  it("returns 4-tuple", () => {
    const out = watercolorPixel([100, 100, 100, 255], [120, 120, 120], DEFAULT_OPTIONS, 0.5);
    expect(out.length).toBe(4);
  });
  it("keeps alpha unchanged", () => {
    const out = watercolorPixel([100, 100, 100, 200], [120, 120, 120], DEFAULT_OPTIONS, 0.5);
    expect(out[3]).toBe(200);
  });
});

describe("isIdentity + meanDelta + batch", () => {
  it("isIdentity true for neutral options", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, soften: 0, spread: 0, paper: 0, pigment: 1 })).toBe(true);
  });
  it("isIdentity false for defaults", () => {
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("meanDelta returns 0 for identical arrays", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("meanDelta returns positive for different arrays", () => {
    expect(meanDelta(new Uint8ClampedArray([10, 20, 30, 255]), new Uint8ClampedArray([100, 50, 60, 255]))).toBeGreaterThan(0);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect("error" in r[0]!.result).toBe(false);
  });
});

describe("presets + alpha + luma + clampByte", () => {
  it("findPreset returns matching", () => {
    expect(findPreset("vivid")?.options.pigment).toBe(1.6);
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("luma of black is 0, white is 255", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255, 0);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
