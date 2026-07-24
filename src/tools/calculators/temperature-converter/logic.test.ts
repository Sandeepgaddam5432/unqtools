import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv } from "./logic";

describe("process — celsius", () => {
  it("converts celsius to fahrenheit", () => {
    const r = process(0, { from: "celsius", to: "fahrenheit" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(32);
  });
  it("converts celsius to kelvin", () => {
    const r = process(0, { from: "celsius", to: "kelvin" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(273.15, 2);
  });
  it("converts celsius to rankine", () => {
    const r = process(0, { from: "celsius", to: "rankine" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(491.67, 2);
  });
});

describe("process — fahrenheit", () => {
  it("converts fahrenheit to celsius", () => {
    const r = process(212, { from: "fahrenheit", to: "celsius" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(100, 5);
  });
  it("converts fahrenheit to kelvin", () => {
    const r = process(32, { from: "fahrenheit", to: "kelvin" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(273.15, 2);
  });
});

describe("process — kelvin", () => {
  it("converts kelvin to celsius", () => {
    const r = process(300, { from: "kelvin", to: "celsius" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(26.85, 2);
  });
  it("warns below absolute zero", () => {
    const r = process(-10, { from: "kelvin", to: "celsius" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("process — edge", () => {
  it("errors on NaN", () => {
    const r = process(NaN, { from: "celsius", to: "fahrenheit" });
    expect("error" in r).toBe(true);
  });
  it("returns same value for same unit", () => {
    const r = process(42, { from: "celsius", to: "celsius" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(0, "celsius");
    expect(all).toHaveLength(4);
    const f = all.find((r) => r.unit === "fahrenheit")!;
    expect(f.value).toBe(32);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv(convertAll(0, "celsius"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("fahrenheit,32");
  });
});
