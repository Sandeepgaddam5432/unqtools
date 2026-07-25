import { describe, it, expect } from "vitest";
import { perimeterRectangle, perimeterCircle, perimeterTriangle, perimeterPolygon, perimeterEllipse, computePerimeter, validatePerimeterInput } from "./logic";

describe("perimeterRectangle", () => {
  it("computes 2×(l+w)", () => {
    expect(perimeterRectangle(3, 4)).toBe(14);
  });
  it("returns 0 for zero dimensions", () => {
    expect(perimeterRectangle(0, 0)).toBe(0);
  });
});

describe("perimeterCircle", () => {
  it("computes 2πr", () => {
    expect(perimeterCircle(1)).toBeCloseTo(2 * Math.PI, 5);
  });
});

describe("perimeterTriangle", () => {
  it("sums sides", () => {
    expect(perimeterTriangle(3, 4, 5)).toBe(12);
  });
});

describe("perimeterPolygon", () => {
  it("multiplies side by count", () => {
    expect(perimeterPolygon(5, 6)).toBe(30);
  });
});

describe("perimeterEllipse", () => {
  it("returns 0 when both axes are 0", () => {
    expect(perimeterEllipse(0, 0)).toBe(0);
  });
  it("approximates circumference of a circle when a=b", () => {
    expect(perimeterEllipse(1, 1)).toBeCloseTo(2 * Math.PI, 1);
  });
});

describe("computePerimeter", () => {
  it("dispatches by shape", () => {
    expect(computePerimeter({ shape: "rectangle", values: [3, 4] })).toBe(14);
  });
});

describe("validatePerimeterInput", () => {
  it("accepts valid input", () => {
    expect(validatePerimeterInput({ shape: "rectangle", values: [3, 4] })).toEqual({ ok: true });
  });
  it("rejects polygon with too few sides", () => {
    expect(validatePerimeterInput({ shape: "polygon", values: [5, 2] })).toHaveProperty("error");
  });
  it("rejects negative values", () => {
    expect(validatePerimeterInput({ shape: "circle", values: [-1] })).toHaveProperty("error");
  });
});
