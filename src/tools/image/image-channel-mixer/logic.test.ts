import { describe, it, expect } from "vitest";
import { IDENTITY_MATRIX, SWAP_RB_MATRIX, mixPixel, grayscaleMatrix, sepiaMatrix, validateMatrix } from "./logic";

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

describe("grayscaleMatrix", () => {
  it("produces equal R=G=B", () => {
    const m = grayscaleMatrix();
    const out = mixPixel({ r: 100, g: 100, b: 100, a: 255 }, m);
    expect(out.r).toBe(out.g);
    expect(out.g).toBe(out.b);
  });
  it("uses BT.601 luma for black", () => {
    const m = grayscaleMatrix();
    const out = mixPixel({ r: 0, g: 0, b: 0, a: 255 }, m);
    expect(out.r).toBe(0);
  });
});

describe("sepiaMatrix", () => {
  it("produces warm tones", () => {
    const m = sepiaMatrix();
    const out = mixPixel({ r: 255, g: 255, b: 255, a: 255 }, m);
    // Sepia of white should be a warm color: R > G > B
    expect(out.r).toBeGreaterThan(out.g);
    expect(out.g).toBeGreaterThan(out.b);
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
