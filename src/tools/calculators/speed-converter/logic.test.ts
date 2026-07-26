/**
 * Speed Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  convertSpeed,
  buildSpeedTable,
  speedReferenceCsv,
  tableToText,
  SPEED_FACTORS_TO_MS,
  SPEED_LABELS,
} from "./logic";

describe("convertSpeed", () => {
  it("converts mph → kmh", () => {
    expect(convertSpeed(60, "mph", "kmh")).toBeCloseTo(96.56, 1);
  });
  it("converts kmh → mph", () => {
    expect(convertSpeed(100, "kmh", "mph")).toBeCloseTo(62.14, 1);
  });
  it("converts ms → kmh", () => {
    expect(convertSpeed(10, "ms", "kmh")).toBeCloseTo(36, 0);
  });
  it("converts knot → mph", () => {
    expect(convertSpeed(10, "knot", "mph")).toBeCloseTo(11.51, 1);
  });
  it("converts fps → ms", () => {
    expect(convertSpeed(10, "fps", "ms")).toBeCloseTo(3.048, 3);
  });
  it("returns identity for same unit", () => {
    expect(convertSpeed(42, "mph", "mph")).toBe(42);
  });
  it("returns NaN for non-finite input", () => {
    expect(Number.isNaN(convertSpeed(NaN, "mph", "kmh"))).toBe(true);
  });
});

describe("buildSpeedTable", () => {
  it("errors on negative speed", () => {
    expect("error" in buildSpeedTable(-10, "mph")).toBe(true);
  });
  it("errors on non-finite", () => {
    expect("error" in buildSpeedTable(Infinity, "mph")).toBe(true);
  });
  it("produces all 5 units in the table", () => {
    const r = buildSpeedTable(60, "mph");
    if ("error" in r) throw new Error("should not error");
    expect(r.table.length).toBe(5);
    expect(r.table.map((e) => e.unit)).toEqual(expect.arrayContaining(["mph", "kmh", "ms", "fps", "knot"]));
  });
  it("converts input via m/s canonical form", () => {
    const r = buildSpeedTable(60, "mph");
    if ("error" in r) throw new Error("should not error");
    expect(r.ms).toBeCloseTo(26.82, 1);
  });
  it("warns on supersonic speed", () => {
    const r = buildSpeedTable(800, "mph");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("supersonic"))).toBe(true);
  });
  it("warns on zero speed", () => {
    const r = buildSpeedTable(0, "ms");
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("stationary"))).toBe(true);
  });
});

describe("speedReferenceCsv", () => {
  it("contains header and reference rows", () => {
    const csv = speedReferenceCsv();
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Reference");
    expect(lines.length).toBeGreaterThan(5);
  });
});

describe("tableToText", () => {
  it("renders the table as readable text", () => {
    const r = buildSpeedTable(50, "kmh");
    if ("error" in r) throw new Error("should not error");
    const text = tableToText(r);
    expect(text).toContain("Input");
    expect(text).toContain("km/h");
    expect(text).toContain("m/s");
  });
});

describe("constants", () => {
  it("exposes factor map and label map for 5 units", () => {
    expect(Object.keys(SPEED_FACTORS_TO_MS)).toHaveLength(5);
    expect(Object.keys(SPEED_LABELS)).toHaveLength(5);
  });
  it("m/s factor is exactly 1", () => {
    expect(SPEED_FACTORS_TO_MS.ms).toBe(1);
  });
});
