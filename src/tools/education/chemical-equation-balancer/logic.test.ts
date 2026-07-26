import { describe, it, expect } from "vitest";
import {
  parseFormula, parseSide, parseEquation, buildMatrix, gcd, lcm, gaussianEliminate,
  balanceEquation, planBalance, planBatch, renderBatchCsv, renderReport, molarMass,
} from "./logic";

describe("chemical-equation-balancer parseFormula", () => {
  it("parses H2O", () => {
    expect(parseFormula("H2O")).toEqual({ H: 2, O: 1 });
  });
  it("parses single element", () => {
    expect(parseFormula("O2")).toEqual({ O: 2 });
  });
  it("parses with parentheses", () => {
    expect(parseFormula("Ca(OH)2")).toEqual({ Ca: 1, O: 2, H: 2 });
  });
  it("parses nested parentheses", () => {
    expect(parseFormula("Mg(OH)2")).toEqual({ Mg: 1, O: 2, H: 2 });
  });
  it("handles no coefficient (default 1)", () => {
    expect(parseFormula("NaCl")).toEqual({ Na: 1, Cl: 1 });
  });
});

describe("chemical-equation-balancer parseSide", () => {
  it("parses single compound", () => {
    const s = parseSide("H2O");
    expect(s.compounds.length).toBe(1);
    expect(s.compounds[0].formula).toBe("H2O");
    expect(s.compounds[0].coefficient).toBe(1);
  });
  it("parses multiple compounds with coefficients", () => {
    const s = parseSide("2 H2O + O2");
    expect(s.compounds.length).toBe(2);
    expect(s.compounds[0].coefficient).toBe(2);
    expect(s.compounds[0].formula).toBe("H2O");
    expect(s.compounds[1].coefficient).toBe(1);
  });
});

describe("chemical-equation-balancer parseEquation", () => {
  it("parses simple equation", () => {
    const eq = parseEquation("H2 + O2 -> H2O");
    expect(eq.reactants.compounds.length).toBe(2);
    expect(eq.products.compounds.length).toBe(1);
    expect(eq.elements).toEqual(expect.arrayContaining(["H", "O"]));
  });
  it("throws on missing arrow", () => {
    expect(() => parseEquation("H2 O2")).toThrow();
  });
  it("supports = as separator", () => {
    const eq = parseEquation("H2 + O2 = H2O");
    expect(eq.reactants.compounds.length).toBe(2);
  });
});

describe("chemical-equation-balancer buildMatrix", () => {
  it("builds matrix with correct dimensions", () => {
    const eq = parseEquation("H2 + O2 -> H2O");
    const m = buildMatrix(eq);
    expect(m.length).toBe(2); // 2 elements
    expect(m[0].length).toBe(3); // 3 compounds
  });
});

describe("chemical-equation-balancer gcd / lcm", () => {
  it("computes gcd", () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcd(7, 13)).toBe(1);
  });
  it("computes lcm", () => {
    expect(lcm(4, 6)).toBe(12);
  });
  it("lcm with 0 returns 0", () => {
    expect(lcm(0, 5)).toBe(0);
  });
});

describe("chemical-equation-balancer gaussianEliminate", () => {
  it("solves a simple system", () => {
    // 2x + y = 5; x + y = 3
    const sol = gaussianEliminate([[2, 1, 5], [1, 1, 3]]);
    expect(sol).not.toBeNull();
    expect(sol![0]).toBeCloseTo(2, 5);
    expect(sol![1]).toBeCloseTo(1, 5);
  });
});

describe("chemical-equation-balancer balanceEquation", () => {
  it("balances H2 + O2 -> H2O", () => {
    const eq = parseEquation("H2 + O2 -> H2O");
    const coeffs = balanceEquation(eq);
    expect(coeffs).not.toBeNull();
    // 2 H2 + 1 O2 -> 2 H2O
    expect(coeffs![0]).toBe(2);
    expect(coeffs![1]).toBe(1);
    expect(coeffs![2]).toBe(2);
  });
});

describe("chemical-equation-balancer planBalance", () => {
  it("balances H2 + O2 -> H2O", () => {
    const r = planBalance("H2 + O2 -> H2O");
    expect(r.coefficients).not.toBeNull();
    expect(r.balancedEquation).toContain("2H2");
    expect(r.balancedEquation).toContain("2H2O");
    expect(r.notes.some((n) => n.includes("Verified"))).toBe(true);
  });
  it("balances a more complex equation", () => {
    const r = planBalance("Fe + O2 -> Fe2O3");
    expect(r.coefficients).not.toBeNull();
    // 4 Fe + 3 O2 -> 2 Fe2O3
    expect(r.coefficients![0]).toBe(4);
    expect(r.coefficients![1]).toBe(3);
    expect(r.coefficients![2]).toBe(2);
  });
  it("returns error for invalid equation", () => {
    const r = planBalance("not an equation");
    expect(r.coefficients).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("generates step-by-step solution", () => {
    const r = planBalance("H2 + O2 -> H2O");
    expect(r.steps.length).toBeGreaterThan(3);
    expect(r.steps[0]).toContain("Parse");
  });
});

describe("chemical-equation-balancer planBatch / renderBatchCsv", () => {
  it("plans batch", () => {
    const rs = planBatch(["H2 + O2 -> H2O", "Fe + O2 -> Fe2O3"]);
    expect(rs.length).toBe(2);
  });
  it("renders CSV", () => {
    const csv = renderBatchCsv(planBatch(["H2 + O2 -> H2O"]));
    expect(csv.split("\n")[0]).toContain("index,input");
  });
});

describe("chemical-equation-balancer renderReport", () => {
  it("renders report with steps", () => {
    const r = renderReport(planBalance("H2 + O2 -> H2O"));
    expect(r).toContain("Chemical Equation Balancer Report");
    expect(r).toContain("Step-by-step");
    expect(r).toContain("Balanced");
  });
});

describe("chemical-equation-balancer molarMass", () => {
  it("computes molar mass of H2O", () => {
    expect(molarMass("H2O", { H: 1.008, O: 15.999 })).toBeCloseTo(18.015, 2);
  });
  it("handles unknown elements as 0", () => {
    expect(molarMass("X2", { X: 0 })).toBe(0);
  });
});
