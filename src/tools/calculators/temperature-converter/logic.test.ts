import { describe, it, expect } from "vitest";
import {
  process,
  convertAll,
  toCsv,
  batchConvert,
  batchToCsv,
  formatTemp,
  formulaFor,
  commonReferenceTable,
  historyToCsv,
  parseBatchInput,
  UNIT_LABELS,
  ABSOLUTE_ZERO,
} from "./logic";

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
  it("includes a formula string", () => {
    const r = process(0, { from: "celsius", to: "fahrenheit" });
    if ("error" in r) throw new Error("err");
    expect(r.formula).toContain("°C");
    expect(r.formula).toContain("°F");
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
  it("warns at absolute zero", () => {
    const r = process(0, { from: "kelvin", to: "celsius" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("absolute zero"))).toBe(true);
  });
});

describe("process — rankine", () => {
  it("converts rankine to fahrenheit", () => {
    const r = process(491.67, { from: "rankine", to: "fahrenheit" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(32, 2);
  });
});

describe("process — edge", () => {
  it("errors on NaN", () => {
    const r = process(NaN, { from: "celsius", to: "fahrenheit" });
    expect("error" in r).toBe(true);
  });
  it("errors on Infinity", () => {
    const r = process(Infinity, { from: "celsius", to: "fahrenheit" });
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

describe("batchConvert", () => {
  it("processes multiple values", () => {
    const out = batchConvert([0, 100], "celsius", "fahrenheit");
    expect(out).toHaveLength(2);
    expect(out[0]!.output).toBe(32);
    expect(out[1]!.output).toBe(212);
  });
  it("skips invalid values", () => {
    const out = batchConvert([0, NaN], "celsius", "fahrenheit");
    expect(out).toHaveLength(1);
  });
});

describe("formulaFor", () => {
  it("returns identity for same unit", () => {
    expect(formulaFor("celsius", "celsius")).toContain("identity");
  });
  it("returns a formula for celsius → fahrenheit", () => {
    expect(formulaFor("celsius", "fahrenheit")).toContain("K");
  });
});

describe("formatTemp", () => {
  it("formats with unit symbol", () => {
    expect(formatTemp(25, "celsius")).toBe("25.00 °C");
  });
  it("returns dash for non-finite", () => {
    expect(formatTemp(NaN, "kelvin")).toBe("—");
  });
});

describe("commonReferenceTable", () => {
  it("includes common temperatures", () => {
    const t = commonReferenceTable();
    expect(t.length).toBeGreaterThanOrEqual(5);
    const boiling = t.find((e) => e.label.includes("boiling"))!;
    expect(boiling.celsius).toBe(100);
    expect(boiling.fahrenheit).toBe(212);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv(convertAll(0, "celsius"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("fahrenheit,32");
  });
});

describe("batchToCsv", () => {
  it("includes warnings column", () => {
    const csv = batchToCsv([{ input: 0, output: 32, warnings: ["ok"] }], "celsius", "fahrenheit");
    expect(csv.split("\n")[0]).toContain("Warnings");
    expect(csv).toContain("32");
  });
});

describe("historyToCsv", () => {
  it("generates CSV", () => {
    const csv = historyToCsv([{ ts: 1700000000000, input: 0, from: "celsius", to: "fahrenheit", output: 32 }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Input,From,Output,To");
    expect(csv).toContain("fahrenheit");
  });
});

describe("parseBatchInput", () => {
  it("parses numbers and skips junk", () => {
    const { values, skipped } = parseBatchInput("0\n100\njunk\n");
    expect(values).toEqual([0, 100]);
    expect(skipped).toBe(1);
  });
});

describe("constants", () => {
  it("exposes 4 unit labels", () => {
    expect(Object.keys(UNIT_LABELS)).toHaveLength(4);
  });
  it("absolute zero for kelvin is 0", () => {
    expect(ABSOLUTE_ZERO.kelvin).toBe(0);
  });
});
