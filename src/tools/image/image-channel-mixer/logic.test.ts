import { describe, it, expect } from "vitest";
import {
  IDENTITY_MATRIX,
  SWAP_RB_MATRIX,
  SWAP_RG_MATRIX,
  SWAP_GB_MATRIX,
  INVERT_MATRIX,
  ZERO_R_MATRIX,
  ZERO_G_MATRIX,
  ZERO_B_MATRIX,
  mixPixel,
  grayscaleMatrix,
  sepiaMatrix,
  validateMatrix,
  scaleOutputChannel,
  addMatrices,
  scaleMatrix,
  extractChannel,
  isIdentity,
  luma,
  meanDelta,
  batchValidate,
  preservesAlpha,
  findPreset,
  MATRIX_PRESETS,
  clampByte,
} from "./logic";

describe("IDENTITY_MATRIX", () => {
  it("leaves pixels unchanged", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, IDENTITY_MATRIX)).toEqual({ r: 100, g: 50, b: 200, a: 255 });
  });
});

describe("SWAP_RB_MATRIX", () => {
  it("swaps red and blue", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, SWAP_RB_MATRIX)).toEqual({ r: 200, g: 50, b: 100, a: 255 });
  });
});

describe("swap matrices", () => {
  it("SWAP_RG swaps red and green", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, SWAP_RG_MATRIX)).toEqual({ r: 50, g: 100, b: 200, a: 255 });
  });
  it("SWAP_GB swaps green and blue", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, SWAP_GB_MATRIX)).toEqual({ r: 100, g: 200, b: 50, a: 255 });
  });
  it("INVERT_MATRIX has -1 diagonal (linear invert; clamps bright to black)", () => {
    const out = mixPixel({ r: 255, g: 255, b: 255, a: 255 }, INVERT_MATRIX);
    expect(out).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    expect(INVERT_MATRIX.rr).toBe(-1);
    expect(INVERT_MATRIX.gg).toBe(-1);
    expect(INVERT_MATRIX.bb).toBe(-1);
  });
  it("ZERO_R zeroes red channel", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, ZERO_R_MATRIX).r).toBe(0);
  });
  it("ZERO_G zeroes green channel", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, ZERO_G_MATRIX).g).toBe(0);
  });
  it("ZERO_B zeroes blue channel", () => {
    expect(mixPixel({ r: 100, g: 50, b: 200, a: 255 }, ZERO_B_MATRIX).b).toBe(0);
  });
});

describe("mixPixel", () => {
  it("preserves alpha", () => {
    const out = mixPixel({ r: 100, g: 50, b: 200, a: 128 }, SWAP_RB_MATRIX);
    expect(out.a).toBe(128);
  });
  it("clamps to byte range", () => {
    const out = mixPixel({ r: 255, g: 255, b: 255, a: 255 }, sepiaMatrix());
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeLessThanOrEqual(255);
    expect(out.b).toBeLessThanOrEqual(255);
  });
  it("computes weighted sum", () => {
    const m = { rr: 0.5, gr: 0.5, br: 0, rg: 0, gg: 1, bg: 0, rb: 0, gb: 0, bb: 1 };
    expect(mixPixel({ r: 200, g: 100, b: 50, a: 255 }, m).r).toBe(150);
  });
});

describe("matrix helpers", () => {
  it("grayscaleMatrix produces equal R=G=B", () => {
    const out = mixPixel({ r: 100, g: 100, b: 100, a: 255 }, grayscaleMatrix());
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
  });
  it("sepiaMatrix produces warm tones", () => {
    const out = mixPixel({ r: 255, g: 255, b: 255, a: 255 }, sepiaMatrix());
    expect(out.r).toBeGreaterThan(out.g);
    expect(out.g).toBeGreaterThan(out.b);
  });
  it("scaleOutputChannel scales red output", () => {
    const m = scaleOutputChannel("r", 2);
    expect(m.rr).toBe(2);
    expect(m.gr).toBe(0);
  });
  it("addMatrices sums coefficients", () => {
    const m = addMatrices(IDENTITY_MATRIX, IDENTITY_MATRIX);
    expect(m.rr).toBe(2);
  });
  it("scaleMatrix multiplies coefficients", () => {
    const m = scaleMatrix(IDENTITY_MATRIX, 0.5);
    expect(m.rr).toBe(0.5);
  });
  it("extractChannel returns grayscale of one channel", () => {
    const out = extractChannel({ r: 100, g: 50, b: 25, a: 255 }, "g");
    expect(out).toEqual({ r: 50, g: 50, b: 50, a: 255 });
  });
});

describe("validateMatrix", () => {
  it("accepts identity", () => {
    expect(validateMatrix(IDENTITY_MATRIX)).toEqual({ ok: true });
  });
  it("accepts reasonable values", () => {
    expect(validateMatrix({ ...IDENTITY_MATRIX, rr: 1.5 })).toEqual({ ok: true });
  });
  it("rejects out-of-range values", () => {
    expect(validateMatrix({ ...IDENTITY_MATRIX, rr: 5 })).toHaveProperty("error");
  });
  it("rejects non-finite values", () => {
    expect(validateMatrix({ ...IDENTITY_MATRIX, rr: Number.NaN })).toHaveProperty("error");
  });
});

describe("helpers + presets", () => {
  it("isIdentity true for identity", () => {
    expect(isIdentity(IDENTITY_MATRIX)).toBe(true);
  });
  it("isIdentity false for swap", () => {
    expect(isIdentity(SWAP_RB_MATRIX)).toBe(false);
  });
  it("luma of black is 0", () => {
    expect(luma(0, 0, 0)).toBe(0);
  });
  it("meanDelta returns 0 for identical arrays", () => {
    const a = new Uint8ClampedArray([10, 20, 30, 255]);
    expect(meanDelta(a, a)).toBe(0);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], IDENTITY_MATRIX);
    expect("ok" in r[0]!.result).toBe(true);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("sepia")?.matrix.rr).toBe(0.275);
  });
  it("has at least 10 presets", () => {
    expect(MATRIX_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
