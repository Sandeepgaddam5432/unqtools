import { describe, it, expect } from "vitest";
import { parseHex, toHex, lerpColor, sampleGradient, gradientT, validateGradientOptions } from "./logic";

describe("parseHex", () => {
  it("parses 6-digit hex", () => {
    expect(parseHex("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("parses 3-digit hex", () => {
    expect(parseHex("#f00")).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("parses without #", () => {
    expect(parseHex("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("returns null on invalid", () => {
    expect(parseHex("xyz")).toBeNull();
    expect(parseHex("#12")).toBeNull();
  });
});

describe("toHex", () => {
  it("formats hex", () => {
    expect(toHex({ r: 255, g: 0, b: 128 })).toBe("#ff0080");
  });
  it("clamps out-of-range", () => {
    expect(toHex({ r: 300, g: -5, b: 128 })).toBe("#ff0080");
  });
});

describe("lerpColor", () => {
  it("interpolates at t=0.5", () => {
    expect(lerpColor({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 0.5)).toEqual({ r: 50, g: 50, b: 50 });
  });
  it("clamps t", () => {
    expect(lerpColor({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 2)).toEqual({ r: 100, g: 100, b: 100 });
  });
});

describe("sampleGradient", () => {
  const stops = [
    { offset: 0, color: { r: 0, g: 0, b: 0 } },
    { offset: 1, color: { r: 255, g: 255, b: 255 } },
  ];
  it("returns first color at t=0", () => {
    expect(sampleGradient(stops, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("returns last color at t=1", () => {
    expect(sampleGradient(stops, 1)).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("interpolates at t=0.5", () => {
    expect(sampleGradient(stops, 0.5)).toEqual({ r: 127.5, g: 127.5, b: 127.5 });
  });
  it("returns black for empty stops", () => {
    expect(sampleGradient([], 0.5)).toEqual({ r: 0, g: 0, b: 0 });
  });
  it("handles single stop", () => {
    expect(sampleGradient([{ offset: 0, color: { r: 10, g: 20, b: 30 } }], 0.5)).toEqual({ r: 10, g: 20, b: 30 });
  });
});

describe("gradientT", () => {
  it("horizontal goes 0 to 1", () => {
    expect(gradientT(0, 0, 100, 100, "horizontal")).toBe(0);
    expect(gradientT(99, 0, 100, 100, "horizontal")).toBeCloseTo(1, 5);
  });
  it("vertical goes 0 to 1", () => {
    expect(gradientT(0, 0, 100, 100, "vertical")).toBe(0);
    expect(gradientT(0, 99, 100, 100, "vertical")).toBeCloseTo(1, 5);
  });
  it("radial is 0 at center, 1 at corner", () => {
    expect(gradientT(50, 50, 100, 100, "radial")).toBeCloseTo(0, 5);
    expect(gradientT(0, 0, 100, 100, "radial")).toBeCloseTo(1, 5);
  });
});

describe("validateGradientOptions", () => {
  const base = { type: "linear" as const, direction: "horizontal" as const, width: 100, height: 100, stops: [
    { offset: 0, color: { r: 0, g: 0, b: 0 } },
    { offset: 1, color: { r: 255, g: 255, b: 255 } },
  ] };
  it("accepts valid options", () => {
    expect(validateGradientOptions(base)).toEqual({ ok: true });
  });
  it("rejects width out of range", () => {
    expect(validateGradientOptions({ ...base, width: 5000 })).toHaveProperty("error");
  });
  it("rejects fewer than 2 stops", () => {
    expect(validateGradientOptions({ ...base, stops: [{ offset: 0, color: { r: 0, g: 0, b: 0 } }] })).toHaveProperty("error");
  });
  it("rejects invalid offset", () => {
    expect(validateGradientOptions({ ...base, stops: [
      { offset: -0.5, color: { r: 0, g: 0, b: 0 } },
      { offset: 1, color: { r: 255, g: 255, b: 255 } },
    ] })).toHaveProperty("error");
  });
});
