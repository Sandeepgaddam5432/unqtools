import { describe, it, expect } from "vitest";
import { validateAscii, luma, lumaToChar, computeHeight, toAscii, DEFAULT_RAMP } from "./logic";

describe("validateAscii", () => {
  it("passes valid opts", () => {
    expect(validateAscii({ width: 80, ramp: DEFAULT_RAMP })).toEqual({ width: 80, ramp: DEFAULT_RAMP });
  });
  it("rounds width", () => {
    expect(validateAscii({ width: 80.6, ramp: DEFAULT_RAMP }).width).toBe(81);
  });
  it("errors on bad width", () => {
    expect(validateAscii({ width: 0, ramp: DEFAULT_RAMP })).toHaveProperty("error");
    expect(validateAscii({ width: 1000, ramp: DEFAULT_RAMP })).toHaveProperty("error");
  });
  it("errors on too-short ramp", () => {
    expect(validateAscii({ width: 80, ramp: "x" })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("is 0 for black, 255 for white", () => {
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(255, 255, 255)).toBeCloseTo(255);
  });
});

describe("lumaToChar", () => {
  it("returns first char for black", () => {
    expect(lumaToChar(0, DEFAULT_RAMP)).toBe(" ");
  });
  it("returns last char for white", () => {
    expect(lumaToChar(255, DEFAULT_RAMP)).toBe("@");
  });
  it("clamps out-of-range luminance", () => {
    expect(lumaToChar(-50, DEFAULT_RAMP)).toBe(" ");
    expect(lumaToChar(500, DEFAULT_RAMP)).toBe("@");
  });
  it("ramp length 2 returns first/last only at extremes", () => {
    expect(lumaToChar(0, "01")).toBe("0");
    expect(lumaToChar(255, "01")).toBe("1");
  });
});

describe("computeHeight", () => {
  it("halves aspect ratio (chars taller than wide)", () => {
    expect(computeHeight(80, 100, 100)).toBe(40);
  });
  it("handles 0 dimension", () => {
    expect(computeHeight(80, 0, 100)).toBe(0);
  });
  it("minimum 1", () => {
    expect(computeHeight(80, 100, 1)).toBeGreaterThanOrEqual(1);
  });
});

describe("toAscii", () => {
  it("produces width × height grid", () => {
    const px = new Uint8ClampedArray(2 * 2 * 4);
    for (let i = 0; i < px.length; i += 4) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; px[i + 3] = 255; }
    const out = toAscii(px, 2, 2, { width: 2, ramp: DEFAULT_RAMP });
    const lines = out.split("\n");
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe("@@");
  });
  it("black pixels map to first ramp char", () => {
    const px = new Uint8ClampedArray(1 * 1 * 4);
    const out = toAscii(px, 1, 1, { width: 1, ramp: DEFAULT_RAMP });
    expect(out).toBe(" ");
  });
  it("throws on invalid width", () => {
    expect(() => toAscii(new Uint8ClampedArray(4), 1, 1, { width: 0, ramp: DEFAULT_RAMP })).toThrow();
  });
});
