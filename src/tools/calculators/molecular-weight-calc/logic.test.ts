import { describe, it, expect } from "vitest";
import { ATOMIC_WEIGHTS, parseFormula, computeMolecularWeight, molecularWeight, validateFormula } from "./logic";

describe("ATOMIC_WEIGHTS", () => {
  it("has at least 20 elements", () => {
    expect(Object.keys(ATOMIC_WEIGHTS).length).toBeGreaterThanOrEqual(20);
  });
  it("includes H and O", () => {
    expect(ATOMIC_WEIGHTS.H).toBeDefined();
    expect(ATOMIC_WEIGHTS.O).toBeDefined();
  });
});

describe("parseFormula", () => {
  it("parses simple formula H2O", () => {
    const r = parseFormula("H2O");
    expect(r.tokens).toContainEqual({ element: "H", count: 2 });
    expect(r.tokens).toContainEqual({ element: "O", count: 1 });
  });
  it("defaults to count 1 when no digit follows", () => {
    const r = parseFormula("NaCl");
    expect(r.tokens).toContainEqual({ element: "Na", count: 1 });
    expect(r.tokens).toContainEqual({ element: "Cl", count: 1 });
  });
  it("handles parentheses with multiplier", () => {
    const r = parseFormula("Ca(OH)2");
    const ca = r.tokens.find((t) => t.element === "Ca");
    const o = r.tokens.find((t) => t.element === "O");
    const h = r.tokens.find((t) => t.element === "H");
    expect(ca?.count).toBe(1);
    expect(o?.count).toBe(2);
    expect(h?.count).toBe(2);
  });
  it("handles nested parentheses", () => {
    const r = parseFormula("Mg(OH(CO3)2)2");
    expect(r.tokens.length).toBeGreaterThan(0);
  });
  it("flags unknown elements", () => {
    const r = parseFormula("Xx2O");
    expect(r.unknown).toContain("Xx");
  });
});

describe("computeMolecularWeight", () => {
  it("computes weight for H2O", () => {
    const r = computeMolecularWeight([{ element: "H", count: 2 }, { element: "O", count: 1 }]);
    expect(r.weight).toBeCloseTo(2 * 1.008 + 15.999, 2);
  });
  it("flags missing elements", () => {
    const r = computeMolecularWeight([{ element: "Xx", count: 1 }]);
    expect(r.missing).toContain("Xx");
  });
});

describe("molecularWeight", () => {
  it("computes H2O as ≈ 18.015", () => {
    const r = molecularWeight("H2O");
    if ("error" in r) throw new Error("Should not error");
    expect(r.weight).toBeCloseTo(18.015, 1);
  });
  it("computes NaCl", () => {
    const r = molecularWeight("NaCl");
    if ("error" in r) throw new Error("Should not error");
    expect(r.weight).toBeCloseTo(22.99 + 35.45, 1);
  });
  it("computes Ca(OH)2", () => {
    const r = molecularWeight("Ca(OH)2");
    if ("error" in r) throw new Error("Should not error");
    const expected = 40.078 + 2 * (15.999 + 1.008);
    expect(r.weight).toBeCloseTo(expected, 1);
  });
  it("errors on empty input", () => {
    expect("error" in molecularWeight("")).toBe(true);
  });
  it("errors on unknown elements", () => {
    expect("error" in molecularWeight("Xx2")).toBe(true);
  });
});

describe("validateFormula", () => {
  it("accepts non-empty formula", () => {
    expect(validateFormula("H2O")).toEqual({ ok: true });
  });
  it("rejects empty formula", () => {
    expect(validateFormula("")).toHaveProperty("error");
  });
});
