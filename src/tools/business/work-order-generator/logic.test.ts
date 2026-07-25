import { describe, it, expect } from "vitest";
import {
  lineTotal,
  sumItems,
  computeDiscount,
  validateItem,
  computeWorkOrder,
  formatMoney,
  renderWorkOrder,
  toCsv,
  computeBatch,
  batchStats,
  batchToCsv,
  parseBatchInput,
  type LineItem,
  type WorkOrderInput,
} from "./logic";

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

describe("computeDiscount", () => {
  it("computes percent discount", () => {
    const r = computeDiscount(100, { type: "percent", value: 20 });
    if ("error" in r) throw new Error("err");
    expect(r.amount).toBe(20);
  });
  it("computes fixed discount", () => {
    const r = computeDiscount(100, { type: "fixed", value: 15 });
    if ("error" in r) throw new Error("err");
    expect(r.amount).toBe(15);
  });
  it("clamps fixed discount to subtotal", () => {
    const r = computeDiscount(30, { type: "fixed", value: 50 });
    if ("error" in r) throw new Error("err");
    expect(r.amount).toBe(30);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on negative discount", () => {
    expect("error" in computeDiscount(100, { type: "percent", value: -5 })).toBe(true);
  });
  it("errors on percent > 100", () => {
    expect("error" in computeDiscount(100, { type: "percent", value: 150 })).toBe(true);
  });
  it("returns 0 when no discount given", () => {
    const r = computeDiscount(100);
    if ("error" in r) throw new Error("err");
    expect(r.amount).toBe(0);
  });
});

describe("validateItem", () => {
  it("accepts a valid item", () => {
    expect(validateItem({ description: "X", quantity: 1, unitPrice: 1 })).toEqual({ ok: true });
  });
  it("rejects negative quantity", () => {
    expect("error" in validateItem({ description: "X", quantity: -1, unitPrice: 1 })).toBe(true);
  });
  it("rejects negative unit price", () => {
    expect("error" in validateItem({ description: "X", quantity: 1, unitPrice: -1 })).toBe(true);
  });
  it("rejects empty description", () => {
    expect("error" in validateItem({ description: " ", quantity: 1, unitPrice: 1 })).toBe(true);
  });
});

