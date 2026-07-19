import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCY_PRESETS,
  TAX_PRESETS,
  DUE_DATE_PRESETS,
  parseLineItems,
  splitCsvRow,
  applyDiscount,
  calculateTax,
  computeTotals,
  computeGrandTotal,
  formatCurrency,
  suggestInvoiceNumber,
  calculateDueDate,
  renderText,
  renderCsv,
  renderHtml,
  generatePdf,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  summaryStats,
  type InvoiceInput,
  type CurrencySymbol,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

function sampleInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    fromName: "Acme LLC",
    fromEmail: "billing@acme.com",
    fromAddress: "123 Main St\nAnytown, US 12345",
    toName: "Client Co",
    toEmail: "ap@client.com",
    toAddress: "456 Oak Ave\nBigcity, US 67890",
    invoiceNumber: "INV-2026-001",
    invoiceDate: "2026-01-15",
    dueDate: "2026-02-14",
    lineItemsText: "Web design,10,75.00\nHosting,1,120.00\nSupport,5,60.00",
    taxRate: 8.5,
    discountPercent: 10,
    currencySymbol: "$",
    notes: "Thanks for your business!",
    ...overrides,
  };
}

describe("invoice-generator constants", () => {
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS).toContain("$");
    expect(CURRENCY_PRESETS).toContain("₹");
    expect(CURRENCY_PRESETS).toContain("A$");
    expect(CURRENCY_PRESETS).toContain("C$");
  });
  it("has 7 tax presets including common rates", () => {
    expect(TAX_PRESETS).toHaveLength(7);
    expect(TAX_PRESETS).toContain(0);
    expect(TAX_PRESETS).toContain(8.5);
    expect(TAX_PRESETS).toContain(18);
    expect(TAX_PRESETS).toContain(25);
  });
  it("has 3 due-date presets (Net 15/30/60)", () => {
    expect(DUE_DATE_PRESETS).toHaveLength(3);
    expect(DUE_DATE_PRESETS.map((p) => p.days)).toEqual([15, 30, 60]);
  });
});

describe("invoice-generator parseLineItems", () => {
  it("parses valid CSV lines", () => {
    const { items, errors } = parseLineItems("Web design,10,75.00\nHosting,1,120.00");
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(items[0]).toEqual({ description: "Web design", qty: 10, unitPrice: 75, total: 750 });
    expect(items[1]).toEqual({ description: "Hosting", qty: 1, unitPrice: 120, total: 120 });
  });
  it("skips blank lines", () => {
    const { items } = parseLineItems("A,1,10\n\n\nB,2,5");
    expect(items).toHaveLength(2);
  });
  it("parses quoted descriptions with commas", () => {
    const { items } = parseLineItems('"Widget, premium",3,12.50');
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("Widget, premium");
    expect(items[0].total).toBe(37.5);
  });
  it("rejects invalid qty", () => {
    const { errors } = parseLineItems("Bad,abc,10.00");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid qty");
  });
  it("rejects negative unit price", () => {
    const { errors } = parseLineItems("Bad,1,-5");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid unit_price");
  });
  it("errors on too few fields", () => {
    const { errors } = parseLineItems("Only one field");
    expect(errors[0]).toContain("needs description");
  });
  it("returns empty for empty input", () => {
    expect(parseLineItems("").items).toEqual([]);
    expect(parseLineItems("   \n  ").items).toEqual([]);
  });
});

describe("invoice-generator splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("invoice-generator applyDiscount", () => {
  it("applies 10% discount", () => {
    expect(applyDiscount(100, 10)).toBe(90);
  });
  it("returns original when discount <= 0", () => {
    expect(applyDiscount(100, 0)).toBe(100);
    expect(applyDiscount(100, -5)).toBe(100);
  });
  it("returns 0 when discount >= 100", () => {
    expect(applyDiscount(100, 100)).toBe(0);
    expect(applyDiscount(100, 150)).toBe(0);
  });
});

