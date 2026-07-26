/**
 * Acceleration & Force Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  calculate,
  resultToText,
  tableToCsv,
  NEWTONS_LAWS,
  FORCE_TO_N,
  MASS_TO_KG,
  ACCEL_TO_MPS2,
} from "./logic";

describe("calculate — solve for force", () => {
  it("computes F = m·a in SI units", () => {
    const r = calculate({
      solveFor: "force",
      mass: { value: 2, unit: "kg" },
      acceleration: { value: 3, unit: "mps2" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.result.value).toBe(6);
    expect(r.result.unit).toBe("N");
  });
  it("errors when mass missing", () => {
    expect("error" in calculate({ solveFor: "force", acceleration: { value: 3, unit: "mps2" } })).toBe(true);
  });
  it("errors on zero mass", () => {
    expect("error" in calculate({ solveFor: "force", mass: { value: 0, unit: "kg" }, acceleration: { value: 5, unit: "mps2" } })).toBe(true);
  });
  it("converts lbf + g to N correctly", () => {
    const r = calculate({
      solveFor: "force",
      mass: { value: 1, unit: "lb" },
      acceleration: { value: 1, unit: "g" },
    });
    if ("error" in r) throw new Error("should not error");
    // 1 lb = 0.4536 kg; 1 g = 9.80665 m/s² → F = 4.448 N (≈ 1 lbf)
    expect(r.canonical.forceN).toBeCloseTo(4.448, 2);
  });
});

describe("calculate — solve for mass", () => {
  it("computes m = F / a", () => {
    const r = calculate({
      solveFor: "mass",
      force: { value: 10, unit: "N" },
      acceleration: { value: 2, unit: "mps2" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.result.value).toBe(5);
    expect(r.result.unit).toBe("kg");
  });
  it("errors when acceleration is zero", () => {
    expect("error" in calculate({ solveFor: "mass", force: { value: 10, unit: "N" }, acceleration: { value: 0, unit: "mps2" } })).toBe(true);
  });
  it("converts force from kN", () => {
    const r = calculate({
      solveFor: "mass",
      force: { value: 1, unit: "kN" },
      acceleration: { value: 2, unit: "mps2" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.result.value).toBe(500);
  });
});

describe("calculate — solve for acceleration", () => {
  it("computes a = F / m", () => {
    const r = calculate({
      solveFor: "acceleration",
      force: { value: 20, unit: "N" },
      mass: { value: 5, unit: "kg" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.result.value).toBe(4);
    expect(r.result.unit).toBe("m/s²");
  });
  it("errors when mass missing", () => {
    expect("error" in calculate({ solveFor: "acceleration", force: { value: 10, unit: "N" } })).toBe(true);
  });
  it("warns on extreme acceleration", () => {
    const r = calculate({
      solveFor: "acceleration",
      force: { value: 1e6, unit: "N" },
      mass: { value: 1, unit: "kg" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.some((w) => w.includes("Acceleration exceeds"))).toBe(true);
  });
});

describe("calculate — tables", () => {
  it("produces a 5-row force table when solving for force", () => {
    const r = calculate({
      solveFor: "force",
      mass: { value: 1, unit: "kg" },
      acceleration: { value: 1, unit: "mps2" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.table.length).toBe(5);
    expect(r.table.find((t) => t.unit === "N")!.value).toBe(1);
    expect(r.table.find((t) => t.unit === "kN")!.value).toBe(0.001);
  });
  it("produces a 4-row mass table when solving for mass", () => {
    const r = calculate({
      solveFor: "mass",
      force: { value: 1, unit: "N" },
      acceleration: { value: 1, unit: "mps2" },
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.table.length).toBe(4);
  });
});

describe("constants & references", () => {
  it("exposes Newton's three laws", () => {
    expect(NEWTONS_LAWS.length).toBe(3);
    expect(NEWTONS_LAWS[0]!.name).toContain("First");
    expect(NEWTONS_LAWS[2]!.name).toContain("Third");
  });
  it("has 5 force units, 4 mass units, 2 accel units", () => {
    expect(Object.keys(FORCE_TO_N)).toHaveLength(5);
    expect(Object.keys(MASS_TO_KG)).toHaveLength(4);
    expect(Object.keys(ACCEL_TO_MPS2)).toHaveLength(2);
  });
});

describe("exports", () => {
  it("resultToText produces a readable summary", () => {
    const r = calculate({
      solveFor: "force",
      mass: { value: 2, unit: "kg" },
      acceleration: { value: 3, unit: "mps2" },
    });
    if ("error" in r) throw new Error("should not error");
    const text = resultToText(r);
    expect(text).toContain("Solved for");
    expect(text).toContain("Newton's Laws");
  });
  it("tableToCsv produces a CSV with header", () => {
    const r = calculate({
      solveFor: "acceleration",
      force: { value: 10, unit: "N" },
      mass: { value: 2, unit: "kg" },
    });
    if ("error" in r) throw new Error("should not error");
    const csv = tableToCsv(r);
    expect(csv.split("\n")[0]).toBe("Unit,Label,Value");
  });
});
