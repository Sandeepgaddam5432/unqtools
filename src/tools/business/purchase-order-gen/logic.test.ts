import { describe, it, expect } from "vitest";
import {
  createVendor,
  createPO,
  addItem,
  removeItem,
  updateItem,
  lineTotal,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  formatCurrency,
  validatePO,
  transitionStatus,
  exportPOCSV,
  exportPOText,
  poStats,
  groupByUOM,
  nextPONumber,
  daysUntilDelivery,
  isOverdue,
  bulkApprove,
  sortBySKU,
  type PurchaseOrder,
} from "./logic";

function buildPO(): PurchaseOrder {
  const v = createVendor("Acme Supplier", "sales@acme.com", "1 Industrial Way");
  let po = createPO(v, "PO-001");
  po = addItem(po, "SKU-1", "Widget", 10, 5);
  po = addItem(po, "SKU-2", "Gadget", 2, 50);
  return po;
}

describe("purchase-order-gen createVendor", () => {
  it("creates a vendor with name", () => {
    const v = createVendor("Acme");
    expect(v.name).toBe("Acme");
    expect(v.paymentTerms).toBe("Net 30");
  });
  it("defaults name when empty", () => {
    expect(createVendor("").name).toBe("Unknown vendor");
  });
});

describe("purchase-order-gen createPO", () => {
  it("creates PO with default currency USD", () => {
    const po = createPO(createVendor("V"));
    expect(po.currency).toBe("USD");
    expect(po.status).toBe("draft");
  });
  it("sets expected delivery 14 days out", () => {
    const po = createPO(createVendor("V"));
    const diffDays = (po.expectedDeliveryAt - po.createdAt) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(14, 0);
  });
});

describe("purchase-order-gen addItem / removeItem / updateItem", () => {
  it("adds an item", () => {
    expect(buildPO().items.length).toBe(2);
  });
  it("removes an item by id", () => {
    const po = buildPO();
    expect(removeItem(po, po.items[0].id).items.length).toBe(1);
  });
  it("updates an item by id", () => {
    const po = buildPO();
    const id = po.items[0].id;
    expect(updateItem(po, id, { quantity: 100 }).items[0].quantity).toBe(100);
  });
  it("clamps negatives to zero", () => {
    let po = createPO(createVendor("V"));
    po = addItem(po, "X", "Item", -5, -10);
    expect(po.items[0].quantity).toBe(0);
    expect(po.items[0].unitPrice).toBe(0);
  });
});

describe("purchase-order-gen lineTotal", () => {
  it("multiplies quantity × unit price", () => {
    const po = buildPO();
    expect(lineTotal(po.items[0])).toBe(50);
  });
});

describe("purchase-order-gen subtotal / discount / tax / total", () => {
  it("subtotals all line items", () => {
    expect(subtotal(buildPO())).toBe(150); // 50 + 100
  });
  it("applies discount on subtotal", () => {
    const po = { ...buildPO(), discountRate: 0.1 };
    expect(discountAmount(po)).toBe(15);
  });
  it("applies tax on discounted subtotal", () => {
    const po = { ...buildPO(), discountRate: 0.1, taxRate: 0.1 };
    expect(taxAmount(po)).toBeCloseTo(13.5, 2); // (150 - 15) * 0.1
  });
  it("total includes shipping", () => {
    const po = { ...buildPO(), shippingCost: 20, taxRate: 0.1 };
    // 150 + 15 (tax) + 20 (shipping) = 185
    expect(total(po)).toBeCloseTo(185, 1);
  });
});

describe("purchase-order-gen formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(100, "USD")).toMatch(/\$/);
  });
});

describe("purchase-order-gen validatePO", () => {
  it("warns when no items", () => {
    const po = createPO(createVendor("V"));
    expect(validatePO(po).some((w) => w.includes("no line items"))).toBe(true);
  });
  it("warns when tax rate out of range", () => {
    const po = { ...buildPO(), taxRate: 1.5 };
    expect(validatePO(po).some((w) => w.includes("Tax rate"))).toBe(true);
  });
  it("warns when approved without approver", () => {
    const po = { ...buildPO(), status: "approved" as const, approver: "" };
    expect(validatePO(po).some((w) => w.includes("approver"))).toBe(true);
  });
  it("passes for valid PO", () => {
    expect(validatePO(buildPO())).toEqual([]);
  });
});

