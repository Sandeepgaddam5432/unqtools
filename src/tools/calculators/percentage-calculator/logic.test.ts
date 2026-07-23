/**
 * Percentage Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculatePercent, calculateCompoundPercent, fractionToPercent, historyToCsv } from "./logic";

describe("calculatePercent — 'of' mode (X% of Y)", () => {
  it("computes 20% of 80", () => {
    const r = calculatePercent({ mode: "of", a: 20, b: 80 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(16);
    expect(r.explanation).toContain("20% of 80");
  });
  it("0% of anything is 0", () => {
    const r = calculatePercent({ mode: "of", a: 0, b: 1000 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(0);
  });
  it("100% returns the full value", () => {
    const r = calculatePercent({ mode: "of", a: 100, b: 456 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(456);
  });
});

describe("calculatePercent — 'isWhatPercent' mode", () => {
  it("computes 25 is what % of 200", () => {
    const r = calculatePercent({ mode: "isWhatPercent", a: 25, b: 200 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(12.5);
  });
  it("errors on divide by zero", () => {
    expect("error" in calculatePercent({ mode: "isWhatPercent", a: 10, b: 0 })).toBe(true);
  });
});

describe("calculatePercent — 'change' mode", () => {
  it("computes positive change", () => {
    const r = calculatePercent({ mode: "change", a: 100, b: 150 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(50);
    expect(r.explanation).toContain("increase");
  });
  it("computes negative change", () => {
    const r = calculatePercent({ mode: "change", a: 200, b: 150 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(-25);
    expect(r.explanation).toContain("decrease");
  });
  it("errors on change from 0", () => {
    expect("error" in calculatePercent({ mode: "change", a: 0, b: 10 })).toBe(true);
  });
});

describe("calculatePercent — 'ofTotal' mode", () => {
  it("computes A is what % of A+B", () => {
    const r = calculatePercent({ mode: "ofTotal", a: 30, b: 70 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(30);
  });
});

describe("calculatePercent — 'reverse' mode", () => {
  it("reverse calculates original from final + percent", () => {
    // 100 is final after 25% increase → original = 80
    const r = calculatePercent({ mode: "reverse", a: 100, b: 25 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(80);
  });
  it("handles negative percent in reverse", () => {
    // 80 is final after 20% decrease → original = 100
    const r = calculatePercent({ mode: "reverse", a: 80, b: -20 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(100);
  });
  it("errors on -100% (would divide by zero)", () => {
    expect("error" in calculatePercent({ mode: "reverse", a: 100, b: -100 })).toBe(true);
  });
});

describe("calculatePercent — 'error' mode (percent error)", () => {
  it("computes percent error for measured vs accepted", () => {
    // measured=105, accepted=100 → |5|/100 * 100 = 5%
    const r = calculatePercent({ mode: "error", a: 105, b: 100 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.result).toBe(5);
  });
  it("errors when accepted is 0", () => {
    expect("error" in calculatePercent({ mode: "error", a: 50, b: 0 })).toBe(true);
  });
});

describe("precision control", () => {
  it("respects precision setting", () => {
    const r1 = calculatePercent({ mode: "of", a: 33, b: 100, precision: 0 });
    const r2 = calculatePercent({ mode: "of", a: 33, b: 100, precision: 4 });
    if ("error" in r1 || "error" in r2) throw new Error("Should not error");
    expect(r1.result).toBe(33);
    expect(r2.result).toBe(33);
  });
});

describe("calculateCompoundPercent", () => {
  it("chains multiple percent changes", () => {
    const r = calculateCompoundPercent({ initial: 100, changes: [10, -5, 20] });
    if ("error" in r) throw new Error("Should not error");
    // 100 → 110 → 104.5 → 125.4
    expect(r.finalValue).toBeCloseTo(125.4, 1);
    expect(r.steps.length).toBe(3);
    expect(r.steps[0]!.valueAfter).toBeCloseTo(110, 1);
    expect(r.steps[1]!.valueAfter).toBeCloseTo(104.5, 1);
  });
  it("computes total cumulative change", () => {
    const r = calculateCompoundPercent({ initial: 100, changes: [50] });
    if ("error" in r) throw new Error("Should not error");
    expect(r.totalChangePct).toBe(50);
    expect(r.multiplier).toBe(1.5);
  });
  it("errors on empty changes array", () => {
    expect("error" in calculateCompoundPercent({ initial: 100, changes: [] })).toBe(true);
  });
});

describe("fractionToPercent", () => {
  it("converts 1/4 to 25%", () => {
    const r = fractionToPercent(1, 4);
    if (typeof r !== "number") throw new Error("Should be number");
    expect(r).toBe(25);
  });
  it("errors on zero denominator", () => {
    expect(typeof fractionToPercent(1, 0)).toBe("object");
  });
});

describe("historyToCsv", () => {
  it("generates CSV with header", () => {
    const csv = historyToCsv([
      { mode: "of", explanation: "10% of 50 = 5", result: 5, ts: 1700000000000 },
    ]);
    expect(csv.split("\n")[0]).toContain("Timestamp");
    expect(csv.split("\n")[1]).toContain("of");
    expect(csv.split("\n")[1]).toContain("5");
  });
  it("handles empty history", () => {
    const csv = historyToCsv([]);
    expect(csv.split("\n").length).toBe(1);
  });
  it("escapes quotes in explanations", () => {
    const csv = historyToCsv([
      { mode: "of", explanation: 'Has "quote" inside', result: 5, ts: 1700000000000 },
    ]);
    expect(csv).toContain('""quote""');
  });
});