describe("invoice-generator calculateTax", () => {
  it("calculates 8.5% tax", () => {
    expect(calculateTax(100, 8.5)).toBe(8.5);
  });
  it("returns 0 for non-positive rate", () => {
    expect(calculateTax(100, 0)).toBe(0);
    expect(calculateTax(100, -2)).toBe(0);
  });
});

describe("invoice-generator computeTotals", () => {
  it("computes all totals correctly", () => {
    const items = parseLineItems("A,10,10\nB,2,50").items;
    const t = computeTotals(items, 10, 10);
    expect(t.subtotal).toBe(200);
    expect(t.discountAmount).toBe(20);
    expect(t.discountedSubtotal).toBe(180);
    expect(t.taxAmount).toBe(18);
    expect(t.total).toBe(198);
    expect(t.itemCount).toBe(2);
    expect(t.totalQty).toBe(12);
  });
  it("handles empty items", () => {
    const t = computeTotals([], 10, 10);
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
    expect(t.itemCount).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    const items = parseLineItems("A,3,33.33").items;
    const t = computeTotals(items, 0, 0);
    expect(t.subtotal).toBe(99.99);
  });
});

describe("invoice-generator computeGrandTotal", () => {
  it("parses and computes from raw input", () => {
    const input = sampleInput();
    const t = computeGrandTotal(input);
    // subtotal = 750 + 120 + 300 = 1170
    expect(t.subtotal).toBe(1170);
    // discount 10% → 117, discounted = 1053
    expect(t.discountAmount).toBe(117);
    expect(t.discountedSubtotal).toBe(1053);
    // tax 8.5% of 1053 = 89.505 → 89.51 (rounded)
    expect(t.taxAmount).toBe(89.51);
    // total = 1053 + 89.51 = 1142.51
    expect(t.total).toBe(1142.51);
    expect(t.itemCount).toBe(3);
  });
});

describe("invoice-generator formatCurrency", () => {
  it("formats positive number", () => {
    expect(formatCurrency(1234.5, "$")).toBe("$1234.50");
  });
  it("formats negative number", () => {
    expect(formatCurrency(-50, "€")).toBe("-€50.00");
  });
  it("supports multi-char symbols", () => {
    expect(formatCurrency(100, "A$")).toBe("A$100.00");
  });
});

describe("invoice-generator suggestInvoiceNumber", () => {
  it("suggests with year and padded sequence", () => {
    expect(suggestInvoiceNumber("2026-05-10", 1)).toBe("INV-2026-001");
    expect(suggestInvoiceNumber("2026-05-10", 42)).toBe("INV-2026-042");
  });
  it("falls back to current year when date empty", () => {
    const result = suggestInvoiceNumber("");
    expect(result.startsWith("INV-")).toBe(true);
  });
  it("clamps sequence below 1", () => {
    expect(suggestInvoiceNumber("2026-01-01", 0)).toBe("INV-2026-001");
    expect(suggestInvoiceNumber("2026-01-01", -3)).toBe("INV-2026-001");
  });
});

describe("invoice-generator calculateDueDate", () => {
  it("adds days correctly", () => {
    expect(calculateDueDate("2026-01-15", 30)).toBe("2026-02-14");
  });
  it("Net 15", () => {
    expect(calculateDueDate("2026-01-01", 15)).toBe("2026-01-16");
  });
  it("Net 60 across months", () => {
    expect(calculateDueDate("2026-01-01", 60)).toBe("2026-03-02");
  });
  it("returns empty for invalid date", () => {
    expect(calculateDueDate("", 30)).toBe("");
    expect(calculateDueDate("not-a-date", 30)).toBe("");
  });
});

describe("invoice-generator renderText", () => {
  it("renders text with key fields", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const text = renderText(input, totals);
    expect(text).toContain("INVOICE");
    expect(text).toContain("INV-2026-001");
    expect(text).toContain("Acme LLC");
    expect(text).toContain("Client Co");
    expect(text).toContain("Web design");
    expect(text).toContain("Subtotal:");
    expect(text).toContain("TOTAL DUE:");
    expect(text).toContain("Notes:");
  });
});

