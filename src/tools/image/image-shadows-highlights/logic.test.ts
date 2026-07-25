import { describe, it, expect } from "vitest";
import {
  smoothstep,
  shadowMask,
  highlightMask,
  luminance,
  liftShadow,
  toneHighlight,
  adjustPixel,
  validateAmount,
  clamp8,
} from "./logic";

describe("smoothstep", () => {
  it("clamps to 0 below edge0", () => {
    expect(smoothstep(0.5, 1.0, 0.2)).toBe(0);
  });

  it("clamps to 1 above edge1", () => {
    expect(smoothstep(0.0, 0.5, 0.8)).toBe(1);
  });

  it("returns 0.5 at the midpoint", () => {
    expect(smoothstep(0.0, 1.0, 0.5)).toBeCloseTo(0.5, 6);
  });
});

describe("shadowMask", () => {
  it("is strongest at black and zero above 0.5", () => {
    expect(shadowMask(0.0, 100)).toBeCloseTo(1, 6);
    expect(shadowMask(0.6, 100)).toBe(0);
  });

  it("scales with amount", () => {
    expect(shadowMask(0.25, 50)).toBeCloseTo(0.5 * shadowMask(0.25, 100), 6);
  });
});

describe("highlightMask", () => {
  it("is strongest at white and zero below 0.5", () => {
    expect(highlightMask(1.0, 100)).toBeCloseTo(1, 6);
    expect(highlightMask(0.4, 100)).toBe(0);
  });
});

describe("luminance", () => {
  it("returns 0 for pure black", () => {
    expect(luminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("returns 1 for pure white", () => {
    expect(luminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6);
  });

  it("is brighter for green than red at same value", () => {
    expect(luminance({ r: 0, g: 255, b: 0 })).toBeGreaterThan(luminance({ r: 255, g: 0, b: 0 }));
  });
});

describe("liftShadow", () => {
  it("brightens dark pixels", () => {
    const out = liftShadow({ r: 20, g: 20, b: 20 }, 1);
    expect(out.r).toBeGreaterThan(20);
  });

  it("does not change bright pixels much", () => {
    const out = liftShadow({ r: 250, g: 250, b: 250 }, 1);
    expect(out.r).toBeLessThanOrEqual(255);
    expect(out.r).toBeGreaterThan(245);
  });
});

describe("toneHighlight", () => {
  it("darkens bright pixels", () => {
    const out = toneHighlight({ r: 250, g: 250, b: 250 }, 1);
    expect(out.r).toBeLessThan(250);
  });

  it("does not change dark pixels", () => {
    const out = toneHighlight({ r: 10, g: 10, b: 10 }, 1);
    expect(out.r).toBe(10);
  });
});

describe("adjustPixel", () => {
  it("lifts shadows then tones highlights", () => {
    const out = adjustPixel({ r: 100, g: 100, b: 100 }, 0.5, 0.5);
    expect(out.r).toBeGreaterThanOrEqual(0);
    expect(out.r).toBeLessThanOrEqual(255);
  });

  it("preserves black at zero amounts", () => {
    expect(adjustPixel({ r: 0, g: 0, b: 0 }, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("preserves white at zero amounts", () => {
    expect(adjustPixel({ r: 255, g: 255, b: 255 }, 0, 0)).toEqual({ r: 255, g: 255, b: 255 });
  });
});

describe("validateAmount", () => {
  it("accepts 0..100", () => {
    expect(validateAmount(50)).toBe(50);
  });

  it("rejects out-of-range", () => {
    expect("error" in validateAmount(150)).toBe(true);
    expect("error" in validateAmount(-5)).toBe(true);
  });

  it("rejects NaN", () => {
    expect("error" in validateAmount(NaN)).toBe(true);
  });
});

describe("clamp8", () => {
  it("clamps above 255 and below 0", () => {
    expect(clamp8(300)).toBe(255);
    expect(clamp8(-10)).toBe(0);
  });
});
