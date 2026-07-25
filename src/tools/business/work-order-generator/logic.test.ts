import { describe, it, expect } from "vitest";
import { lineTotal, sumItems, computeWorkOrder, formatMoney, renderWorkOrder, type LineItem } from "./logic";

describe("lineTotal", () => {
  it("computes quantity × price", () => {
    expect(lineTotal({ description: "X", quantity: 3, unitPrice: 10 })).toBe(30);
  });
});

describe("sumItems", () => {
  it("sums line totals", () => {
    const items: LineItem[] = [
      { description: "A", quantity: 2, unitPrice: 5 },
      { description: "B", quantity: 1, unitPrice: 10 },
    ];
    expect(sumItems(items)).toBe(20);
  });
  it("returns 0 for empty", () => {
    expect(sumItems([])).toBe(0);
  });
});

describe("computeWorkOrder", () => {
  const input = {
    workOrderNumber: "WO-1",
    customer: "Acme",
    labor: [{ description: "Repair", quantity: 2, unitPrice: 50 }],
    materials: [{ description: "Part", quantity: 1, unitPrice: 100 }],
    taxRate: 10,
  };
  it("computes totals", () => {
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("should not error");
    expect(r.laborSubtotal).toBe(100);
    expect(r.materialsSubtotal).toBe(100);
    expect(r.subtotal).toBe(200);
    expect(r.tax).toBe(20);
    expect(r.total).toBe(220);
  });
  it("errors on negative tax rate", () => {
    expect(computeWorkOrder({ ...input, taxRate: -1 })).toHaveProperty("error");
  });
  it("errors on negative quantity", () => {
    expect(computeWorkOrder({ ...input, labor: [{ description: "X", quantity: -1, unitPrice: 5 }] })).toHaveProperty("error");
  });
  it("errors on out-of-range tax", () => {
    expect(computeWorkOrder({ ...input, taxRate: 200 })).toHaveProperty("error");
  });
});

describe("formatMoney", () => {
  it("formats with $", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
  });
});

describe("renderWorkOrder", () => {
  it("includes work order info", () => {
    const input = { workOrderNumber: "WO-1", customer: "Acme", labor: [{ description: "Repair", quantity: 2, unitPrice: 50 }], materials: [{ description: "Part", quantity: 1, unitPrice: 100 }], taxRate: 10 };
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("should not error");
    const text = renderWorkOrder(input, r);
    expect(text).toContain("WORK ORDER #WO-1");
    expect(text).toContain("Customer: Acme");
    expect(text).toContain("Repair");
    expect(text).toContain("TOTAL:");
  });
});
