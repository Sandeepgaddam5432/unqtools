import { describe, it, expect } from "vitest";
import { areaRectangle, areaCircle, areaTriangle, areaTrapezoid, areaEllipse, areaParallelogram, computeArea, validateAreaInput } from "./logic";

describe("areaRectangle", () => {
  it("computes length × width", () => {
    expect(areaRectangle(4, 5)).toBe(20);
  });
  it("returns 0 if either is 0", () => {
    expect(areaRectangle(0, 5)).toBe(0);
  });
});

describe("areaCircle", () => {
  it("computes πr²", () => {
    expect(areaCircle(1)).toBeCloseTo(Math.PI, 5);
  });
  it("returns 0 for r=0", () => {
    expect(areaCircle(0)).toBe(0);
  });
});

describe("areaTriangle", () => {
  it("computes 0.5 × base × height", () => {
    expect(areaTriangle(10, 6)).toBe(30);
  });
});

describe("areaTrapezoid", () => {
  it("computes 0.5 × (a+b) × h", () => {
    expect(areaTrapezoid(4, 6, 5)).toBe(25);
  });
});

describe("areaEllipse", () => {
  it("computes π × a × b", () => {
    expect(areaEllipse(2, 3)).toBeCloseTo(Math.PI * 6, 5);
  });
});

describe("areaParallelogram", () => {
  it("computes base × height", () => {
    expect(areaParallelogram(7, 4)).toBe(28);
  });
});

describe("computeArea", () => {
  it("dispatches by shape", () => {
    expect(computeArea({ shape: "rectangle", values: [3, 4] })).toBe(12);
    expect(computeArea({ shape: "circle", values: [1] })).toBeCloseTo(Math.PI, 5);
  });
});

describe("validateAreaInput", () => {
  it("accepts valid input", () => {
    expect(validateAreaInput({ shape: "rectangle", values: [3, 4] })).toEqual({ ok: true });
  });
  it("rejects negative", () => {
    expect(validateAreaInput({ shape: "rectangle", values: [-1, 4] })).toHaveProperty("error");
  });
  it("rejects too few dimensions", () => {
    expect(validateAreaInput({ shape: "trapezoid", values: [1, 2] })).toHaveProperty("error");
  });
});