describe("computeWorkOrder", () => {
  const input: WorkOrderInput = {
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
  it("errors on missing work order number", () => {
    expect(computeWorkOrder({ ...input, workOrderNumber: " " })).toHaveProperty("error");
  });
  it("errors on missing customer", () => {
    expect(computeWorkOrder({ ...input, customer: " " })).toHaveProperty("error");
  });
  it("applies percent discount before tax", () => {
    const r = computeWorkOrder({ ...input, discount: { type: "percent", value: 10 } });
    if ("error" in r) throw new Error("err");
    // 200 - 20 = 180, tax 18, total 198
    expect(r.discountAmount).toBe(20);
    expect(r.taxableBase).toBe(180);
    expect(r.tax).toBe(18);
    expect(r.total).toBe(198);
  });
  it("applies fixed discount before tax", () => {
    const r = computeWorkOrder({ ...input, discount: { type: "fixed", value: 50 } });
    if ("error" in r) throw new Error("err");
    expect(r.discountAmount).toBe(50);
    expect(r.taxableBase).toBe(150);
    expect(r.tax).toBe(15);
    expect(r.total).toBe(165);
  });
  it("includes labor and materials counts", () => {
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("err");
    expect(r.laborCount).toBe(1);
    expect(r.materialsCount).toBe(1);
  });
});

describe("formatMoney", () => {
  it("formats with $", () => {
    expect(formatMoney(12.5)).toBe("$12.50");
  });
  it("formats negative amounts", () => {
    expect(formatMoney(-5)).toBe("$-5.00");
  });
});

describe("renderWorkOrder", () => {
  it("includes work order info", () => {
    const input: WorkOrderInput = { workOrderNumber: "WO-1", customer: "Acme", labor: [{ description: "Repair", quantity: 2, unitPrice: 50 }], materials: [{ description: "Part", quantity: 1, unitPrice: 100 }], taxRate: 10 };
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("should not error");
    const text = renderWorkOrder(input, r);
    expect(text).toContain("WORK ORDER #WO-1");
    expect(text).toContain("Customer: Acme");
    expect(text).toContain("Repair");
    expect(text).toContain("TOTAL:");
  });
  it("shows (none) for empty sections", () => {
    const input: WorkOrderInput = { workOrderNumber: "WO-2", customer: "Acme", labor: [], materials: [], taxRate: 0 };
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("err");
    const text = renderWorkOrder(input, r);
    expect(text).toContain("(none)");
  });
  it("includes discount line when discount is present", () => {
    const input: WorkOrderInput = { workOrderNumber: "WO-3", customer: "Acme", labor: [{ description: "X", quantity: 1, unitPrice: 100 }], materials: [], taxRate: 0, discount: { type: "percent", value: 10 } };
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("err");
    const text = renderWorkOrder(input, r);
    expect(text).toContain("Discount (10%):");
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const input: WorkOrderInput = { workOrderNumber: "WO-1", customer: "Acme", labor: [{ description: "Repair", quantity: 2, unitPrice: 50 }], materials: [{ description: "Part", quantity: 1, unitPrice: 100 }], taxRate: 10 };
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("err");
    const csv = toCsv(input, r);
    expect(csv.split("\n")[0]).toBe("Kind,Description,Quantity,UnitPrice,LineTotal");
    expect(csv).toContain("Labor");
    expect(csv).toContain("Material");
    expect(csv).toContain("TOTAL");
  });
  it("escapes quotes in descriptions", () => {
    const input: WorkOrderInput = { workOrderNumber: "WO-1", customer: "Acme", labor: [{ description: 'has "quote"', quantity: 1, unitPrice: 10 }], materials: [], taxRate: 0 };
    const r = computeWorkOrder(input);
    if ("error" in r) throw new Error("err");
    const csv = toCsv(input, r);
    expect(csv).toContain('""quote""');
  });
});

describe("computeBatch", () => {
  it("computes multiple work orders", () => {
    const inputs: WorkOrderInput[] = [
      { workOrderNumber: "WO-1", customer: "A", labor: [{ description: "L", quantity: 1, unitPrice: 10 }], materials: [], taxRate: 0 },
      { workOrderNumber: "WO-2", customer: "B", labor: [], materials: [{ description: "M", quantity: 2, unitPrice: 20 }], taxRate: 5 },
    ];
    const r = computeBatch(inputs);
    expect(r).toHaveLength(2);
    expect("error" in r[0]!.result).toBe(false);
    expect("error" in r[1]!.result).toBe(false);
  });
  it("preserves errors in batch results", () => {
    const inputs: WorkOrderInput[] = [
      { workOrderNumber: " ", customer: "A", labor: [], materials: [], taxRate: 0 },
    ];
    const r = computeBatch(inputs);
    expect("error" in r[0]!.result).toBe(true);
  });
});

describe("batchStats", () => {
  it("aggregates batch metrics", () => {
    const inputs: WorkOrderInput[] = [
      { workOrderNumber: "WO-1", customer: "A", labor: [{ description: "L", quantity: 1, unitPrice: 100 }], materials: [], taxRate: 10 },
      { workOrderNumber: "WO-2", customer: "B", labor: [], materials: [{ description: "M", quantity: 1, unitPrice: 200 }], taxRate: 0 },
    ];
    const stats = batchStats(computeBatch(inputs));
    expect(stats.total).toBe(2);
    expect(stats.valid).toBe(2);
    expect(stats.errors).toBe(0);
    expect(stats.grandTotal).toBe(310); // 110 + 200
    expect(stats.totalLabor).toBe(100);
    expect(stats.totalMaterials).toBe(200);
    expect(stats.totalTax).toBe(10);
  });
  it("counts errors", () => {
    const inputs: WorkOrderInput[] = [
      { workOrderNumber: "WO-1", customer: "A", labor: [], materials: [], taxRate: 0 },
      { workOrderNumber: " ", customer: "B", labor: [], materials: [], taxRate: 0 },
    ];
    const stats = batchStats(computeBatch(inputs));
    expect(stats.errors).toBe(1);
    expect(stats.valid).toBe(1);
  });
  it("returns zeros for empty batch", () => {
    const stats = batchStats([]);
    expect(stats.total).toBe(0);
    expect(stats.grandTotal).toBe(0);
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const inputs: WorkOrderInput[] = [
      { workOrderNumber: "WO-1", customer: "A", labor: [{ description: "L", quantity: 1, unitPrice: 10 }], materials: [], taxRate: 0 },
    ];
    const csv = batchToCsv(computeBatch(inputs));
    expect(csv.split("\n")[0]).toBe("WorkOrderNumber,Customer,Labor,Materials,Subtotal,Tax,Total,Error");
    expect(csv).toContain("WO-1");
    expect(csv).toContain("Acme".length ? "A" : "B");
  });
  it("includes error column for invalid rows", () => {
    const inputs: WorkOrderInput[] = [
      { workOrderNumber: " ", customer: "X", labor: [], materials: [], taxRate: 0 },
    ];
    const csv = batchToCsv(computeBatch(inputs));
    expect(csv).toContain("required");
  });
});

describe("parseBatchInput", () => {
  it("parses comma-separated number and customer", () => {
    const parsed = parseBatchInput("WO-1, Acme Corp\nWO-2, Globex");
    expect(parsed).toHaveLength(2);
    expect(parsed[0]!.numbers[0]).toBe("WO-1");
    expect(parsed[0]!.customers[0]).toBe("Acme Corp");
  });
  it("skips empty lines", () => {
    expect(parseBatchInput("\nWO-1, Acme\n  \n")).toHaveLength(1);
  });
});
