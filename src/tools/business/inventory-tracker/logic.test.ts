/**
 * Inventory Tracker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { valueItem, valueInventory, toCsv, type Item } from "./logic";

const item: Item = {
  id: "1",
  name: "Widget",
  sku: "W-001",
  reorderPoint: 20,
  soldQty: 30,
  purchases: [
    { qty: 10, unitCost: 5, date: "2024-01-01" },
    { qty: 20, unitCost: 7, date: "2024-02-01" },
    { qty: 15, unitCost: 6, date: "2024-03-01" },
  ],
};

describe("inventory valueItem FIFO", () => {
  it("computes on-hand quantity correctly", () => {
    const v = valueItem(item, "FIFO");
    expect(v.totalPurchased).toBe(45);
    expect(v.onHand).toBe(15);
  });
  it("FIFO consumes oldest layers first for COGS", () => {
    const v = valueItem(item, "FIFO");
    // 30 sold: 10@5 + 20@7 = 50 + 140 = 190
    expect(v.cogs).toBe(190);
  });
  it("FIFO on-hand value uses newest layer", () => {
    const v = valueItem(item, "FIFO");
    // 15 left, all from the latest layer @6 = 90
    expect(v.inventoryValue).toBe(90);
  });
  it("flags reorder when on-hand <= reorderPoint", () => {
    const v = valueItem(item, "FIFO");
    expect(v.needsReorder).toBe(true);
  });
});

describe("inventory valueItem LIFO", () => {
  it("LIFO consumes newest layers first for COGS", () => {
    const v = valueItem(item, "LIFO");
    // 30 sold: 15@6 + 15@7 = 90 + 105 = 195
    expect(v.cogs).toBe(195);
  });
  it("LIFO on-hand value uses oldest layer", () => {
    const v = valueItem(item, "LIFO");
    // 15 left: 10@5 + 5@7 = 50 + 35 = 85
    expect(v.inventoryValue).toBe(85);
  });
});

describe("inventory valueItem AVG", () => {
  it("AVG uses weighted average cost", () => {
    const v = valueItem(item, "AVG");
    // total cost = 50 + 140 + 90 = 280; total qty = 45; avg = 280/45
    const avg = 280 / 45;
    expect(v.unitCost).toBeCloseTo(avg, 2);
    expect(v.inventoryValue).toBeCloseTo(avg * 15, 2);
    expect(v.cogs).toBeCloseTo(avg * 30, 2);
  });
});

describe("inventory valueInventory aggregates", () => {
  it("sums totals across items", () => {
    const items = [item, { ...item, id: "2", soldQty: 0 }];
    const r = valueInventory(items, "FIFO");
    expect(r.items.length).toBe(2);
    expect(r.totalOnHand).toBe(15 + 45);
    expect(r.reorderCount).toBe(1);
  });
  it("rounds total value to 2 decimals", () => {
    const r = valueInventory([item], "FIFO");
    expect(Number.isInteger(r.totalValue * 100)).toBe(true);
  });
});

describe("inventory toCsv", () => {
  it("generates CSV with header", () => {
    const r = valueInventory([item], "FIFO");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("id,name,sku");
    expect(csv).toContain("Widget");
  });
  it("escapes names containing commas", () => {
    const r = valueInventory([{ ...item, name: "Widget, Pro" }], "FIFO");
    const csv = toCsv(r);
    expect(csv).toContain('"Widget, Pro"');
  });
});
