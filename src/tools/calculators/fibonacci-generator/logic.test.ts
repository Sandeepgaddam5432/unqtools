/**
 * Fibonacci Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  generateFibonacci, fastFib, fastFibMod, fastFibPair, indexOfFibonacci,
  isFibonacci, pisanoPeriod, toCsv, toJson,
} from "./logic";

describe("fastFib — known values", () => {
  it("F(0) = 0", () => expect(fastFib(0)).toBe(0n));
  it("F(1) = 1", () => expect(fastFib(1)).toBe(1n));
  it("F(10) = 55", () => expect(fastFib(10)).toBe(55n));
  it("F(20) = 6765", () => expect(fastFib(20)).toBe(6765n));
  it("F(50) = 12586269025", () => expect(fastFib(50)).toBe(12586269025n));
  it("F(100) = 354224848179261915075", () =>
    expect(fastFib(100)).toBe(354224848179261915075n));
  it("Negafibonacci F(-1) = 1", () => expect(fastFib(-1)).toBe(1n));
  it("Negafibonacci F(-2) = -1", () => expect(fastFib(-2)).toBe(-1n));
});

describe("fastFibPair", () => {
  it("returns (F(n), F(n+1))", () => {
    const [a, b] = fastFibPair(10n);
    expect(a).toBe(55n);
    expect(b).toBe(89n);
  });
});

describe("fastFibMod", () => {
  it("F(10) mod 100 = 55", () => expect(fastFibMod(10, 100)).toBe(55n));
  it("F(100) mod 1000 = 75", () => expect(fastFibMod(100, 1000)).toBe(75n));
  it("F(1000) mod 7 matches naive", () => {
    let a = 0n, b = 1n;
    for (let i = 2; i <= 1000; i++) { const c = (a + b) % 7n; a = b; b = c; }
    expect(fastFibMod(1000, 7)).toBe(b);
  });
  it("mod 1 returns 0", () => expect(fastFibMod(100, 1)).toBe(0n));
});

describe("generateFibonacci — basic", () => {
  it("generates first 10 terms", () => {
    const r = generateFibonacci({ count: 10 });
    if ("error" in r) throw new Error("err");
    expect(r.terms.length).toBe(10);
    expect(r.terms[9]).toBe(34n);
  });
  it("errors on count <= 0", () => {
    expect("error" in generateFibonacci({ count: 0 })).toBe(true);
    expect("error" in generateFibonacci({ count: -5 })).toBe(true);
  });
  it("errors on huge count", () => {
    expect("error" in generateFibonacci({ count: 1_000_000 })).toBe(true);
  });
});

describe("generateFibonacci — custom start", () => {
  it("custom F0, F1", () => {
    const r = generateFibonacci({ count: 5, f0: 2, f1: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.terms).toEqual([2n, 3n, 5n, 8n, 13n]);
  });
  it("Lucas variant", () => {
    const r = generateFibonacci({ count: 6, variant: "lucas" });
    if ("error" in r) throw new Error("err");
    expect(r.terms).toEqual([2n, 1n, 3n, 4n, 7n, 11n]);
  });
  it("Tribonacci variant", () => {
    const r = generateFibonacci({ count: 7, variant: "tribonacci" });
    if ("error" in r) throw new Error("err");
    expect(r.terms).toEqual([0n, 0n, 1n, 1n, 2n, 4n, 7n]);
  });
});

describe("generateFibonacci — modulo mode", () => {
  it("applies modulo to all terms", () => {
    const r = generateFibonacci({ count: 10, mod: 100 });
    if ("error" in r) throw new Error("err");
    expect(r.moduloApplied).toBe(true);
    expect(r.terms[9]).toBe(34n);
  });
  it("errors on non-positive modulus", () => {
    expect("error" in generateFibonacci({ count: 5, mod: 0 })).toBe(true);
  });
});

describe("generateFibonacci — metadata", () => {
  it("computes sum of first N terms", () => {
    const r = generateFibonacci({ count: 5 });
    if ("error" in r) throw new Error("err");
    expect(r.sum).toBe(0n + 1n + 1n + 2n + 3n);
  });
  it("computes digit count of largest term", () => {
    const r = generateFibonacci({ count: 100 });
    if ("error" in r) throw new Error("err");
    expect(r.digitCount).toBe(21); // F(99) has 21 digits
  });
  it("verifies Cassini's identity", () => {
    const r = generateFibonacci({ count: 10 });
    if ("error" in r) throw new Error("err");
    expect(r.isCassiniValid).toBe(true);
  });
  it("computes golden ratio approximation", () => {
    const r = generateFibonacci({ count: 50 });
    if ("error" in r) throw new Error("err");
    expect(r.goldenRatio).toBeTruthy();
    expect(Number(r.goldenRatio)).toBeCloseTo(1.6180339887, 5);
  });
});

describe("indexOfFibonacci / isFibonacci", () => {
  it("finds index of 55", () => expect(indexOfFibonacci(55)).toBe(10));
  it("returns 0 for 0", () => expect(indexOfFibonacci(0)).toBe(0));
  it("returns -1 for non-Fibonacci", () => expect(indexOfFibonacci(56)).toBe(-1));
  it("isFibonacci true for 89", () => expect(isFibonacci(89)).toBe(true));
  it("isFibonacci false for 90", () => expect(isFibonacci(90)).toBe(false));
});

describe("pisanoPeriod", () => {
  it("π(2) = 3", () => expect(pisanoPeriod(2)).toBe(3));
  it("π(3) = 8", () => expect(pisanoPeriod(3)).toBe(8));
  it("π(10) = 60", () => expect(pisanoPeriod(10)).toBe(60));
  it("π(1) = 1", () => expect(pisanoPeriod(1)).toBe(1));
});

describe("exporters", () => {
  it("toCsv produces CSV", () => {
    const csv = toCsv([0n, 1n, 1n, 2n]);
    expect(csv.split("\n")[0]).toBe("Index,Value");
    expect(csv.split("\n")[4]).toBe("3,2");
  });
  it("toJson produces JSON", () => {
    const json = toJson([0n, 1n], { variant: "fibonacci", sum: "1" });
    const parsed = JSON.parse(json);
    expect(parsed.terms).toEqual(["0", "1"]);
    expect(parsed.variant).toBe("fibonacci");
  });
});
