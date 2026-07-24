import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv } from "./logic";

describe("process — basic", () => {
  it("converts kg to g", () => {
    const r = process(1, { from: "kg", to: "g" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts g to kg", () => {
    const r = process(1000, { from: "g", to: "kg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1);
  });
  it("converts lb to kg", () => {
    const r = process(2.2046226218, { from: "lb", to: "kg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1, 4);
  });
});

describe("process — units", () => {
  it("converts carats to grams", () => {
    const r = process(5, { from: "carat", to: "g" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1);
  });
  it("converts stone to lb", () => {
    const r = process(1, { from: "stone", to: "lb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(14, 5);
  });
  it("converts metric ton to kg", () => {
    const r = process(1, { from: "ton", to: "kg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "g", to: "kg" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on NaN", () => {
    const r = process(NaN, { from: "g", to: "kg" });
    expect("error" in r).toBe(true);
  });
  it("returns same value for same unit", () => {
    const r = process(42, { from: "g", to: "g" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(1, "kg");
    expect(all.length).toBeGreaterThanOrEqual(10);
    const g = all.find((r) => r.unit === "g")!;
    expect(g.value).toBe(1000);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv(convertAll(1, "kg"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("g,1000");
  });
});
