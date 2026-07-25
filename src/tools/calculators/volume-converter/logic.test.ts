import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv, UNIT_LABELS } from "./logic";

describe("process — basic", () => {
  it("converts L to ml", () => {
    const r = process(1, { from: "L", to: "ml" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });

  it("converts ml to L", () => {
    const r = process(1000, { from: "ml", to: "L" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1);
  });

  it("converts gallon to L", () => {
    const r = process(1, { from: "gal", to: "L" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(3.785411784, 4);
  });

  it("converts cup to tbsp", () => {
    const r = process(1, { from: "cup", to: "tbsp" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(16, 4);
  });

  it("converts quart to pint", () => {
    const r = process(2, { from: "quart", to: "pint" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(4, 4);
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "ml", to: "L" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("errors on NaN", () => {
    const r = process(NaN, { from: "L", to: "gal" });
    expect("error" in r).toBe(true);
  });

  it("returns same value for same unit", () => {
    const r = process(42, { from: "tsp", to: "tsp" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(1, "L");
    expect(all.length).toBeGreaterThanOrEqual(9);
    const ml = all.find((r) => r.unit === "ml")!;
    expect(ml.value).toBe(1000);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "L"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("ml,1000");
  });
});

describe("UNIT_LABELS", () => {
  it("has labels for every unit", () => {
    expect(Object.keys(UNIT_LABELS).length).toBeGreaterThanOrEqual(9);
  });
});
