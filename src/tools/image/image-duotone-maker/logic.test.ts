import { describe, it, expect } from "vitest";
import {
  luma,
  validateDuotone,
  applyContrast,
  lerpColor,
  tritoneColor,
  duotonePixel,
  applyDuotone,
  paletteToCss,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  clampByte,
} from "./logic";

describe("luma", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
});

describe("applyContrast", () => {
  it("contrast 1 is identity", () => {
    expect(applyContrast(0.5, 1)).toBe(0.5);
  });
  it("contrast > 1 brightens midtone values", () => {
    const out = applyContrast(0.3, 2);
    expect(out).toBeGreaterThan(0.3);
  });
  it("contrast < 1 darkens midtone values", () => {
    const out = applyContrast(0.3, 0.5);
    expect(out).toBeLessThan(0.3);
  });
});

describe("lerpColor", () => {
  it("returns first color at t=0", () => {
    expect(lerpColor([10, 20, 30], [200, 210, 220], 0)).toEqual([10, 20, 30]);
  });
  it("returns second color at t=1", () => {
    expect(lerpColor([10, 20, 30], [200, 210, 220], 1)).toEqual([200, 210, 220]);
  });
  it("returns midpoint at t=0.5", () => {
    expect(lerpColor([0, 0, 0], [100, 100, 100], 0.5)).toEqual([50, 50, 50]);
  });
  it("clamps t out of range", () => {
    expect(lerpColor([0, 0, 0], [100, 100, 100], 2)).toEqual([100, 100, 100]);
  });
});

describe("tritoneColor", () => {
  it("returns shadow at t=0", () => {
    expect(tritoneColor([10, 0, 0], [100, 100, 100], [200, 200, 200], 0)).toEqual([10, 0, 0]);
  });
  it("returns highlight at t=1", () => {
    expect(tritoneColor([10, 0, 0], [100, 100, 100], [200, 200, 200], 1)).toEqual([200, 200, 200]);
  });
  it("returns midtone at t=0.5", () => {
    expect(tritoneColor([0, 0, 0], [100, 100, 100], [200, 200, 200], 0.5)).toEqual([100, 100, 100]);
  });
});

describe("duotonePixel", () => {
  it("returns shadow color for black pixel", () => {
    const out = duotonePixel(0, 0, 0, DEFAULT_OPTIONS);
    expect(out).toEqual(DEFAULT_OPTIONS.shadow);
  });
  it("returns highlight color for white pixel", () => {
    const out = duotonePixel(255, 255, 255, DEFAULT_OPTIONS);
    expect(out).toEqual(DEFAULT_OPTIONS.highlight);
  });
  it("inverts mapping when invert is true", () => {
    const out = duotonePixel(0, 0, 0, { ...DEFAULT_OPTIONS, invert: true });
    expect(out).toEqual(DEFAULT_OPTIONS.highlight);
  });
  it("uses midtone when provided", () => {
    const opts = { ...DEFAULT_OPTIONS, midtone: [100, 100, 100] as [number, number, number] };
    const out = duotonePixel(128, 128, 128, opts);
    // Luma 128 ≈ 0.502; tritone at t≈0.502 → very close to midtone
    expect(out[0]).toBeGreaterThanOrEqual(100);
    expect(out[0]).toBeLessThanOrEqual(102);
  });
});

describe("applyDuotone", () => {
  it("preserves alpha", () => {
    const out = applyDuotone([100, 100, 100, 128], DEFAULT_OPTIONS);
    expect(out[3]).toBe(128);
  });
  it("intensity 0 is identity", () => {
    const out = applyDuotone([100, 100, 100, 255], { ...DEFAULT_OPTIONS, intensity: 0 });
    expect(out).toEqual([100, 100, 100, 255]);
  });
  it("intensity 1 fully maps", () => {
    const out = applyDuotone([255, 255, 255, 255], DEFAULT_OPTIONS);
    expect(out).toEqual([...DEFAULT_OPTIONS.highlight, 255]);
  });
});

describe("validateDuotone", () => {
  it("returns options for valid input", () => {
    expect("error" in validateDuotone(DEFAULT_OPTIONS)).toBe(false);
  });
  it("rejects bad shadow color", () => {
    expect("error" in validateDuotone({ ...DEFAULT_OPTIONS, shadow: [300, 0, 0] })).toBe(true);
  });
  it("rejects bad highlight color", () => {
    expect("error" in validateDuotone({ ...DEFAULT_OPTIONS, highlight: [-1, 0, 0] })).toBe(true);
  });
  it("rejects bad midtone color", () => {
    expect("error" in validateDuotone({ ...DEFAULT_OPTIONS, midtone: [300, 0, 0] })).toBe(true);
  });
  it("rejects bad contrast", () => {
    expect("error" in validateDuotone({ ...DEFAULT_OPTIONS, contrast: 3 })).toBe(true);
  });
  it("rejects bad intensity", () => {
    expect("error" in validateDuotone({ ...DEFAULT_OPTIONS, intensity: 2 })).toBe(true);
  });
});

describe("paletteToCss", () => {
  it("generates 2-color gradient for duotone", () => {
    const css = paletteToCss(DEFAULT_OPTIONS);
    expect(css).toContain("linear-gradient");
    expect(css).toContain("rgb(10, 20, 60)");
    expect(css).toContain("rgb(255, 220, 150)");
  });
  it("generates 3-color gradient for tritone", () => {
    const opts = { ...DEFAULT_OPTIONS, midtone: [100, 100, 100] as [number, number, number] };
    const css = paletteToCss(opts);
    expect(css.match(/rgb/g)?.length).toBe(3);
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when intensity 0", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, intensity: 0 })).toBe(true);
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
  it("nudgeValue increments by 0.01", () => {
    expect(nudgeValue(0.5, "arrowup", false)).toBeCloseTo(0.51);
  });
  it("nudgeValue increments by 0.1 with shift", () => {
    expect(nudgeValue(0.5, "arrowup", true)).toBeCloseTo(0.6);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("noir")?.options.contrast).toBe(1.5);
  });
  it("has at least 7 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(7);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
