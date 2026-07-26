/**
 * Area Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  convertArea,
  buildAreaTable,
  areaReferenceCsv,
  tableToText,
  AREA_FACTORS_TO_M2,
} from "./logic";

describe("convertArea", () => {
  it("converts m² → ft²", () => {
    expect(convertArea(1, "m2", "ft2")).toBeCloseTo(10.7639, 3);
  });
  it("converts acre → m²", () => {
    expect(convertArea(1, "acre", "m2")).toBeCloseTo(4046.8564, 2);
  });
  it("converts hectare → acre", () => {
    expect(convertArea(1, "hectare", "acre")).toBeCloseTo(2.4711, 3);
  });
  it("converts km² → mi²", () => {
    expect(convertArea(1, "km2", "mi2")).toBeCloseTo(0.3861, 3);
  });
  it("converts ft² → m²", () => {
    expect(convertArea(1, "ft2", "m2")).toBeCloseTo(0.0929, 4);
  });
  it("returns identity for same unit", () => {
    expect(convertArea(42, "m2", "m2")).toBe(42);
  });
  it("returns NaN for non-finite", () => {
    expect(Number.isNaN(convertArea(NaN, "m2", "ft2"))).toBe(true);
  });
});

describe("buildAreaTable", () => {
  it("errors on negative", () => {
    expect("error" in buildAreaTable(-5, "m2")).toBe(true);
  });
  it("errors on non-finite", () => {
    expect("error" in buildAreaTable(Infinity, "acre")).toBe(true);
  });
  it("produces all 6 units", () => {
    const r = buildAreaTable(1, "acre");
    if ("error" in r) throw new Error("should not error");
    expect(r.table.length).toBe(6);
  });
  it("converts input via m² canonical form", () => {
    const r = buildAreaTable(1, "acre");
    if ("error" in r) throw new Error("should not error");
    expect(r.m2).toBeCloseTo(4046.86, 1);
  });
  it("warns on zero area", () => {
    const r = buildAreaTable(0, "m2");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Zero"))).toBe(true);
  });
  it("warns on very large area", () => {
    const r = buildAreaTable(1e10, "km2");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("large"))).toBe(true);
  });
});

describe("areaReferenceCsv", () => {
  it("contains header and reference rows", () => {
    const csv = areaReferenceCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Reference");
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe("tableToText", () => {
  it("renders the table as readable text", () => {
    const r = buildAreaTable(1, "hectare");
    if ("error" in r) throw new Error("should not error");
    const text = tableToText(r);
    expect(text).toContain("Input");
    expect(text).toContain("ha");
    expect(text).toContain("acre");
  });
});

describe("constants", () => {
  it("m² factor is exactly 1", () => {
    expect(AREA_FACTORS_TO_M2.m2).toBe(1);
  });
  it("has 6 units", () => {
    expect(Object.keys(AREA_FACTORS_TO_M2)).toHaveLength(6);
  });
});
