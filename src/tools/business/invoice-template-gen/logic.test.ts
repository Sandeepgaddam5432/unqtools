import { describe, it, expect } from "vitest";
import {
  createInvoice,
  addItem,
  removeItem,
  updateItem,
  lineTotal,
  subtotal,
  taxableSubtotal,
  discountAmount,
  taxAmount,
  total,
  amountDue,
  isOverdue,
  formatCurrency,
  exportInvoiceCSV,
  exportInvoiceText,
  validateInvoice,
  daysUntilDue,
  lateFee,
  invoiceStats,
  applyFlatDiscount,
  markPaid,
  nextInvoiceNumber,
  type Invoice,
  type InvoiceParty,
} from "./logic";

const issuer: InvoiceParty = { name: "Acme Co", email: "billing@acme.co", address: "1 Main St" };
const client: InvoiceParty = { name: "Client Inc", email: "ap@client.com", address: "2 Market St" };

function buildInvoice(): Invoice {
  let inv = createInvoice(issuer, client, "INV-001");
  inv = addItem(inv, "Consulting", 10, 100);
  inv = addItem(inv, "Licence", 1, 500);
  return inv;
}

describe("invoice-template-gen createInvoice", () => {
  it("creates an invoice with defaults", () => {
    const inv = createInvoice(issuer, client);
    expect(inv.items).toEqual([]);
    expect(inv.currency).toBe("USD");
    expect(inv.taxMode).toBe("flat");
  });
  it("sets due date 14 days after issued", () => {
    const inv = createInvoice(issuer, client);
    const diffDays = (inv.dueAt - inv.issuedAt) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(14, 0);
  });
});

describe("invoice-template-gen addItem / removeItem / updateItem", () => {
  it("adds an item", () => {
    const inv = buildInvoice();
    expect(inv.items.length).toBe(2);
  });
  it("removes an item by id", () => {
    const inv = buildInvoice();
    const id = inv.items[0].id;
    expect(removeItem(inv, id).items.length).toBe(1);
  });
  it("updates an item by id", () => {
    const inv = buildInvoice();
    const id = inv.items[0].id;
    expect(updateItem(inv, id, { quantity: 5 }).items[0].quantity).toBe(5);
  });
  it("clamps negative quantity/price to 0", () => {
    let inv = createInvoice(issuer, client);
    inv = addItem(inv, "X", -5, -10);
    expect(inv.items[0].quantity).toBe(0);
    expect(inv.items[0].unitPrice).toBe(0);
  });
});

describe("invoice-template-gen lineTotal", () => {
  it("multiplies quantity × unitPrice", () => {
    const inv = buildInvoice();
    expect(lineTotal(inv.items[0])).toBe(1000);
  });
});

describe("invoice-template-gen subtotal / taxableSubtotal", () => {
  it("sums all line totals", () => {
    const inv = buildInvoice();
    expect(subtotal(inv)).toBe(1500);
  });
  it("taxableSubtotal only includes taxable items", () => {
    let inv = buildInvoice();
    inv = addItem(inv, "Gift card", 1, 50, false);
    expect(taxableSubtotal(inv)).toBe(1500);
  });
});

describe("invoice-template-gen discountAmount", () => {
  it("computes discount on subtotal", () => {
    let inv = buildInvoice();
    inv = { ...inv, discountRate: 0.1 };
    expect(discountAmount(inv)).toBe(150);
  });
});

describe("invoice-template-gen taxAmount", () => {
  it("returns 0 when taxMode is none", () => {
    const inv = { ...buildInvoice(), taxMode: "none" as const };
    expect(taxAmount(inv)).toBe(0);
  });
  it("computes flat tax on taxable subtotal", () => {
    const inv = { ...buildInvoice(), flatTaxRate: 0.1 };
    expect(taxAmount(inv)).toBe(150);
  });
  it("computes bracket tax progressively", () => {
    const inv = {
      ...buildInvoice(),
      taxMode: "bracket" as const,
      brackets: [
        { upTo: 1000, rate: 0.05 },
        { upTo: 5000, rate: 0.1 },
      ],
    };
    // First 1000 at 5% = 50; next 500 at 10% = 50. Total = 100
    expect(taxAmount(inv)).toBeCloseTo(100, 1);
  });
});

