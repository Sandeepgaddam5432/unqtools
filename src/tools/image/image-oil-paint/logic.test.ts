import { describe, it, expect } from "vitest";
import { validateOil, quantize, quantizeRgb, packRgb, dominantColor } from "./logic";

describe("validateOil", () => {
  it("passes valid opts", () => {
    expect(validateOil({ radius: 4, levels: 8 })).toEqual({ radius: 4, levels: 8 });
  });
  it("rounds radius and levels", () => {
    expect(validateOil({ radius: 3.6, levels: 7.2 })).toEqual({ radius: 4, levels: 7 });
  });
  it("errors on bad radius", () => {
    expect(validateOil({ radius: 50, levels: 8 })).toHaveProperty("error");
  });
  it("errors on bad levels", () => {
    expect(validateOil({ radius: 4, levels: 1 })).toHaveProperty("error");
    expect(validateOil({ radius: 4, levels: 100 })).toHaveProperty("error");
  });
});

describe("quantize", () => {
  it("quantizes to a step midpoint", () => {
    // 4 levels → step 64 → midpoints 32, 96, 160, 224
    expect(quantize(0, 4)).toBe(32);
    expect(quantize(255, 4)).toBe(224);
  });
  it("quantize(0,2) returns 64", () => {
    expect(quantize(0, 2)).toBe(64);
  });
  it("never exceeds 255", () => {
    expect(quantize(255, 16)).toBeLessThanOrEqual(255);
  });
});

describe("quantizeRgb", () => {
  it("quantizes each channel independently", () => {
    const [r, g, b] = quantizeRgb(10, 120, 250, 2);
    expect(r).toBe(64);
    expect(g).toBe(64);
    expect(b).toBe(192);
  });
});

describe("packRgb", () => {
  it("packs and unpacks", () => {
    const key = packRgb(10, 20, 30);
    expect((key >> 16) & 0xff).toBe(10);
    expect((key >> 8) & 0xff).toBe(20);
    expect(key & 0xff).toBe(30);
  });
});

describe("dominantColor", () => {
  it("returns the most common color", () => {
    // 3×3 block, mostly red
    const px = new Uint8ClampedArray(9 * 4);
    for (let i = 0; i < 9; i++) {
      px[i * 4] = 200; px[i * 4 + 1] = 0; px[i * 4 + 2] = 0; px[i * 4 + 3] = 255;
    }
    px[8] = 0; px[9] = 200; // one green pixel
    const [r, g, b] = dominantColor(px, 3, 3, 1, 1, 1, 4);
    expect(r).toBeGreaterThan(g);
  });
  it("returns black for empty neighborhood", () => {
    const px = new Uint8ClampedArray(0);
    expect(dominantColor(px, 0, 0, 0, 0, 0, 4)).toEqual([0, 0, 0]);
  });
  it("handles radius 0 (just the center pixel)", () => {
    const px = new Uint8ClampedArray(4);
    px[0] = 100; px[1] = 150; px[2] = 200; px[3] = 255;
    const [r, g, b] = dominantColor(px, 1, 1, 0, 0, 0, 4);
    expect([r, g, b]).toEqual([100, 150, 200]);
  });
});
