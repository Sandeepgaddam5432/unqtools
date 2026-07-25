import { describe, it, expect } from "vitest";
import { calculatePercentageChange, newValueFromPctChange, oldValueFromPctChange, formatPct, resultToCsv } from "./logic";

describe("calculatePercentageChange", () => {
  it("computes increase", () => {
    const r = calculatePercentageChange({ oldValue: 100, newValue: 150 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.percentChange).toBe(50);
    expect(r.direction).toBe("increase");
  });
  it("computes decrease", () => {
    const r = calculatePercentageChange({ oldValue: 100, newValue: 80 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.percentChange).toBe(-20);
    expect(r.direction).toBe("decrease");
  });
  it("computes no-change", () => {
    const r = calculatePercentageChange({ oldValue: 50, newValue: 50 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.percentChange).toBe(0);
    expect(r.direction).toBe("no-change");
  });
  it("handles negative old value", () => {
    const r = calculatePercentageChange({ oldValue: -100, newValue: -50 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.percentChange).toBe(50);
    expect(r.direction).toBe("increase");
  });
  it("errors on zero old value", () => {
    expect(calculatePercentageChange({ oldValue: 0, newValue: 100 })).toHaveProperty("error");
  });
  it("errors on non-finite input", () => {
    expect(calculatePercentageChange({ oldValue: Number.NaN, newValue: 100 })).toHaveProperty("error");
  });
  it("computes multiplier", () => {
    const r = calculatePercentageChange({ oldValue: 50, newValue: 100 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.multiplier).toBe(2);
  });
});

describe("newValueFromPctChange", () => {
  it("computes new value from +50%", () => {
    const r = newValueFromPctChange(100, 50);
    if ("error" in r) throw new Error("Should not error");
    expect(r.newValue).toBe(150);
  });
  it("computes new value from -20%", () => {
    const r = newValueFromPctChange(100, -20);
    if ("error" in r) throw new Error("Should not error");
    expect(r.newValue).toBe(80);
  });
  it("errors on non-finite", () => {
    expect(newValueFromPctChange(Number.NaN, 50)).toHaveProperty("error");
  });
});

describe("oldValueFromPctChange", () => {
  it("computes old value from new + pct", () => {
    const r = oldValueFromPctChange(150, 50);
    if ("error" in r) throw new Error("Should not error");
    expect(r.oldValue).toBe(100);
  });
  it("errors on -100% change", () => {
    expect(oldValueFromPctChange(0, -100)).toHaveProperty("error");
  });
});

describe("formatPct", () => {
  it("adds + sign for positive", () => {
    expect(formatPct(50)).toBe("+50.00%");
  });
  it("keeps - sign for negative", () => {
    expect(formatPct(-20)).toBe("-20.00%");
  });
  it("zero has no + sign", () => {
    expect(formatPct(0)).toBe("0.00%");
  });
});

describe("resultToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculatePercentageChange({ oldValue: 100, newValue: 150 });
    if ("error" in r) throw new Error("Should not error");
    const csv = resultToCsv(r);
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Percent Change,50");
  });
});
