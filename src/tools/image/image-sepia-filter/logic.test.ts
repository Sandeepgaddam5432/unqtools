import { describe, it, expect } from "vitest";
import { sepiaPixel, validateSepiaOptions, SEPIA_MATRIX } from "./logic";

describe("sepiaPixel", () => {
  it("applies full sepia at strength 1", () => {
    const out = sepiaPixel({ r: 255, g: 255, b: 255, a: 255 }, 1);
    // For white, sepia transforms should produce warm browns (all > 200).
    expect(out.r).toBeGreaterThan(200);
    expect(out.g).toBeGreaterThan(180);
    expect(out.b).toBeGreaterThan(140);
  });

  it("leaves pixel unchanged at strength 0", () => {
    expect(sepiaPixel({ r: 100, g: 50, b: 25, a: 255 }, 0)).toEqual({ r: 100, g: 50, b: 25, a: 255 });
  });

  it("preserves alpha", () => {
    expect(sepiaPixel({ r: 100, g: 100, b: 100, a: 128 }, 1).a).toBe(128);
  });

  it("clamps output to byte range", () => {
    const out = sepiaPixel({ r: 255, g: 255, b: 255, a: 255 }, 1);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.g).toBeLessThanOrEqual(255);
    expect(out.b).toBeLessThanOrEqual(255);
  });

  it("clamps out-of-range strength", () => {
    const out = sepiaPixel({ r: 100, g: 100, b: 100, a: 255 }, 5);
    // strength clamped to 1 — should produce a sepia-warm result.
    expect(out.r).toBeGreaterThanOrEqual(90);
  });
});

describe("validateSepiaOptions", () => {
  it("accepts valid strength", () => {
    expect(validateSepiaOptions({ strength: 0.5 })).toEqual({ ok: true });
  });

  it("rejects out-of-range strength", () => {
    expect(validateSepiaOptions({ strength: -1 })).toHaveProperty("error");
    expect(validateSepiaOptions({ strength: 2 })).toHaveProperty("error");
  });

  it("accepts boundaries", () => {
    expect(validateSepiaOptions({ strength: 0 })).toEqual({ ok: true });
    expect(validateSepiaOptions({ strength: 1 })).toEqual({ ok: true });
  });
});

describe("SEPIA_MATRIX", () => {
  it("has all 9 coefficients", () => {
    expect(Object.keys(SEPIA_MATRIX).length).toBe(9);
  });

  it("red contribution is highest in r channel", () => {
    expect(SEPIA_MATRIX.rr).toBeGreaterThan(SEPIA_MATRIX.gr);
    expect(SEPIA_MATRIX.rr).toBeGreaterThan(SEPIA_MATRIX.br);
  });
});
