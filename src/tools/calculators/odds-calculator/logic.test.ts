import { describe, it, expect } from "vitest";
import {
  gcd, simplifyFraction, probToDecimal, probToFractional, probToAmerican,
  decimalToProb, americanToProb, fromProbability, fromDecimal,
  formatFractional, formatAmerican,
} from "./logic";

describe("gcd", () => {
  it("computes gcd", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });
});

describe("simplifyFraction", () => {
  it("reduces 6/8 to 3/4", () => {
    expect(simplifyFraction(6, 8)).toEqual({ num: 3, den: 4 });
  });
  it("reduces 100/200 to 1/2", () => {
    expect(simplifyFraction(100, 200)).toEqual({ num: 1, den: 2 });
  });
});

describe("probToDecimal", () => {
  it("1/p for valid probability", () => {
    expect(probToDecimal(0.25)).toBeCloseTo(4);
    expect(probToDecimal(0.5)).toBeCloseTo(2);
  });
  it("errors on out-of-range", () => {
    expect(probToDecimal(0)).toHaveProperty("error");
    expect(probToDecimal(1)).toHaveProperty("error");
    expect(probToDecimal(1.5)).toHaveProperty("error");
  });
});

describe("probToFractional", () => {
  it("p=0.25 → 3/1", () => {
    expect(probToFractional(0.25)).toEqual({ num: 3, den: 1 });
  });
  it("p=0.5 → 1/1", () => {
    expect(probToFractional(0.5)).toEqual({ num: 1, den: 1 });
  });
  it("p=0.2 → 4/1", () => {
    expect(probToFractional(0.2)).toEqual({ num: 4, den: 1 });
  });
  it("errors on invalid p", () => {
    expect(probToFractional(0)).toHaveProperty("error");
  });
});

describe("probToAmerican", () => {
  it("underdog p<0.5 → positive", () => {
    expect(probToAmerican(0.25)).toBe(300);
    expect(probToAmerican(0.2)).toBe(400);
  });
  it("favorite p>0.5 → negative", () => {
    expect(probToAmerican(0.75)).toBe(-300);
  });
  it("p=0.5 → +100", () => {
    expect(probToAmerican(0.5)).toBe(100);
  });
  it("errors on invalid p", () => {
    expect(probToAmerican(0)).toHaveProperty("error");
    expect(probToAmerican(1)).toHaveProperty("error");
  });
});

describe("decimalToProb", () => {
  it("1/d for valid decimal", () => {
    expect(decimalToProb(4)).toBeCloseTo(0.25);
    expect(decimalToProb(2)).toBeCloseTo(0.5);
  });
  it("errors on d <= 1", () => {
    expect(decimalToProb(1)).toHaveProperty("error");
    expect(decimalToProb(0.5)).toHaveProperty("error");
  });
});

describe("americanToProb", () => {
  it("positive odds", () => {
    expect(americanToProb(300)).toBeCloseTo(0.25);
    expect(americanToProb(100)).toBeCloseTo(0.5);
  });
  it("negative odds", () => {
    expect(americanToProb(-300)).toBeCloseTo(0.75);
    expect(americanToProb(-200)).toBeCloseTo(2 / 3);
  });
  it("errors on 0", () => {
    expect(americanToProb(0)).toHaveProperty("error");
  });
});

describe("fromProbability", () => {
  it("returns all formats", () => {
    const r = fromProbability(0.25);
    if ("error" in r) throw new Error("should not error");
    expect(r.decimal).toBeCloseTo(4);
    expect(r.american).toBe(300);
    expect(r.fractional).toEqual({ num: 3, den: 1 });
  });
  it("errors on invalid p", () => {
    expect(fromProbability(0)).toHaveProperty("error");
  });
});

describe("fromDecimal", () => {
  it("returns full result", () => {
    const r = fromDecimal(4);
    if ("error" in r) throw new Error("should not error");
    expect(r.probability).toBeCloseTo(0.25);
    expect(r.american).toBe(300);
  });
  it("errors on invalid decimal", () => {
    expect(fromDecimal(0.5)).toHaveProperty("error");
  });
});

describe("formatFractional", () => {
  it("formats num/den", () => {
    expect(formatFractional({ num: 3, den: 1 })).toBe("3/1");
    expect(formatFractional({ num: 5, den: 2 })).toBe("5/2");
  });
});

describe("formatAmerican", () => {
  it("adds + for positive", () => {
    expect(formatAmerican(300)).toBe("+300");
  });
  it("keeps minus for negative", () => {
    expect(formatAmerican(-200)).toBe("-200");
  });
});
