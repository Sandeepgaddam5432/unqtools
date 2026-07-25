import { describe, it, expect } from "vitest";
import { quantize, findClosest, BAYER_4X4, bayerThreshold, orderedDither, randomDither, validateDitherOptions, luma, FLOYD_STEINBERG_WEIGHTS } from "./logic";

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

describe("findClosest", () => {
  it("clamps to 0..255", () => {
    expect(findClosest(-10, 2)).toBe(0);
    expect(findClosest(300, 2)).toBe(255);
  });
});

describe("BAYER_4X4", () => {
  it("is 4x4 with values 0..15", () => {
    expect(BAYER_4X4.length).toBe(4);
    const flat = BAYER_4X4.flat();
    expect(flat.length).toBe(16);
    flat.forEach((v) => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(15); });
  });
});

describe("bayerThreshold", () => {
  it("returns values in (0,1)", () => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const t = bayerThreshold(x, y);
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
    }
  });
});

describe("orderedDither", () => {
  it("returns one of the quantized levels", () => {
    const v = orderedDither(128, 0, 0, 2);
    expect([0, 255]).toContain(v);
  });
});

describe("randomDither", () => {
  it("returns values in 0..255", () => {
    for (let i = 0; i < 10; i++) {
      const v = randomDither(128, Math.random(), 2);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe("validateDitherOptions", () => {
  it("accepts valid options", () => {
    expect(validateDitherOptions({ mode: "floyd-steinberg", levels: 2 })).toEqual({ ok: true });
  });
  it("rejects unknown mode", () => {
    expect(validateDitherOptions({ mode: "x" as never, levels: 2 })).toHaveProperty("error");
  });
  it("rejects out-of-range levels", () => {
    expect(validateDitherOptions({ mode: "ordered", levels: 32 })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
});

describe("FLOYD_STEINBERG_WEIGHTS", () => {
  it("sums to 1", () => {
    const s = FLOYD_STEINBERG_WEIGHTS.right + FLOYD_STEINBERG_WEIGHTS.bottomLeft + FLOYD_STEINBERG_WEIGHTS.bottom + FLOYD_STEINBERG_WEIGHTS.bottomRight;
    expect(s).toBeCloseTo(1, 5);
  });
});
