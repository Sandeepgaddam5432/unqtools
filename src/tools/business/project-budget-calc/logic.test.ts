/**
 * Project Budget Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { computeBudget, toMarkdown, type BudgetInput } from "./logic";

const baseInput: BudgetInput = {
  labor: [{ role: "Engineer", hours: 100, rate: 50 }],
  materials: [{ name: "Server", qty: 2, unitCost: 1000 }],
  overheadPct: 10,
  contingencyPct: 5,
  taxPct: 7,
};

describe("budget computeBudget", () => {
  it("computes labor cost", () => {
    const r = computeBudget(baseInput);
    expect(r.laborCost).toBe(5000);
  });
  it("computes materials cost", () => {
    const r = computeBudget(baseInput);
    expect(r.materialsCost).toBe(2000);
  });
  it("computes materials tax", () => {
    const r = computeBudget(baseInput);
    expect(r.materialsTax).toBe(140);
  });
  it("computes subtotal = labor + materials + tax", () => {
    const r = computeBudget(baseInput);
    expect(r.subtotal).toBe(7140);
  });
  it("computes overhead as pct of subtotal", () => {
    const r = computeBudget(baseInput);
    expect(r.overhead).toBe(714);
  });
  it("computes contingency as pct of (subtotal + overhead)", () => {
    const r = computeBudget(baseInput);
    expect(r.contingency).toBe(Math.round((7140 + 714) * 0.05 * 100) / 100);
  });
  it("computes total", () => {
    const r = computeBudget(baseInput);
    expect(r.total).toBe(r.subtotal + r.overhead + r.contingency);
  });
  it("cost breakdown percentages sum to ~100", () => {
    const r = computeBudget(baseInput);
    const sum = r.costBreakdownPct.labor + r.costBreakdownPct.materials + r.costBreakdownPct.overhead + r.costBreakdownPct.contingency;
    expect(sum).toBeCloseTo(100, 0);
  });
  it("warns on negative inputs", () => {
    const r = computeBudget({ ...baseInput, labor: [{ role: "X", hours: -5, rate: 10 }] });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns when labor and materials are both zero", () => {
    const r = computeBudget({ ...baseInput, labor: [], materials: [] });
    expect(r.warnings.some((w) => w.includes("both zero"))).toBe(true);
  });
});

describe("budget toMarkdown", () => {
  it("produces markdown with total", () => {
    const r = computeBudget(baseInput);
    const md = toMarkdown(r);
    expect(md).toContain("# Project Budget");
    expect(md).toContain(`**$${r.total}**`);
  });
});