describe("invoice-generator renderCsv", () => {
  it("renders header + rows + totals", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain("description,qty,unit_price,line_total");
    expect(csv).toContain("Web design,10,75.00,750.00");
    expect(csv).toContain("invoice_number,INV-2026-001");
    expect(csv).toContain(`total,${totals.total.toFixed(2)}`);
  });
  it("escapes commas in descriptions", () => {
    const input = sampleInput({ lineItemsText: '"Widget, premium",3,12.50' });
    const totals = computeGrandTotal(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain('"Widget, premium"');
  });
});

describe("invoice-generator renderHtml", () => {
  it("renders HTML with invoice data", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const html = renderHtml(input, totals);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("INVOICE");
    expect(html).toContain("INV-2026-001");
    expect(html).toContain("Acme LLC");
    expect(html).toContain("Total Due");
    expect(html).toContain("Web design");
  });
  it("escapes HTML special chars", () => {
    const input = sampleInput({ fromName: "Acme <script>" });
    const totals = computeGrandTotal(input);
    const html = renderHtml(input, totals);
    expect(html).toContain("Acme &lt;script&gt;");
    expect(html).not.toContain("<script>Acme");
  });
});

describe("invoice-generator generatePdf", () => {
  it("generates non-empty PDF bytes", async () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const bytes = await generatePdf(input, totals);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // PDF magic header
    expect(bytes[0]).toBe(0x25); // %
    expect(bytes[1]).toBe(0x50); // P
    expect(bytes[2]).toBe(0x44); // D
    expect(bytes[3]).toBe(0x46); // F
  });
  it("generates PDF even with empty items", async () => {
    const input = sampleInput({ lineItemsText: "" });
    const totals = computeGrandTotal(input);
    const bytes = await generatePdf(input, totals);
    expect(bytes.length).toBeGreaterThan(500);
  });
});

describe("invoice-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, invoiceNumber: "INV-1", total: 100, currencySymbol: "$", itemCount: 3 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].invoiceNumber).toBe("INV-1");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, invoiceNumber: `INV-${i}`, total: i, currencySymbol: "$", itemCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
    // Most recent first
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({ ts: 1, invoiceNumber: "INV-1", total: 100, currencySymbol: "$", itemCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("invoice-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ invoiceNumber: "INV-1", taxRate: 8.5 });
    expect(url).toContain("inv=INV-1");
    expect(url).toContain("tax=8.5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = sampleInput();
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.invoiceNumber).toBe("INV-2026-001");
    expect(parsed.fromName).toBe("Acme LLC");
    expect(parsed.lineItemsText).toContain("Web design");
    expect(parsed.taxRate).toBe(8.5);
    expect(parsed.discountPercent).toBe(10);
    expect(parsed.currencySymbol).toBe("$");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown currency", () => {
    const parsed = parseShareUrl("cur=ZZZ");
    expect(parsed.currencySymbol).toBeUndefined();
  });
  it("ignores non-numeric tax", () => {
    const parsed = parseShareUrl("tax=abc");
    expect(parsed.taxRate).toBeUndefined();
  });
});

describe("invoice-generator summaryStats", () => {
  it("computes summary stats", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const stats = summaryStats(totals);
    expect(stats.itemCount).toBe(3);
    expect(stats.totalQty).toBe(16); // 10 + 1 + 5
    expect(stats.subtotal).toBe(1170);
    expect(stats.total).toBe(1142.51);
    expect(stats.maxLineTotal).toBe(750); // Web design
    expect(stats.minLineTotal).toBe(120); // Hosting
    // avg = (750+120+300)/3 = 390
    expect(stats.avgLineTotal).toBe(390);
  });
  it("handles empty totals", () => {
    const t = computeTotals([], 0, 0);
    const stats = summaryStats(t);
    expect(stats.itemCount).toBe(0);
    expect(stats.avgLineTotal).toBe(0);
    expect(stats.maxLineTotal).toBe(0);
    expect(stats.minLineTotal).toBe(0);
  });
});

// Suppress unused-import lint
export type _Unused = CurrencySymbol;
