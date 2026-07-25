import { describe, it, expect } from "vitest";
import {
  process, convertAll, toCsv, toMarkdown, UNIT_LABELS, ALL_UNITS,
  REFERENCE_FORCES, findExtremes, toNewtons, fromNewtons,
  parseInput, batchConvert, batchToCsv, formatForce, fmt,
} from "./logic";

describe("process — basic", () => {
  it("converts N to dyn", () => {
    const r = process(1, { from: "N", to: "dyn" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(100000);
  });
  it("converts kgf to N", () => {
    const r = process(1, { from: "kgf", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(9.80665, 5);
  });
  it("converts lbf to N", () => {
    const r = process(1, { from: "lbf", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(4.4482216152605, 6);
  });
  it("converts kip to lbf", () => {
    const r = process(1, { from: "kip", to: "lbf" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1000, 3);
  });
  it("converts poundal to N", () => {
    const r = process(1, { from: "poundal", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(0.138254954376, 8);
  });
  it("converts dyn to N", () => {
    const r = process(100000, { from: "dyn", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1, 6);
  });
  it("converts kN to N (×1000)", () => {
    const r = process(1, { from: "kN", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts tf to kgf (×1000)", () => {
    const r = process(1, { from: "tf", to: "kgf" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "N", to: "lbf" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on NaN", () => {
    const r = process(NaN, { from: "N", to: "kgf" });
    expect("error" in r).toBe(true);
  });
  it("errors on Infinity", () => {
    const r = process(Infinity, { from: "N", to: "kgf" });
    expect("error" in r).toBe(true);
  });
  it("returns same value for same unit", () => {
    const r = process(42, { from: "N", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
  it("warns on extreme magnitude", () => {
    const r = process(1e15, { from: "N", to: "dyn" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.join()).toMatch(/extreme|magnitude/i);
  });
});

describe("convertAll", () => {
  it("returns all 8 unit conversions", () => {
    const all = convertAll(1, "N");
    expect(all.length).toBe(8);
    const dyn = all.find((r) => r.unit === "dyn")!;
    expect(dyn.value).toBe(100000);
  });
});

describe("toCsv / toMarkdown", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "N"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("dyn,100000");
  });
  it("generates Markdown table", () => {
    const md = toMarkdown(convertAll(1, "N"));
    expect(md.split("\n")[0]).toBe("| Unit | Value |");
    expect(md).toContain("| dyn | 100000 |");
  });
});

describe("UNIT_LABELS & ALL_UNITS", () => {
  it("labels every unit", () => {
    expect(Object.keys(UNIT_LABELS).length).toBe(8);
  });
  it("ALL_UNITS contains N and tf", () => {
    expect(ALL_UNITS).toContain("N");
    expect(ALL_UNITS).toContain("tf");
  });
});

describe("REFERENCE_FORCES", () => {
  it("has at least 4 references", () => {
    expect(REFERENCE_FORCES.length).toBeGreaterThanOrEqual(4);
  });
});

describe("findExtremes", () => {
  it("returns max and min unit", () => {
    const rows = convertAll(1, "N");
    const e = findExtremes(rows);
    if ("error" in e) throw new Error("err");
    expect(e.min).toBe("tf"); // largest unit → smallest value
    expect(e.max).toBe("dyn"); // smallest unit → largest value
  });
  it("errors on empty", () => {
    expect(findExtremes([])).toHaveProperty("error");
  });
});

describe("toNewtons / fromNewtons", () => {
  it("toNewtons multiplies by factor", () => {
    expect(toNewtons(1, "kgf")).toBeCloseTo(9.80665, 5);
  });
  it("fromNewtons divides by factor", () => {
    expect(fromNewtons(9.80665, "kgf")).toBeCloseTo(1, 5);
  });
  it("toNewtons then fromNewtons is identity", () => {
    const n = toNewtons(5, "lbf");
    expect(fromNewtons(n, "lbf")).toBeCloseTo(5, 5);
  });
});

describe("parseInput", () => {
  it("parses valid number", () => {
    expect(parseInput("3.14")).toBe(3.14);
  });
  it("errors on invalid string", () => {
    expect(parseInput("abc")).toHaveProperty("error");
  });
});

describe("batchConvert / batchToCsv", () => {
  it("returns result for each value", () => {
    const r = batchConvert([1, 2, 3], "N", "dyn");
    expect(r).toHaveLength(3);
    const first = r[0]!.result;
    if (!("error" in first)) expect(first.output).toBe(100000);
  });
  it("reports errors for invalid inputs", () => {
    const r = batchConvert([NaN, 1], "N", "dyn");
    expect("error" in r[0]!.result).toBe(true);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchConvert([1, 2], "N", "dyn"));
    expect(csv.split("\n")[0]).toBe("input,output,unit,warnings");
    expect(csv).toContain("dyn");
  });
});

describe("formatForce / fmt", () => {
  it("formats with unit suffix", () => {
    expect(formatForce(9.80665, "kgf")).toContain("kgf");
  });
  it("fmt trims precision", () => {
    expect(fmt(1.23456789, 2)).toBe("1.23");
  });
  it("fmt em-dash for non-finite", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