describe("purchase-order-gen transitionStatus", () => {
  it("transitions draft → submitted", () => {
    const po = buildPO();
    expect(transitionStatus(po, "submitted").status).toBe("submitted");
  });
  it("transitions submitted → approved with approver", () => {
    let po = buildPO();
    po = transitionStatus(po, "submitted");
    po = transitionStatus(po, "approved", "John");
    expect(po.status).toBe("approved");
    expect(po.approver).toBe("John");
  });
  it("rejects invalid transition", () => {
    const po = buildPO(); // draft
    expect(transitionStatus(po, "approved").status).toBe("draft");
  });
});

describe("purchase-order-gen exportPOCSV", () => {
  it("has header plus rows + summary", () => {
    const csv = exportPOCSV(buildPO());
    const lines = csv.split("\n");
    // 1 header + 2 items + 5 summary = 8
    expect(lines.length).toBe(8);
    expect(lines[0]).toContain("sku,description");
  });
});

describe("purchase-order-gen exportPOText", () => {
  it("includes PO number and vendor name", () => {
    const txt = exportPOText(buildPO());
    expect(txt).toContain("PO-001");
    expect(txt).toContain("Acme Supplier");
  });
});

describe("purchase-order-gen poStats", () => {
  it("computes item count and total quantity", () => {
    const s = poStats(buildPO());
    expect(s.itemCount).toBe(2);
    expect(s.totalQuantity).toBe(12);
  });
  it("finds largest line by lineTotal", () => {
    const s = poStats(buildPO());
    expect(s.largestLine?.sku).toBe("SKU-2"); // 100 > 50
  });
  it("returns null largestLine for empty PO", () => {
    expect(poStats(createPO(createVendor("V"))).largestLine).toBeNull();
  });
});

describe("purchase-order-gen groupByUOM", () => {
  it("groups by unit of measure", () => {
    let po = buildPO();
    po = addItem(po, "SKU-3", "Bolt", 100, 0.1, "pcs");
    const g = groupByUOM(po);
    expect(g["ea"].length).toBe(2);
    expect(g["pcs"].length).toBe(1);
  });
});

describe("purchase-order-gen nextPONumber", () => {
  it("increments numeric suffix", () => {
    expect(nextPONumber("PO-001")).toBe("PO-002");
  });
  it("appends -1 when no number", () => {
    expect(nextPONumber("PO")).toBe("PO-1");
  });
});

describe("purchase-order-gen daysUntilDelivery", () => {
  it("returns positive before delivery date", () => {
    const po = { ...buildPO(), expectedDeliveryAt: Date.now() + 5 * 86400000 };
    expect(daysUntilDelivery(po)).toBeGreaterThan(0);
  });
});

describe("purchase-order-gen isOverdue", () => {
  it("returns true when past expected and not received", () => {
    const po = { ...buildPO(), expectedDeliveryAt: Date.now() - 86400000 };
    expect(isOverdue(po)).toBe(true);
  });
  it("returns false when received", () => {
    const po = { ...buildPO(), status: "received" as const, expectedDeliveryAt: Date.now() - 86400000 };
    expect(isOverdue(po)).toBe(false);
  });
});

describe("purchase-order-gen bulkApprove", () => {
  it("approves all submitted POs", () => {
    const po1 = { ...buildPO(), status: "submitted" as const };
    const po2 = { ...buildPO(), status: "draft" as const };
    const result = bulkApprove([po1, po2], "Alice");
    expect(result[0].status).toBe("approved");
    expect(result[1].status).toBe("draft");
  });
});

describe("purchase-order-gen sortBySKU", () => {
  it("sorts items by SKU alphabetically", () => {
    const po = buildPO();
    const sorted = sortBySKU(po);
    expect(sorted[0].sku).toBe("SKU-1");
    expect(sorted[1].sku).toBe("SKU-2");
  });
});
