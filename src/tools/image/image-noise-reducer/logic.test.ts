import { describe, it, expect } from "vitest";
import { median, windowSamples, denoisePixel, splitChannels, validateDenoiseOptions } from "./logic";

describe("median", () => {
  it("returns middle of odd-length array", () => {
    expect(median([5, 1, 3])).toBe(3);
  });
  it("returns average of middle two for even-length", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });
  it("does not mutate input", () => {
    const a = [3, 1, 2];
    median(a);
    expect(a).toEqual([3, 1, 2]);
  });
});

describe("windowSamples", () => {
  it("collects (2r+1)^2 samples", () => {
    const ch = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const s = windowSamples(ch, 3, 3, 1, 1, 1);
    expect(s.length).toBe(9);
  });
  it("clamps at borders", () => {
    const ch = new Float32Array([1, 2, 3, 4]);
    const s = windowSamples(ch, 2, 2, 0, 0, 1);
    expect(s.length).toBe(9);
    expect(s.every((v) => v >= 1 && v <= 4)).toBe(true);
  });
});

describe("splitChannels", () => {
  it("separates RGBA bytes", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    const { r, g, b } = splitChannels(rgba, 2, 1);
    expect(r).toEqual(new Float32Array([10, 40]));
    expect(g).toEqual(new Float32Array([20, 50]));
    expect(b).toEqual(new Float32Array([30, 60]));
  });
});

describe("denoisePixel", () => {
  it("preserves alpha", () => {
    const ch = { r: new Float32Array([10, 20, 30, 10, 20, 30, 10, 20, 30]), g: new Float32Array(9), b: new Float32Array(9) };
    const out = denoisePixel(ch, 3, 3, 1, 1, { radius: 1, strength: 100 }, { r: 20, g: 0, b: 0, a: 128 });
    expect(out.a).toBe(128);
  });
  it("fully replaces at strength 100", () => {
    const ch = { r: new Float32Array([0, 0, 0, 0, 200, 0, 0, 0, 0]), g: new Float32Array(9), b: new Float32Array(9) };
    const out = denoisePixel(ch, 3, 3, 1, 1, { radius: 1, strength: 100 }, { r: 200, g: 0, b: 0, a: 255 });
    expect(out.r).toBe(0); // median of 9 values with mostly 0s
  });
  it("leaves original at strength 0", () => {
    const ch = { r: new Float32Array([0, 0, 0, 0, 200, 0, 0, 0, 0]), g: new Float32Array(9), b: new Float32Array(9) };
    const out = denoisePixel(ch, 3, 3, 1, 1, { radius: 1, strength: 0 }, { r: 200, g: 0, b: 0, a: 255 });
    expect(out.r).toBe(200);
  });
});

describe("validateDenoiseOptions", () => {
  it("accepts valid radius 1-5", () => {
    expect(validateDenoiseOptions({ radius: 1, strength: 50 })).toEqual({ ok: true });
    expect(validateDenoiseOptions({ radius: 5, strength: 100 })).toEqual({ ok: true });
  });
  it("rejects radius 0", () => {
    expect(validateDenoiseOptions({ radius: 0, strength: 50 })).toHaveProperty("error");
  });
  it("rejects radius 6", () => {
    expect(validateDenoiseOptions({ radius: 6, strength: 50 })).toHaveProperty("error");
  });
  it("rejects out-of-range strength", () => {
    expect(validateDenoiseOptions({ radius: 1, strength: 200 })).toHaveProperty("error");
  });
});
