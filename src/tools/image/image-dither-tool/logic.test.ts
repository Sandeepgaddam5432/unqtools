import { describe, it, expect } from "vitest";
import {
  quantize,
  findClosest,
  BAYER_4X4,
  bayerThreshold,
  orderedDither,
  randomDither,
  thresholdDither,
  validateDitherOptions,
  luma,
  clampByte,
  FLOYD_STEINBERG_WEIGHTS,
  ATKINSON_WEIGHT,
  errorDiffusion,
  floydSteinbergKernel,
  atkinsonKernel,
  jarvisKernel,
  stuckiKernel,
  ditherStats,
  batchValidate,
  isIdentity,
  preservesAlpha,
  getPalette,
  PALETTES,
  nearestPaletteColor,
} from "./logic";

describe("quantize", () => {
  it("2 levels quantizes to 0 or 255", () => {
    expect(quantize(0, 2)).toBe(0);
    expect(quantize(255, 2)).toBe(255);
    expect(quantize(128, 2)).toBe(255);
  });
  it("preserves max value", () => {
    expect(quantize(255, 4)).toBe(255);
  });
});

describe("findClosest + clampByte", () => {
  it("clamps to 0..255", () => {
    expect(findClosest(-10, 2)).toBe(0);
    expect(findClosest(300, 2)).toBe(255);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});

describe("BAYER_4X4 + bayerThreshold", () => {
  it("is 4x4 with values 0..15", () => {
    expect(BAYER_4X4.length).toBe(4);
    const flat = BAYER_4X4.flat();
    expect(flat.length).toBe(16);
    flat.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(15); });
  });
  it("returns values in (0,1)", () => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const t = bayerThreshold(x, y);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
    }
  });
});

describe("orderedDither + randomDither", () => {
  it("returns one of the quantized levels", () => {
    const v = orderedDither(128, 0, 0, 2);
    expect([0, 255]).toContain(v);
  });
  it("randomDither returns values in 0..255", () => {
    for (let i = 0; i < 10; i++) {
      const v = randomDither(128, Math.random(), 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe("thresholdDither", () => {
  it("returns 0 below threshold", () => {
    expect(thresholdDither(0, 0, 0, 128)).toEqual([0, 0, 0]);
  });
  it("returns 255 at or above threshold", () => {
    expect(thresholdDither(255, 255, 255, 128)).toEqual([255, 255, 255]);
  });
});

describe("luma + weights", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
  it("Floyd-Steinberg weights sum to 1", () => {
    const s = FLOYD_STEINBERG_WEIGHTS.right + FLOYD_STEINBERG_WEIGHTS.bottomLeft + FLOYD_STEINBERG_WEIGHTS.bottom + FLOYD_STEINBERG_WEIGHTS.bottomRight;
    expect(s).toBeCloseTo(1, 5);
  });
  it("Atkinson weight is 1/8", () => {
    expect(ATKINSON_WEIGHT).toBeCloseTo(1 / 8, 5);
  });
});

describe("kernels", () => {
  it("floydSteinbergKernel has 4 entries", () => {
    expect(floydSteinbergKernel().length).toBe(4);
  });
  it("atkinsonKernel has 6 entries", () => {
    expect(atkinsonKernel().length).toBe(6);
  });
  it("jarvisKernel has 12 entries", () => {
    expect(jarvisKernel().length).toBe(12);
  });
  it("stuckiKernel has 12 entries", () => {
    expect(stuckiKernel().length).toBe(12);
  });
  it("atkinsonKernel weights sum to 6/8 (Atkinson spreads 75% of error)", () => {
    const s = atkinsonKernel().reduce((acc, [, , w]) => acc + w, 0);
    expect(s).toBeCloseTo(6 / 8, 5);
  });
});

describe("errorDiffusion", () => {
  it("produces quantized values", () => {
    const w = 4, h = 4;
    const buf = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) { buf[i * 3] = 100; buf[i * 3 + 1] = 100; buf[i * 3 + 2] = 100; }
    errorDiffusion(buf, w, h, 2, floydSteinbergKernel());
    for (let i = 0; i < buf.length; i++) {
      expect([0, 255]).toContain(buf[i]);
    }
  });
});

describe("validateDitherOptions", () => {
  it("accepts valid options", () => {
    expect(validateDitherOptions({ mode: "floyd-steinberg", levels: 2, threshold: 128, palette: "mono" })).toEqual({ ok: true });
  });
  it("rejects unknown mode", () => {
    expect(validateDitherOptions({ mode: "x" as never, levels: 2, threshold: 128, palette: "mono" })).toHaveProperty("error");
  });
  it("rejects out-of-range levels", () => {
    expect(validateDitherOptions({ mode: "ordered", levels: 32, threshold: 128, palette: "mono" })).toHaveProperty("error");
  });
  it("rejects bad threshold", () => {
    expect(validateDitherOptions({ mode: "threshold", levels: 2, threshold: 500, palette: "mono" })).toHaveProperty("error");
  });
  it("rejects unknown palette", () => {
    expect(validateDitherOptions({ mode: "bayer", levels: 2, threshold: 128, palette: "xyz" })).toHaveProperty("error");
  });
});

describe("palettes + helpers", () => {
  it("PALETTES has at least 5 palettes", () => {
    expect(Object.keys(PALETTES).length).toBeGreaterThanOrEqual(5);
  });
  it("getPalette returns mono fallback", () => {
    expect(getPalette("nonexistent")).toBe(PALETTES.mono);
  });
  it("nearestPaletteColor finds nearest in palette", () => {
    const palette: [number, number, number][] = [[0, 0, 0], [255, 255, 255]];
    expect(nearestPaletteColor(palette, 10, 10, 10)).toEqual([0, 0, 0]);
    expect(nearestPaletteColor(palette, 200, 200, 200)).toEqual([255, 255, 255]);
  });
});

describe("ditherStats + batch + identity + alpha", () => {
  it("ditherStats returns onRatio and meanLuma", () => {
    const px = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    const s = ditherStats(px);
    expect(s.onRatio).toBeCloseTo(0.5, 5);
    expect(s.meanLuma).toBeGreaterThan(0);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], { mode: "bayer", levels: 2, threshold: 128, palette: "mono" });
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("isIdentity always false", () => {
    expect(isIdentity({ mode: "bayer", levels: 2, threshold: 128, palette: "mono" })).toBe(false);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});
