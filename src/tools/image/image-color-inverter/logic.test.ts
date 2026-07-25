import { describe, it, expect } from "vitest";
import { invertPixel, validateInvertOptions } from "./logic";

describe("invertPixel", () => {
  it("fully inverts at strength 1", () => {
    expect(invertPixel({ r: 0, g: 128, b: 255, a: 255 }, 1)).toEqual({ r: 255, g: 127, b: 0, a: 255 });
  });

  it("leaves pixel unchanged at strength 0", () => {
    expect(invertPixel({ r: 10, g: 20, b: 30, a: 255 }, 0)).toEqual({ r: 10, g: 20, b: 30, a: 255 });
  });

  it("preserves alpha", () => {
    expect(invertPixel({ r: 100, g: 100, b: 100, a: 128 }, 1).a).toBe(128);
  });

  it("blends at strength 0.5", () => {
    const r = invertPixel({ r: 0, g: 0, b: 0, a: 255 }, 0.5);
    expect(r.r).toBeCloseTo(128, -1);
  });

  it("clamps out-of-range strength", () => {
    const r = invertPixel({ r: 100, g: 100, b: 100, a: 255 }, 5);
    expect(r.r).toBe(155);
  });
});

describe("validateInvertOptions", () => {
  it("accepts valid strength", () => {
    expect(validateInvertOptions({ strength: 0.5 })).toEqual({ ok: true });
  });

  it("rejects negative strength", () => {
    expect(validateInvertOptions({ strength: -0.1 })).toHaveProperty("error");
  });

  it("rejects strength > 1", () => {
    expect(validateInvertOptions({ strength: 1.5 })).toHaveProperty("error");
  });

  it("accepts boundary 0", () => {
    expect(validateInvertOptions({ strength: 0 })).toEqual({ ok: true });
  });

  it("accepts boundary 1", () => {
    expect(validateInvertOptions({ strength: 1 })).toEqual({ ok: true });
  });
});
