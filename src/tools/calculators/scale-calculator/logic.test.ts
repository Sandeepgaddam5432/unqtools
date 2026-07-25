import { describe, it, expect } from "vitest";
import {
  validateScale, scaleFactor, formatScale, realToModel, modelToReal,
  mapToReal, fmtNum, convert, UNIT_FACTORS_TO_M,
} from "./logic";

describe("validateScale", () => {
  it("passes valid input", () => {
    expect(validateScale({ real: 100, model: 1 })).toEqual({ real: 100, model: 1 });
  });
  it("errors on non-positive real", () => {
    expect(validateScale({ real: 0, model: 1 })).toHaveProperty("error");
    expect(validateScale({ real: -1, model: 1 })).toHaveProperty("error");
  });
  it("errors on non-positive model", () => {
    expect(validateScale({ real: 100, model: 0 })).toHaveProperty("error");
  });
  it("errors on negative dimension", () => {
    expect(validateScale({ real: 100, model: 1, realDim: -5 })).toHaveProperty("error");
  });
});

describe("scaleFactor", () => {
  it("computes real/model", () => {
    expect(scaleFactor(100, 1)).toBe(100);
    expect(scaleFactor(1, 100)).toBeCloseTo(0.01);
  });
});

describe("formatScale", () => {
  it("formats 1:N for factor >= 1", () => {
    expect(formatScale(100)).toBe("1:100");
    expect(formatScale(50000)).toBe("1:50000");
  });
  it("formats N:1 for factor < 1 (放大)", () => {
    expect(formatScale(0.5)).toBe("2:1");
    expect(formatScale(0.1)).toBe("10:1");
  });
  it("trims trailing .00", () => {
    expect(formatScale(1.5)).toBe("1:1.5");
  });
});

describe("realToModel", () => {
  it("divides real by factor", () => {
    expect(realToModel(100, 100)).toBe(1);
    expect(realToModel(200, 50)).toBe(4);
  });
});

describe("modelToReal", () => {
  it("multiplies model by factor", () => {
    expect(modelToReal(1, 100)).toBe(100);
    expect(modelToReal(2, 50)).toBe(100);
  });
});

describe("mapToReal", () => {
  it("multiplies map distance by N (for 1:N scale)", () => {
    expect(mapToReal(2, 50000)).toBe(100000);
  });
  it("returns map distance when N=1", () => {
    expect(mapToReal(5, 1)).toBe(5);
  });
});

describe("fmtNum", () => {
  it("trims trailing zeros", () => {
    expect(fmtNum(1.5)).toBe("1.5");
    expect(fmtNum(2)).toBe("2");
    expect(fmtNum(0.123456)).toBe("0.1235");
  });
});

describe("UNIT_FACTORS_TO_M", () => {
  it("has 6 units", () => {
    expect(Object.keys(UNIT_FACTORS_TO_M).length).toBe(6);
  });
  it("m = 1", () => {
    expect(UNIT_FACTORS_TO_M.m).toBe(1);
  });
});

describe("convert", () => {
  it("m → cm", () => {
    expect(convert(1, "m", "cm")).toBe(100);
  });
  it("km → m", () => {
    expect(convert(1, "km", "m")).toBe(1000);
  });
  it("ft → in", () => {
    expect(convert(1, "ft", "in")).toBeCloseTo(12);
  });
  it("errors on unknown unit", () => {
    expect(convert(1, "miles", "m")).toHaveProperty("error");
  });
});
