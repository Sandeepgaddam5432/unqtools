import { describe, it, expect } from "vitest";
import {
  brightness,
  rgbToHsl,
  hue,
  saturation,
  makeComparator,
  customComparator,
  sortKeyValue,
  applyEdge,
  shouldSort,
  validatePixelSortOptions,
  sortPixels,
  sortWithThreshold,
  isIdentity,
  batchValidate,
  preservesAlpha,
  findPreset,
  SORT_PRESETS,
  meanDelta,
  clampByte,
} from "./logic";

describe("brightness", () => {
  it("black is 0", () => expect(brightness([0, 0, 0])).toBe(0));
  it("white is 255", () => expect(brightness([255, 255, 255])).toBeCloseTo(255, 0));
});

describe("rgbToHsl", () => {
  it("black has h=0, s=0", () => {
    const { h, s, l } = rgbToHsl([0, 0, 0]);
    expect(h).toBe(0); expect(s).toBe(0); expect(l).toBe(0);
  });
  it("red is h=0", () => {
    expect(rgbToHsl([255, 0, 0]).h).toBeCloseTo(0, 0);
  });
  it("green is h=120", () => {
    expect(rgbToHsl([0, 255, 0]).h).toBeCloseTo(120, 0);
  });
});

describe("hue / saturation", () => {
  it("hue of red is 0", () => expect(hue([255, 0, 0])).toBeCloseTo(0, 0));
  it("saturation of gray is 0", () => expect(saturation([128, 128, 128])).toBeCloseTo(0, 0));
});

describe("sortKeyValue", () => {
  it("red key returns red channel", () => {
    expect(sortKeyValue([10, 20, 30], "red")).toBe(10);
  });
  it("brightness key returns luma", () => {
    expect(sortKeyValue([0, 0, 0], "brightness")).toBe(0);
  });
});

describe("makeComparator + customComparator", () => {
  it("ascending order", () => {
    const cmp = makeComparator("brightness", "asc");
    expect(cmp([0, 0, 0], [255, 255, 255])).toBeLessThan(0);
  });
  it("descending order", () => {
    const cmp = makeComparator("brightness", "desc");
    expect(cmp([0, 0, 0], [255, 255, 255])).toBeGreaterThan(0);
  });
  it("red key sorts by red channel", () => {
    const cmp = makeComparator("red", "asc");
    expect(cmp([10, 0, 0], [200, 0, 0])).toBeLessThan(0);
  });
  it("customComparator uses custom function", () => {
    const cmp = customComparator((p) => p[0] + p[1], "desc");
    expect(cmp([10, 10, 0], [5, 5, 0])).toBeLessThan(0);
  });
});

describe("applyEdge", () => {
  it("in-range returns unchanged", () => {
    expect(applyEdge(3, 10, "clamp")).toBe(3);
  });
  it("clamp clamps to 0..max-1", () => {
    expect(applyEdge(-5, 10, "clamp")).toBe(0);
    expect(applyEdge(15, 10, "clamp")).toBe(9);
  });
  it("wrap wraps around", () => {
    expect(applyEdge(12, 10, "wrap")).toBe(2);
    expect(applyEdge(-2, 10, "wrap")).toBe(8);
  });
  it("mirror reflects", () => {
    expect(applyEdge(10, 10, "mirror")).toBe(9);
    expect(applyEdge(11, 10, "mirror")).toBe(8);
  });
  it("zero returns -1 for out-of-range", () => {
    expect(applyEdge(20, 10, "zero")).toBe(-1);
  });
});

describe("shouldSort + sortWithThreshold", () => {
  it("shouldSort respects range", () => {
    expect(shouldSort([128, 128, 128], 50, 200)).toBe(true);
    expect(shouldSort([10, 10, 10], 50, 200)).toBe(false);
  });
  it("sortWithThreshold leaves out-of-range pixels in place", () => {
    const pixels: [number, number, number][] = [[255, 255, 255], [10, 10, 10], [128, 128, 128]];
    const cmp = makeComparator("brightness", "asc");
    const out = sortWithThreshold(pixels, cmp, 50, 200);
    expect(out[1]).toEqual([10, 10, 10]);
  });
});

describe("validatePixelSortOptions", () => {
  it("accepts valid options", () => {
    expect(validatePixelSortOptions({ key: "brightness", direction: "asc", axis: "row", threshold: 30, edge: "clamp", minLuma: 0, maxLuma: 255 })).toEqual({ ok: true });
  });
  it("rejects invalid threshold", () => {
    expect(validatePixelSortOptions({ key: "brightness", direction: "asc", axis: "row", threshold: 400, edge: "clamp", minLuma: 0, maxLuma: 255 })).toHaveProperty("error");
  });
  it("rejects bad edge mode", () => {
    expect(validatePixelSortOptions({ key: "brightness", direction: "asc", axis: "row", threshold: 30, edge: "bad" as never, minLuma: 0, maxLuma: 255 })).toHaveProperty("error");
  });
  it("rejects minLuma > maxLuma", () => {
    expect(validatePixelSortOptions({ key: "brightness", direction: "asc", axis: "row", threshold: 30, edge: "clamp", minLuma: 200, maxLuma: 100 })).toHaveProperty("error");
  });
});

describe("sortPixels", () => {
  it("sorts ascending by brightness", () => {
    const cmp = makeComparator("brightness", "asc");
    const out = sortPixels([[255, 255, 255], [0, 0, 0]], cmp);
    expect(out[0]).toEqual([0, 0, 0]);
  });
  it("does not mutate input", () => {
    const input: [number, number, number][] = [[255, 255, 255], [0, 0, 0]];
    const cmp = makeComparator("brightness", "asc");
    sortPixels(input, cmp);
    expect(input[0]).toEqual([255, 255, 255]);
  });
});

describe("helpers", () => {
  it("isIdentity true when minLuma > maxLuma", () => {
    expect(isIdentity({ key: "brightness", direction: "asc", axis: "row", threshold: 0, edge: "clamp", minLuma: 200, maxLuma: 100 })).toBe(true);
  });
  it("isIdentity false for normal opts", () => {
    expect(isIdentity({ key: "brightness", direction: "asc", axis: "row", threshold: 0, edge: "clamp", minLuma: 0, maxLuma: 255 })).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], { key: "brightness", direction: "asc", axis: "row", threshold: 0, edge: "clamp", minLuma: 0, maxLuma: 255 });
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("hue-asc")?.options.key).toBe("hue");
  });
  it("has at least 5 presets", () => {
    expect(SORT_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("meanDelta returns 0 for identical arrays", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
