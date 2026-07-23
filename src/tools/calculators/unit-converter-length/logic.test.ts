/**
 * Unit Converter (Length) — unit tests.
 */
import { describe, it, expect } from "vitest";
import { convertLength, convertToAll, parseChainedLength, metersToFeetInches, historyToCsv, LENGTH_UNITS } from "./logic";

describe("convertLength — basic", () => {
  it("converts 1 m to 100 cm", () => {
    const r = convertLength({ value: 1, fromUnit: "m", toUnit: "cm" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.toValue).toBe(100);
  });
  it("converts 1 km to 1000 m", () => {
    const r = convertLength({ value: 1, fromUnit: "km", toUnit: "m" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.toValue).toBe(1000);
  });
  it("converts 1 mile to 1.609344 km", () => {
    const r = convertLength({ value: 1, fromUnit: "mi", toUnit: "km" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.toValue).toBeCloseTo(1.609344, 6);
  });
  it("converts 1 inch to 2.54 cm exactly", () => {
    const r = convertLength({ value: 1, fromUnit: "in", toUnit: "cm" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.toValue).toBe(2.54);
  });
  it("errors on unknown unit", () => {
    expect("error" in convertLength({ value: 1, fromUnit: "furlong", toUnit: "m" })).toBe(true);
  });
  it("handles 0 value", () => {
    const r = convertLength({ value: 0, fromUnit: "m", toUnit: "ft" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.toValue).toBe(0);
  });
});

describe("convertLength — precision", () => {
  it("respects precision setting", () => {
    const r = convertLength({ value: 1, fromUnit: "m", toUnit: "in", precision: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.toValue).toBe(39); // 39.37 → 39
  });
  it("uses scientific notation when value is very large", () => {
    const r = convertLength({ value: 1, fromUnit: "ly", toUnit: "m" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.formatted).toContain("e+");
  });
  it("uses scientific notation when value is very small", () => {
    const r = convertLength({ value: 0.0000001, fromUnit: "m", toUnit: "km" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.formatted).toContain("e-");
  });
  it("forces scientific notation when flag is set", () => {
    const r = convertLength({ value: 100, fromUnit: "m", toUnit: "m", scientificNotation: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.formatted).toContain("e+");
  });
});

describe("convertToAll", () => {
  it("returns all units with values", () => {
    const r = convertToAll(1, "m");
    if ("error" in r) throw new Error("Should not error");
    expect(r.rows.length).toBe(LENGTH_UNITS.length);
    const cmRow = r.rows.find((row) => row.unit.id === "cm");
    expect(cmRow?.value).toBe(100);
  });
  it("errors on invalid input", () => {
    expect("error" in convertToAll(Number.NaN, "m")).toBe(true);
    expect("error" in convertToAll(1, "furlong")).toBe(true);
  });
});

describe("parseChainedLength", () => {
  it("parses '5 km 300 m 50 cm' into total meters", () => {
    const r = parseChainedLength("5 km 300 m 50 cm");
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalMeters).toBeCloseTo(5300.5, 4);
    expect(r.breakdown.length).toBe(3);
  });
  it("accepts unit symbols as well as IDs", () => {
    const r = parseChainedLength("1 km 500 m");
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalMeters).toBe(1500);
  });
  it("errors on odd number of tokens", () => {
    expect("error" in parseChainedLength("5 km 300")).toBe(true);
  });
  it("errors on unknown unit", () => {
    expect("error" in parseChainedLength("5 lightyears")).toBe(true);
  });
});

describe("metersToFeetInches", () => {
  it("converts 1.7 m to ~5 ft 7 in", () => {
    const r = metersToFeetInches(1.7);
    expect(r.feet).toBe(5);
    expect(r.inches).toBeGreaterThan(6);
    expect(r.inches).toBeLessThan(8);
  });
  it("handles 0 m", () => {
    const r = metersToFeetInches(0);
    expect(r.feet).toBe(0);
    expect(r.inches).toBe(0);
  });
  it("display string contains ft and in", () => {
    const r = metersToFeetInches(2);
    expect(r.display).toContain("ft");
    expect(r.display).toContain("in");
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([{ ts: 1700000000000, value: 1, from: "m", to: "ft", result: 3.28 }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Value,From,To,Result");
  });
});

describe("LENGTH_UNITS completeness", () => {
  it("contains at least 18 units", () => {
    expect(LENGTH_UNITS.length).toBeGreaterThanOrEqual(18);
  });
  it("has unique IDs", () => {
    const ids = LENGTH_UNITS.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("all factors are positive numbers", () => {
    for (const u of LENGTH_UNITS) {
      expect(u.factor).toBeGreaterThan(0);
    }
  });
});