describe("invoice-template-gen total / amountDue", () => {
  it("computes total = subtotal - discount + tax", () => {
    const inv = { ...buildInvoice(), flatTaxRate: 0.1, discountRate: 0.1 };
    // 1500 - 150 + 135 = 1485
    expect(total(inv)).toBeCloseTo(1485, 1);
  });
  it("amountDue is 0 when paid", () => {
    const inv = { ...buildInvoice(), status: "paid" as const };
    expect(amountDue(inv)).toBe(0);
  });
});

describe("invoice-template-gen isOverdue", () => {
  it("returns true when past due and unpaid", () => {
    const inv = { ...buildInvoice(), dueAt: Date.now() - 86400000 };
    expect(isOverdue(inv)).toBe(true);
  });
  it("returns false when paid", () => {
    const inv = { ...buildInvoice(), status: "paid" as const, dueAt: Date.now() - 86400000 };
    expect(isOverdue(inv)).toBe(false);
  });
});

describe("invoice-template-gen formatCurrency", () => {
  it("formats USD", () => {
    expect(formatCurrency(1234.5, "USD")).toMatch(/\$/);
  });
  it("falls back to plain string for unknown currency", () => {
    expect(formatCurrency(100, "XYZ")).toContain("XYZ");
  });
});

describe("invoice-template-gen exportInvoiceCSV", () => {
  it("has header plus rows + summary", () => {
    const csv = exportInvoiceCSV(buildInvoice());
    const lines = csv.split("\n");
    // 1 header + 2 items + 4 summary = 7
    expect(lines.length).toBe(7);
    expect(lines[0]).toContain("description,quantity");
  });
});

describe("invoice-template-gen exportInvoiceText", () => {
  it("includes invoice number and totals", () => {
    const txt = exportInvoiceText(buildInvoice());
    expect(txt).toContain("INV-001");
    expect(txt).toContain("Subtotal:");
    expect(txt).toContain("TOTAL:");
  });
});

describe("invoice-template-gen validateInvoice", () => {
  it("warns when no items", () => {
    expect(validateInvoice(createInvoice(issuer, client)).some((w) => w.includes("no line items"))).toBe(true);
  });
  it("warns when due before issued", () => {
    const inv = { ...buildInvoice(), dueAt: Date.now() - 100000, issuedAt: Date.now() };
    expect(validateInvoice(inv).some((w) => w.includes("Due date"))).toBe(true);
  });
  it("warns on invalid flat tax rate", () => {
    const inv = { ...buildInvoice(), flatTaxRate: 1.5 };
    expect(validateInvoice(inv).some((w) => w.includes("Flat tax"))).toBe(true);
  });
  it("passes for valid invoice", () => {
    expect(validateInvoice(buildInvoice())).toEqual([]);
  });
});

describe("invoice-template-gen daysUntilDue", () => {
  it("returns positive number before due date", () => {
    const inv = { ...buildInvoice(), dueAt: Date.now() + 5 * 86400000 };
    expect(daysUntilDue(inv)).toBeGreaterThan(0);
  });
});

describe("invoice-template-gen lateFee", () => {
  it("returns 0 when not overdue", () => {
    const inv = { ...buildInvoice(), dueAt: Date.now() + 86400000 };
    expect(lateFee(inv)).toBe(0);
  });
  it("returns positive fee when overdue", () => {
    const inv = { ...buildInvoice(), dueAt: Date.now() - 30 * 86400000 };
    expect(lateFee(inv)).toBeGreaterThan(0);
  });
});

describe("invoice-template-gen invoiceStats", () => {
  it("computes item count and total quantity", () => {
    const s = invoiceStats(buildInvoice());
    expect(s.itemCount).toBe(2);
    expect(s.totalQuantity).toBe(11);
  });
});

describe("invoice-template-gen applyFlatDiscount", () => {
  it("converts flat amount to percentage rate", () => {
    const inv = applyFlatDiscount(buildInvoice(), 150); // 10% of 1500
    expect(inv.discountRate).toBeCloseTo(0.1, 3);
  });
});

describe("invoice-template-gen markPaid", () => {
  it("sets status to paid", () => {
    expect(markPaid(buildInvoice()).status).toBe("paid");
  });
});

describe("invoice-template-gen nextInvoiceNumber", () => {
  it("increments numeric suffix", () => {
    expect(nextInvoiceNumber("INV-001")).toBe("INV-002");
  });
  it("appends -1 when no number found", () => {
    expect(nextInvoiceNumber("INV")).toBe("INV-1");
  });
});
