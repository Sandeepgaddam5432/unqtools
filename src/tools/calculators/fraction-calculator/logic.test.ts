import { describe, it, expect } from "vitest";
import { gcd, parseFraction, simplify, add, sub, mul, div, formatFraction, toDecimal } from "./logic";

describe("gcd", () => {
  it("computes gcd", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 5)).toBe(1);
    expect(gcd(0, 5)).toBe(5);
  });
  it("handles negatives", () => {
    expect(gcd(-12, 18)).toBe(6);
  });
  it("returns 1 when both are 0", () => {
    expect(gcd(0, 0)).toBe(1);
  });
});

describe("parseFraction", () => {
  it("parses n/d", () => {
    expect(parseFraction("3/4")).toEqual({ numerator: 3, denominator: 4 });
  });
  it("parses whole numbers", () => {
    expect(parseFraction("5")).toEqual({ numerator: 5, denominator: 1 });
  });
  it("parses negative", () => {
    expect(parseFraction("-2/3")).toEqual({ numerator: -2, denominator: 3 });
  });
  it("errors on empty", () => {
    expect(parseFraction("")).toHaveProperty("error");
  });
  it("errors on zero denominator", () => {
    expect(parseFraction("5/0")).toHaveProperty("error");
  });
  it("errors on non-numeric", () => {
    expect(parseFraction("abc")).toHaveProperty("error");
  });
});

describe("simplify", () => {
  it("reduces to lowest terms", () => {
    expect(simplify({ numerator: 4, denominator: 8 })).toEqual({ numerator: 1, denominator: 2 });
  });
  it("puts sign on numerator", () => {
    expect(simplify({ numerator: 1, denominator: -2 })).toEqual({ numerator: -1, denominator: 2 });
    expect(simplify({ numerator: -1, denominator: -2 })).toEqual({ numerator: 1, denominator: 2 });
  });
  it("handles zero numerator", () => {
    expect(simplify({ numerator: 0, denominator: 5 })).toEqual({ numerator: 0, denominator: 1 });
  });
});

describe("add", () => {
  it("1/2 + 1/3 = 5/6", () => {
    expect(add({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toEqual({ numerator: 5, denominator: 6 });
  });
  it("1/4 + 1/4 = 1/2", () => {
    expect(add({ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });
});

describe("sub", () => {
  it("1/2 - 1/3 = 1/6", () => {
    expect(sub({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toEqual({ numerator: 1, denominator: 6 });
  });
  it("3/4 - 1/4 = 1/2", () => {
    expect(sub({ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });
});

describe("mul", () => {
  it("2/3 × 3/4 = 1/2", () => {
    expect(mul({ numerator: 2, denominator: 3 }, { numerator: 3, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });
});

describe("div", () => {
  it("(1/2) / (1/4) = 2", () => {
    expect(div({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 2, denominator: 1 });
  });
  it("errors on divide by zero", () => {
    expect(div({ numerator: 1, denominator: 2 }, { numerator: 0, denominator: 5 })).toHaveProperty("error");
  });
});

describe("formatFraction", () => {
  it("shows whole number when denominator is 1", () => {
    expect(formatFraction({ numerator: 4, denominator: 1 })).toBe("4");
  });
  it("shows n/d otherwise", () => {
    expect(formatFraction({ numerator: 4, denominator: 8 })).toBe("1/2");
  });
});

describe("toDecimal", () => {
  it("computes decimal", () => {
    expect(toDecimal({ numerator: 1, denominator: 4 })).toBeCloseTo(0.25);
    expect(toDecimal({ numerator: 3, denominator: 2 })).toBeCloseTo(1.5);
  });
});
