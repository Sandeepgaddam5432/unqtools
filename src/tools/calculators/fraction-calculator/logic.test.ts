import { describe, it, expect } from "vitest";
import {
  gcd, lcm, parseFraction, simplify, add, sub, mul, div, pow, reciprocal,
  negate, compare, toMixed, fromMixed, fromDecimal, toDecimal, formatFraction,
  formatMixed, validateFraction, commonDenominator, parseBatch, batchToCsv,
  evaluateExpression,
} from "./logic";

describe("gcd + lcm", () => {
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
  it("computes lcm", () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
    expect(lcm(0, 5)).toBe(0);
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
  it("parses mixed number", () => {
    expect(parseFraction("1 1/2")).toEqual({ numerator: 3, denominator: 2 });
  });
  it("parses negative mixed number", () => {
    expect(parseFraction("-1 1/2")).toEqual({ numerator: -3, denominator: 2 });
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

describe("arithmetic", () => {
  it("1/2 + 1/3 = 5/6", () => {
    expect(add({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toEqual({ numerator: 5, denominator: 6 });
  });
  it("1/4 + 1/4 = 1/2", () => {
    expect(add({ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });
  it("1/2 - 1/3 = 1/6", () => {
    expect(sub({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toEqual({ numerator: 1, denominator: 6 });
  });
  it("3/4 - 1/4 = 1/2", () => {
    expect(sub({ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });
  it("2/3 × 3/4 = 1/2", () => {
    expect(mul({ numerator: 2, denominator: 3 }, { numerator: 3, denominator: 4 })).toEqual({ numerator: 1, denominator: 2 });
  });
  it("(1/2) / (1/4) = 2", () => {
    expect(div({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 4 })).toEqual({ numerator: 2, denominator: 1 });
  });
  it("errors on divide by zero", () => {
    expect(div({ numerator: 1, denominator: 2 }, { numerator: 0, denominator: 5 })).toHaveProperty("error");
  });
});

describe("pow", () => {
  it("(2/3)^2 = 4/9", () => {
    expect(pow({ numerator: 2, denominator: 3 }, 2)).toEqual({ numerator: 4, denominator: 9 });
  });
  it("(2/3)^0 = 1", () => {
    expect(pow({ numerator: 2, denominator: 3 }, 0)).toEqual({ numerator: 1, denominator: 1 });
  });
  it("(2/3)^-1 = 3/2", () => {
    expect(pow({ numerator: 2, denominator: 3 }, -1)).toEqual({ numerator: 3, denominator: 2 });
  });
  it("errors on non-integer exponent", () => {
    expect(pow({ numerator: 2, denominator: 3 }, 1.5)).toHaveProperty("error");
  });
});

describe("reciprocal + negate + compare", () => {
  it("reciprocal of 2/3 = 3/2", () => {
    expect(reciprocal({ numerator: 2, denominator: 3 })).toEqual({ numerator: 3, denominator: 2 });
  });
  it("reciprocal of zero errors", () => {
    expect(reciprocal({ numerator: 0, denominator: 5 })).toHaveProperty("error");
  });
  it("negates", () => {
    expect(negate({ numerator: 2, denominator: 3 })).toEqual({ numerator: -2, denominator: 3 });
  });
  it("compares <, =, >", () => {
    expect(compare({ numerator: 1, denominator: 4 }, { numerator: 1, denominator: 2 })).toBe(-1);
    expect(compare({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 })).toBe(0);
    expect(compare({ numerator: 3, denominator: 4 }, { numerator: 1, denominator: 2 })).toBe(1);
  });
});

describe("mixed numbers", () => {
  it("toMixed converts 5/2 → 2 1/2", () => {
    expect(toMixed({ numerator: 5, denominator: 2 })).toEqual({ whole: 2, numerator: 1, denominator: 2 });
  });
  it("toMixed handles negative", () => {
    expect(toMixed({ numerator: -5, denominator: 2 })).toEqual({ whole: -2, numerator: -1, denominator: 2 });
  });
  it("toMixed handles whole number", () => {
    expect(toMixed({ numerator: 4, denominator: 1 })).toEqual({ whole: 4, numerator: 0, denominator: 1 });
  });
  it("fromMixed converts 2 1/2 → 5/2", () => {
    expect(fromMixed({ whole: 2, numerator: 1, denominator: 2 })).toEqual({ numerator: 5, denominator: 2 });
  });
});

describe("fromDecimal", () => {
  it("converts 0.5 → 1/2", () => {
    expect(fromDecimal(0.5)).toEqual({ numerator: 1, denominator: 2 });
  });
  it("converts 0.75 → 3/4", () => {
    expect(fromDecimal(0.75)).toEqual({ numerator: 3, denominator: 4 });
  });
  it("handles negative", () => {
    const f = fromDecimal(-0.25);
    expect(f).toEqual({ numerator: -1, denominator: 4 });
  });
  it("errors on non-finite", () => {
    expect(fromDecimal(Infinity)).toHaveProperty("error");
  });
});

describe("formatters", () => {
  it("formatFraction shows whole when denominator is 1", () => {
    expect(formatFraction({ numerator: 4, denominator: 1 })).toBe("4");
  });
  it("formatFraction shows n/d otherwise", () => {
    expect(formatFraction({ numerator: 4, denominator: 8 })).toBe("1/2");
  });
  it("formatMixed shows whole only when no remainder", () => {
    expect(formatMixed({ numerator: 4, denominator: 1 })).toBe("4");
  });
  it("formatMixed shows proper when no whole part", () => {
    expect(formatMixed({ numerator: 1, denominator: 2 })).toBe("1/2");
  });
  it("formatMixed shows mixed", () => {
    expect(formatMixed({ numerator: 5, denominator: 2 })).toBe("2 1/2");
  });
});

describe("toDecimal", () => {
  it("computes decimal", () => {
    expect(toDecimal({ numerator: 1, denominator: 4 })).toBeCloseTo(0.25);
    expect(toDecimal({ numerator: 3, denominator: 2 })).toBeCloseTo(1.5);
  });
});

describe("validateFraction + commonDenominator", () => {
  it("accepts valid", () => {
    expect(validateFraction({ numerator: 1, denominator: 2 })).toEqual({ ok: true });
  });
  it("rejects zero denominator", () => {
    expect(validateFraction({ numerator: 1, denominator: 0 })).toHaveProperty("error");
  });
  it("rejects non-integer", () => {
    expect(validateFraction({ numerator: 1.5, denominator: 2 })).toHaveProperty("error");
  });
  it("commonDenominator of 1/2 and 1/3 = 6", () => {
    expect(commonDenominator({ numerator: 1, denominator: 2 }, { numerator: 1, denominator: 3 })).toBe(6);
  });
});

describe("parseBatch + batchToCsv", () => {
  it("parses multiple fractions", () => {
    const r = parseBatch(["1/2", "3/4", "abc"]);
    expect(r.length).toBe(3);
    expect("error" in r[2]!).toBe(true);
  });
  it("batchToCsv emits header + rows", () => {
    const inputs = ["1/2", "3/4"];
    const parsed = parseBatch(inputs);
    const csv = batchToCsv(inputs, parsed);
    expect(csv.split("\n")[0]).toBe("Input,Simplified,Decimal,Mixed");
    expect(csv).toContain("1/2");
  });
});

describe("evaluateExpression", () => {
  it("evaluates 1/2 + 1/4 = 3/4", () => {
    expect(evaluateExpression("1/2 + 1/4")).toEqual({ numerator: 3, denominator: 4 });
  });
  it("evaluates 1/2 * 2/3 = 1/3", () => {
    expect(evaluateExpression("1/2 * 2/3")).toEqual({ numerator: 1, denominator: 3 });
  });
  it("evaluates 1/2 / 1/4 = 2", () => {
    expect(evaluateExpression("1/2 / 1/4")).toEqual({ numerator: 2, denominator: 1 });
  });
  it("errors on missing operator", () => {
    expect(evaluateExpression("1/2")).toHaveProperty("error");
  });
});
