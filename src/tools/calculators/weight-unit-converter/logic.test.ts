import { describe, it, expect } from "vitest";
import {
  process,
  convertAll,
  toCsv,
  batchConvert,
  batchToCsv,
  formatWeight,
  historyToCsv,
  parseBatchInput,
  isValidUnit,
  unitGroups,
  TO_GRAMS,
  UNIT_LABELS,
} from "./logic";

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
  it("converts troy oz to g", () => {
    const r = process(1, { from: "troy_oz", to: "g" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(31.1034768, 4);
  });
  it("converts grain to mg", () => {
    const r = process(1, { from: "grain", to: "mg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(64.79891, 4);
  });
  it("converts pennyweight to oz", () => {
    const r = process(1, { from: "pennyweight", to: "oz" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(0.0548571, 4);
  });
  it("converts microgram to mg", () => {
    const r = process(1000, { from: "ug", to: "mg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1);
  });
  it("converts short ton to lb", () => {
    const r = process(1, { from: "ton_us", to: "lb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(2000, 2);
  });
  it("converts long ton to lb", () => {
    const r = process(1, { from: "ton_uk", to: "lb" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(2240, 2);
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "g", to: "kg" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns on extraordinarily large input", () => {
    const r = process(1e16, { from: "g", to: "kg" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("extraordinarily"))).toBe(true);
  });
  it("errors on NaN", () => {
    const r = process(NaN, { from: "g", to: "kg" });
    expect("error" in r).toBe(true);
  });
  it("errors on Infinity", () => {
    const r = process(Infinity, { from: "g", to: "kg" });
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
    expect(all.length).toBeGreaterThanOrEqual(15);
    const g = all.find((r) => r.unit === "g")!;
    expect(g.value).toBe(1000);
  });
});

describe("batchConvert", () => {
  it("processes multiple values", () => {
    const out = batchConvert([1, 2], "kg", "g");
    expect(out).toHaveLength(2);
    expect(out[0]!.output).toBe(1000);
    expect(out[1]!.output).toBe(2000);
  });
  it("skips invalid values", () => {
    const out = batchConvert([1, NaN, 3], "kg", "g");
    expect(out).toHaveLength(2);
  });
});

describe("formatWeight", () => {
  it("formats with unit symbol", () => {
    expect(formatWeight(1, "kg")).toContain("kg");
  });
  it("returns dash for non-finite", () => {
    expect(formatWeight(NaN, "g")).toBe("—");
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const csv = toCsv(convertAll(1, "kg"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("g,1000");
  });
});

describe("batchToCsv", () => {
  it("includes warnings column", () => {
    const csv = batchToCsv([{ input: 1, output: 1000, warnings: [] }], "kg", "g");
    expect(csv.split("\n")[0]).toContain("Warnings");
    expect(csv).toContain("1000");
  });
});

describe("historyToCsv", () => {
  it("generates CSV", () => {
    const csv = historyToCsv([{ ts: 1700000000000, input: 1, from: "kg", to: "g", output: 1000 }]);
    expect(csv.split("\n")[0]).toBe("Timestamp,Input,From,Output,To");
    expect(csv).toContain("kg");
  });
});

describe("parseBatchInput", () => {
  it("parses numbers and skips junk", () => {
    const { values, skipped } = parseBatchInput("1\n2\njunk\n");
    expect(values).toEqual([1, 2]);
    expect(skipped).toBe(1);
  });
});

describe("isValidUnit", () => {
  it("accepts known units", () => {
    expect(isValidUnit("kg")).toBe(true);
    expect(isValidUnit("troy_lb")).toBe(true);
  });
  it("rejects unknown units", () => {
    expect(isValidUnit("nope")).toBe(false);
  });
});

describe("unitGroups", () => {
  it("groups units by category", () => {
    const g = unitGroups();
    expect(g.length).toBe(3);
    expect(g.flatMap((x) => x.units).length).toBeGreaterThanOrEqual(15);
  });
});

describe("constants", () => {
  it("has labels for every unit", () => {
    for (const u of Object.keys(TO_GRAMS) as (keyof typeof TO_GRAMS)[]) {
      expect(UNIT_LABELS[u]).toBeTruthy();
    }
  });
  it("has 15 supported units", () => {
    expect(Object.keys(TO_GRAMS)).toHaveLength(15);
  });
});
