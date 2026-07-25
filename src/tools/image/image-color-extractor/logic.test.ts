import { describe, it, expect } from "vitest";
import { rgbToHex, makeRng, colorDistanceSquared, quantize, samplePixels } from "./logic";

describe("rgbToHex", () => {
  it("converts black", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });

  it("converts white", () => {
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#FFFFFF");
  });

  it("converts red", () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#FF0000");
  });

  it("clamps out-of-range", () => {
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#FF0080");
  });

  it("pads single-digit hex", () => {
    expect(rgbToHex({ r: 1, g: 15, b: 16 })).toBe("#010F10");
  });
});

describe("makeRng", () => {
  it("is deterministic for same seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    expect(a()).toBe(b());
  });

  it("produces values in [0, 1)", () => {
    const rng = makeRng(1);
    for (let i = 0; i < 20; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("colorDistanceSquared", () => {
  it("is 0 for identical colors", () => {
    expect(colorDistanceSquared({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0);
  });

  it("computes squared distance", () => {
    expect(colorDistanceSquared({ r: 0, g: 0, b: 0 }, { r: 1, g: 0, b: 0 })).toBe(1);
  });
});

describe("quantize", () => {
  it("clusters identical pixels into one swatch", () => {
    const pixels = Array.from({ length: 10 }, () => ({ r: 100, g: 50, b: 25 }));
    const swatches = quantize(pixels, { k: 1, maxIterations: 5 }) as ReturnType<typeof quantize> extends infer T
      ? T extends { hex: string }[]
        ? T
        : never
      : never;
    expect(swatches.length).toBe(1);
    expect(swatches[0].weight).toBeCloseTo(1, 5);
  });

  it("returns k swatches for distinct colors", () => {
    const pixels = [
      { r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 }, { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 }, { r: 0, g: 0, b: 255 }, { r: 0, g: 0, b: 255 },
    ];
    const swatches = quantize(pixels, { k: 2, maxIterations: 10 }) as { hex: string }[];
    expect(swatches.length).toBe(2);
  });

  it("errors on empty pixels", () => {
    expect(quantize([], { k: 3, maxIterations: 5 })).toHaveProperty("error");
  });

  it("errors when k larger than pixels", () => {
    expect(quantize([{ r: 1, g: 1, b: 1 }], { k: 3, maxIterations: 5 })).toHaveProperty("error");
  });
});

describe("samplePixels", () => {
  it("returns all pixels if under target", () => {
    const pixels = [{ r: 0, g: 0, b: 0 }, { r: 1, g: 1, b: 1 }];
    expect(samplePixels(pixels, 5).length).toBe(2);
  });

  it("returns exactly target pixels", () => {
    const pixels = Array.from({ length: 100 }, (_, i) => ({ r: i, g: i, b: i }));
    expect(samplePixels(pixels, 10).length).toBe(10);
  });
});
