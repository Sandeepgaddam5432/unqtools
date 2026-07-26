/**
 * Unit Conversion Tutor — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  getCategory,
  solveConversion,
  solveTemperature,
  generatePractice,
  checkAnswer,
  solutionToText,
} from "./logic";

function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe("CATEGORIES & getCategory", () => {
  it("exposes 5 categories", () => {
    expect(CATEGORIES.length).toBe(5);
  });
  it("returns the correct category by id", () => {
    const c = getCategory("length");
    expect(c.canonical).toBe("m");
  });
  it("throws on unknown category", () => {
    expect(() => getCategory("energy" as never)).toThrow();
  });
});

describe("solveConversion — length", () => {
  it("converts m → cm", () => {
    const s = solveConversion(1, "m", "cm", "length");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBe(100);
  });
  it("converts km → mi", () => {
    const s = solveConversion(10, "km", "mi", "length");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBeCloseTo(6.2137, 3);
  });
  it("converts in → mm", () => {
    const s = solveConversion(1, "in", "mm", "length");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBeCloseTo(25.4, 1);
  });
  it("errors on unknown unit", () => {
    expect("error" in solveConversion(1, "lightyear", "m", "length")).toBe(true);
  });
  it("errors on non-finite value", () => {
    expect("error" in solveConversion(NaN, "m", "cm", "length")).toBe(true);
  });
  it("returns two-step solution", () => {
    const s = solveConversion(1, "km", "m", "length");
    if ("error" in s) throw new Error("should not error");
    expect(s.steps.length).toBe(2);
    expect(s.canonical.value).toBe(1000);
  });
});

describe("solveConversion — mass & volume", () => {
  it("converts kg → lb", () => {
    const s = solveConversion(1, "kg", "lb", "mass");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBeCloseTo(2.2046, 3);
  });
  it("converts L → gal", () => {
    const s = solveConversion(10, "L", "gal", "volume");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBeCloseTo(2.6417, 3);
  });
});

describe("solveTemperature", () => {
  it("converts C → F", () => {
    const s = solveTemperature(100, "C", "F");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBe(212);
  });
  it("converts F → C", () => {
    const s = solveTemperature(32, "F", "C");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBe(0);
  });
  it("converts C → K", () => {
    const s = solveTemperature(0, "C", "K");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBeCloseTo(273.15, 2);
  });
  it("converts K → F", () => {
    const s = solveTemperature(273.15, "K", "F");
    if ("error" in s) throw new Error("should not error");
    expect(s.output.value).toBeCloseTo(32, 1);
  });
});

describe("generatePractice", () => {
  it("produces a problem with fromValue, answer, and solution", () => {
    const p = generatePractice("length", makeRng(42));
    if ("error" in p) throw new Error("should not error");
    expect(p.fromValue).toBeGreaterThan(0);
    expect(typeof p.answer).toBe("number");
    expect(p.solution.steps.length).toBe(2);
  });
  it("the prompt mentions both units", () => {
    const p = generatePractice("mass", makeRng(7));
    if ("error" in p) throw new Error("should not error");
    expect(p.prompt).toContain(p.fromUnit);
    expect(p.prompt).toContain(p.toUnit);
  });
});

describe("checkAnswer", () => {
  it("returns true within tolerance", () => {
    const p = generatePractice("length", makeRng(99));
    if ("error" in p) throw new Error("should not error");
    expect(checkAnswer(p, p.answer)).toBe(true);
    expect(checkAnswer(p, p.answer + 0.005)).toBe(true);
  });
  it("returns false outside tolerance", () => {
    const p = generatePractice("length", makeRng(99));
    if ("error" in p) throw new Error("should not error");
    expect(checkAnswer(p, p.answer + 100)).toBe(false);
  });
});

describe("solutionToText", () => {
  it("renders steps and formula", () => {
    const s = solveConversion(1, "km", "m", "length");
    if ("error" in s) throw new Error("should not error");
    const text = solutionToText(s);
    expect(text).toContain("Steps");
    expect(text).toContain("Formula");
    expect(text).toContain("1000");
  });
});
