import { describe, it, expect } from "vitest";
import { brightness, rgbToHsl, hue, saturation, makeComparator, validatePixelSortOptions, sortPixels } from "./logic";

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

describe("makeComparator", () => {
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
});

describe("validatePixelSortOptions", () => {
  it("accepts valid options", () => {
    expect(validatePixelSortOptions({ key: "brightness", direction: "asc", axis: "row", threshold: 30 })).toEqual({ ok: true });
  });
  it("rejects invalid threshold", () => {
    expect(validatePixelSortOptions({ key: "brightness", direction: "asc", axis: "row", threshold: 400 })).toHaveProperty("error");
  });
});

describe("sortPixels", () => {
  it("sorts ascending by brightness", () => {
    const cmp = makeComparator("brightness", "asc");
    const out = sortPixels([[255, 255, 255], [0, 0, 0]], cmp);
    expect(out[0]).toEqual([0, 0, 0]);
  });
});
