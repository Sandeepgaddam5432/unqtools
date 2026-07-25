import { describe, it, expect } from "vitest";
import { clampRadius, cornerAlpha, applyRounded, validateRoundedOptions } from "./logic";

describe("clampRadius", () => {
  it("returns the radius when within bounds", () => {
    expect(clampRadius(20, 100, 100)).toBe(20);
  });
  it("clamps to half the smaller dimension", () => {
    expect(clampRadius(80, 100, 50)).toBe(25);
  });
  it("clamps to 0 for negative", () => {
    expect(clampRadius(-5, 100, 100)).toBe(0);
  });
  it("handles 0 radius", () => {
    expect(clampRadius(0, 100, 100)).toBe(0);
  });
});

describe("cornerAlpha", () => {
  it("returns 1 at center", () => {
    expect(cornerAlpha(50, 50, 100, 100, 20, 1)).toBe(1);
  });
  it("returns 1 at center of an edge (non-corner)", () => {
    expect(cornerAlpha(50, 0, 100, 100, 20, 1)).toBe(1);
  });
  it("returns 0 outside the corner arc", () => {
    expect(cornerAlpha(0, 0, 100, 100, 20, 1)).toBe(0);
  });
  it("returns 1 inside the corner arc", () => {
    expect(cornerAlpha(20, 20, 100, 100, 20, 1)).toBe(1);
  });
  it("returns 1 when radius is 0", () => {
    expect(cornerAlpha(0, 0, 100, 100, 0, 0)).toBe(1);
  });
  it("smoothly transitions with feather", () => {
    const inside = cornerAlpha(19, 19, 100, 100, 20, 2);
    const outside = cornerAlpha(1, 1, 100, 100, 20, 2);
    expect(inside).toBeGreaterThan(outside);
  });
});

describe("applyRounded", () => {
  it("multiplies alpha by factor", () => {
    expect(applyRounded(200, 0.5)).toBe(100);
  });
  it("clamps to byte range", () => {
    expect(applyRounded(300, 1)).toBe(255);
  });
  it("preserves 0 alpha", () => {
    expect(applyRounded(0, 0.5)).toBe(0);
  });
});

describe("validateRoundedOptions", () => {
  it("accepts valid options", () => {
    expect(validateRoundedOptions({ radius: 10, feather: 50 }, 100, 100)).toEqual({ ok: true });
  });
  it("rejects negative radius", () => {
    expect(validateRoundedOptions({ radius: -1, feather: 50 }, 100, 100)).toHaveProperty("error");
  });
  it("rejects radius too large", () => {
    expect(validateRoundedOptions({ radius: 100, feather: 50 }, 100, 100)).toHaveProperty("error");
  });
  it("rejects feather out of range", () => {
    expect(validateRoundedOptions({ radius: 10, feather: 200 }, 100, 100)).toHaveProperty("error");
  });
});
