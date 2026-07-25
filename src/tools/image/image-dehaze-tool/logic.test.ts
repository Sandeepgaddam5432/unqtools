import { describe, it, expect } from "vitest";
import {
  darkChannelValue,
  estimateAirlight,
  estimateTransmission,
  recoverPixel,
  clamp8,
  validateOmega,
  dehazePixel,
  type PixelRGB,
} from "./logic";

describe("darkChannelValue", () => {
  it("returns the min channel", () => {
    expect(darkChannelValue({ r: 100, g: 50, b: 200 })).toBe(50);
  });

  it("handles dark pixels", () => {
    expect(darkChannelValue({ r: 10, g: 5, b: 1 })).toBe(1);
  });
});

describe("estimateAirlight", () => {
  it("picks the brightest dark-channel pixel", () => {
    const pixels: PixelRGB[] = [
      { r: 100, g: 100, b: 100 },
      { r: 250, g: 240, b: 230 },
      { r: 50, g: 50, b: 50 },
    ];
    const darks = [50, 200, 30];
    const a = estimateAirlight(pixels, darks);
    if ("error" in a) throw new Error("err");
    expect(a).toEqual({ r: 250, g: 240, b: 230 });
  });

  it("errors on empty input", () => {
    expect("error" in estimateAirlight([], [])).toBe(true);
  });

  it("errors on mismatched lengths", () => {
    expect("error" in estimateAirlight([{ r: 0, g: 0, b: 0 }], [1, 2])).toBe(true);
  });
});

describe("estimateTransmission", () => {
  it("returns close to 1 for clear pixels", () => {
    // pixel much darker than airlight → dark ratio ~0.04 → t = 1-0.95*0.04 ≈ 0.96
    const t = estimateTransmission({ r: 10, g: 10, b: 10 }, { r: 250, g: 250, b: 250 }, 0.95);
    expect(t).toBeGreaterThan(0.9);
  });

  it("returns lower transmission for hazy pixels", () => {
    const t = estimateTransmission({ r: 240, g: 240, b: 240 }, { r: 250, g: 250, b: 250 }, 0.95);
    expect(t).toBeLessThan(0.2);
  });

  it("floors transmission at 0.1", () => {
    const t = estimateTransmission({ r: 250, g: 250, b: 250 }, { r: 250, g: 250, b: 250 }, 1);
    expect(t).toBeGreaterThanOrEqual(0.1);
  });
});

describe("recoverPixel", () => {
  it("recovers original colors when transmission is 1", () => {
    const r = recoverPixel(
      { r: 100, g: 80, b: 60 },
      { r: 200, g: 200, b: 200 },
      1,
    );
    expect(r).toEqual({ r: 100, g: 80, b: 60 });
  });

  it("clamps recovered values to byte range", () => {
    const r = recoverPixel({ r: 255, g: 255, b: 255 }, { r: 10, g: 10, b: 10 }, 0.1);
    expect(r.r).toBeLessThanOrEqual(255);
    expect(r.r).toBeGreaterThanOrEqual(0);
  });
});

describe("clamp8", () => {
  it("clamps above 255 to 255", () => {
    expect(clamp8(300)).toBe(255);
  });

  it("clamps below 0 to 0", () => {
    expect(clamp8(-10)).toBe(0);
  });

  it("rounds floats", () => {
    expect(clamp8(12.7)).toBe(13);
  });
});

describe("validateOmega", () => {
  it("accepts 0..1", () => {
    expect(validateOmega(0.95)).toBe(0.95);
  });

  it("rejects out-of-range", () => {
    expect("error" in validateOmega(1.5)).toBe(true);
    expect("error" in validateOmega(-0.1)).toBe(true);
  });

  it("rejects NaN", () => {
    expect("error" in validateOmega(NaN)).toBe(true);
  });
});

describe("dehazePixel", () => {
  it("combines transmission + recovery", () => {
    const out = dehazePixel({ r: 100, g: 100, b: 100 }, { r: 200, g: 200, b: 200 }, 0.95);
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(255);
  });
});
