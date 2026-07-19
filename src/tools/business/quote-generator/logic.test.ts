import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCY_PRESETS,
  VALIDITY_PRESETS,
  parseLineItems,
  splitCsvRow,
  applyDiscount,
  computeTotals,
  computeGrandTotal,
  formatCurrency,
  suggestQuoteNumber,
  calculateValidUntil,
  validityDays,
  quoteToInvoice,
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
  type QuoteInput,
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

function sampleInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    fromName: "Acme LLC",
    fromEmail: "sales@acme.com",
    fromAddress: "123 Main St\nAnytown, US 12345",
    toName: "Client Co",
    toEmail: "buyer@client.com",
    toAddress: "456 Oak Ave\nBigcity, US 67890",
    quoteNumber: "QUO-2026-001",
    quoteDate: "2026-01-15",
    validUntil: "2026-02-14",
    lineItemsText: "Web design,10,75.00\nHosting,1,120.00\nSupport,5,60.00",
    discountPercent: 10,
    currencySymbol: "$",
    termsAndConditions: "50% deposit due on acceptance. Balance due on completion.",
    notes: "Thank you for the opportunity!",
    ...overrides,
  };
}

describe("quote-generator constants", () => {
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS).toContain("£");
    expect(CURRENCY_PRESETS).toContain("¥");
    expect(CURRENCY_PRESETS).toContain("C$");
  });
  it("has 5 validity presets", () => {
    expect(VALIDITY_PRESETS).toHaveLength(5);
    expect(VALIDITY_PRESETS.map((p) => p.days)).toEqual([7, 14, 30, 60, 90]);
  });
});

describe("quote-generator parseLineItems", () => {
  it("parses valid CSV lines", () => {
    const { items, errors } = parseLineItems("Web design,10,75.00\nHosting,1,120.00");
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(items[0]).toEqual({ description: "Web design", qty: 10, unitPrice: 75, total: 750 });
  });
  it("skips blank lines", () => {
    const { items } = parseLineItems("A,1,10\n\nB,2,5");
    expect(items).toHaveLength(2);
  });
  it("parses quoted descriptions with commas", () => {
    const { items } = parseLineItems('"Widget, premium",3,12.50');
    expect(items[0].description).toBe("Widget, premium");
    expect(items[0].total).toBe(37.5);
  });
  it("rejects invalid qty", () => {
    const { errors } = parseLineItems("Bad,abc,10.00");
    expect(errors[0]).toContain("invalid qty");
  });
  it("rejects negative unit price", () => {
    const { errors } = parseLineItems("Bad,1,-5");
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

describe("quote-generator splitCsvRow", () => {
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

describe("quote-generator applyDiscount", () => {
  it("applies 10% discount", () => {
    expect(applyDiscount(100, 10)).toBe(90);
  });
  it("applies 25% discount", () => {
    expect(applyDiscount(200, 25)).toBe(150);
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

describe("quote-generator computeTotals", () => {
  it("computes totals correctly (no tax)", () => {
    const items = parseLineItems("A,10,10\nB,2,50").items;
    const t = computeTotals(items, 10);
    expect(t.subtotal).toBe(200);
    expect(t.discountAmount).toBe(20);
    expect(t.total).toBe(180);
    expect(t.itemCount).toBe(2);
    expect(t.totalQty).toBe(12);
  });
  it("handles empty items", () => {
    const t = computeTotals([], 10);
    expect(t.subtotal).toBe(0);
    expect(t.total).toBe(0);
    expect(t.itemCount).toBe(0);
  });
  it("handles zero discount", () => {
    const items = parseLineItems("A,1,100").items;
    const t = computeTotals(items, 0);
    expect(t.discountAmount).toBe(0);
    expect(t.total).toBe(100);
  });
});

describe("quote-generator computeGrandTotal", () => {
  it("parses and computes from raw input", () => {
    const input = sampleInput();
    const t = computeGrandTotal(input);
    // subtotal = 750 + 120 + 300 = 1170
    expect(t.subtotal).toBe(1170);
    // discount 10% → 117
    expect(t.discountAmount).toBe(117);
    // total = 1053 (no tax)
    expect(t.total).toBe(1053);
    expect(t.itemCount).toBe(3);
  });
});

describe("quote-generator formatCurrency", () => {
  it("formats positive number", () => {
    expect(formatCurrency(1234.5, "$")).toBe("$1234.50");
  });
  it("formats negative number", () => {
    expect(formatCurrency(-50, "€")).toBe("-€50.00");
  });
  it("supports multi-char symbols", () => {
    expect(formatCurrency(100, "C$")).toBe("C$100.00");
  });
});

describe("quote-generator suggestQuoteNumber", () => {
  it("suggests with year and padded sequence", () => {
    expect(suggestQuoteNumber("2026-05-10", 1)).toBe("QUO-2026-001");
    expect(suggestQuoteNumber("2026-05-10", 42)).toBe("QUO-2026-042");
  });
  it("falls back to current year when date empty", () => {
    const result = suggestQuoteNumber("");
    expect(result.startsWith("QUO-")).toBe(true);
  });
  it("clamps sequence below 1", () => {
    expect(suggestQuoteNumber("2026-01-01", 0)).toBe("QUO-2026-001");
    expect(suggestQuoteNumber("2026-01-01", -3)).toBe("QUO-2026-001");
  });
});

describe("quote-generator calculateValidUntil", () => {
  it("adds 30 days", () => {
    expect(calculateValidUntil("2026-01-15", 30)).toBe("2026-02-14");
  });
  it("adds 7 days", () => {
    expect(calculateValidUntil("2026-01-01", 7)).toBe("2026-01-08");
  });
  it("adds 90 days across months", () => {
    expect(calculateValidUntil("2026-01-01", 90)).toBe("2026-04-01");
  });
  it("returns empty for invalid date", () => {
    expect(calculateValidUntil("", 30)).toBe("");
    expect(calculateValidUntil("not-a-date", 30)).toBe("");
  });
});

describe("quote-generator validityDays", () => {
  it("calculates days between dates", () => {
    expect(validityDays("2026-01-01", "2026-01-31")).toBe(30);
  });
  it("returns negative when expired", () => {
    expect(validityDays("2026-01-31", "2026-01-01")).toBe(-30);
  });
  it("returns null for missing input", () => {
    expect(validityDays("", "2026-01-01")).toBeNull();
    expect(validityDays("2026-01-01", "")).toBeNull();
  });
  it("returns null for invalid dates", () => {
    expect(validityDays("foo", "bar")).toBeNull();
  });
});

describe("quote-generator quoteToInvoice", () => {
  it("converts quote to invoice payload", () => {
    const input = sampleInput();
    const payload = quoteToInvoice(input);
    expect(payload.invoiceNumber).toBe("INV-2026-001");
    expect(payload.invoiceDate).toBe("2026-01-15");
    // default Net 30
    expect(payload.dueDate).toBe("2026-02-14");
    expect(payload.lineItemsText).toBe(input.lineItemsText);
    expect(payload.taxRate).toBe(0);
    expect(payload.discountPercent).toBe(10);
    expect(payload.currencySymbol).toBe("$");
    expect(payload.fromName).toBe("Acme LLC");
    expect(payload.toName).toBe("Client Co");
  });
  it("honors dueDays override", () => {
    const input = sampleInput();
    const payload = quoteToInvoice(input, { dueDays: 15 });
    expect(payload.dueDate).toBe("2026-01-30");
  });
  it("honors taxRate override", () => {
    const input = sampleInput();
    const payload = quoteToInvoice(input, { taxRate: 18 });
    expect(payload.taxRate).toBe(18);
  });
  it("handles quote number already starting with INV-", () => {
    const input = sampleInput({ quoteNumber: "INV-2026-005" });
    const payload = quoteToInvoice(input);
    expect(payload.invoiceNumber).toBe("INV-2026-005");
  });
});

describe("quote-generator renderText", () => {
  it("renders text with key fields", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const text = renderText(input, totals);
    expect(text).toContain("QUOTE / PROPOSAL");
    expect(text).toContain("QUO-2026-001");
    expect(text).toContain("Acme LLC");
    expect(text).toContain("Client Co");
    expect(text).toContain("Web design");
    expect(text).toContain("Subtotal:");
    expect(text).toContain("TOTAL:");
    expect(text).toContain("Terms & Conditions:");
    expect(text).toContain("Notes:");
    expect(text).toContain("30 days");
  });
});

describe("quote-generator renderCsv", () => {
  it("renders header + rows + totals", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain("description,qty,unit_price,line_total");
    expect(csv).toContain("Web design,10,75.00,750.00");
    expect(csv).toContain("quote_number,QUO-2026-001");
    expect(csv).toContain(`total,${totals.total.toFixed(2)}`);
  });
  it("escapes commas in descriptions", () => {
    const input = sampleInput({ lineItemsText: '"Widget, premium",3,12.50' });
    const totals = computeGrandTotal(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain('"Widget, premium"');
  });
});

describe("quote-generator renderHtml", () => {
  it("renders HTML with quote data", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const html = renderHtml(input, totals);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("QUOTE / PROPOSAL");
    expect(html).toContain("QUO-2026-001");
    expect(html).toContain("Acme LLC");
    expect(html).toContain("Total");
    expect(html).toContain("Terms &amp; Conditions");
  });
  it("escapes HTML special chars", () => {
    const input = sampleInput({ fromName: "Acme <script>" });
    const totals = computeGrandTotal(input);
    const html = renderHtml(input, totals);
    expect(html).toContain("Acme &lt;script&gt;");
    expect(html).not.toContain("<script>Acme");
  });
});

describe("quote-generator generatePdf", () => {
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

describe("quote-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, quoteNumber: "QUO-1", total: 100, currencySymbol: "$", itemCount: 3 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].quoteNumber).toBe("QUO-1");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, quoteNumber: `QUO-${i}`, total: i, currencySymbol: "$", itemCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({ ts: 1, quoteNumber: "QUO-1", total: 100, currencySymbol: "$", itemCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("quote-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ quoteNumber: "QUO-1", discountPercent: 10 });
    expect(url).toContain("quo=QUO-1");
    expect(url).toContain("disc=10");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = sampleInput();
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.quoteNumber).toBe("QUO-2026-001");
    expect(parsed.fromName).toBe("Acme LLC");
    expect(parsed.lineItemsText).toContain("Web design");
    expect(parsed.discountPercent).toBe(10);
    expect(parsed.currencySymbol).toBe("$");
    expect(parsed.termsAndConditions).toContain("50% deposit");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown currency", () => {
    const parsed = parseShareUrl("cur=ZZZ");
    expect(parsed.currencySymbol).toBeUndefined();
  });
  it("ignores non-numeric discount", () => {
    const parsed = parseShareUrl("disc=abc");
    expect(parsed.discountPercent).toBeUndefined();
  });
});

describe("quote-generator summaryStats", () => {
  it("computes summary stats with validity days", () => {
    const input = sampleInput();
    const totals = computeGrandTotal(input);
    const stats = summaryStats(totals, input.quoteDate, input.validUntil);
    expect(stats.itemCount).toBe(3);
    expect(stats.totalQty).toBe(16);
    expect(stats.subtotal).toBe(1170);
    expect(stats.total).toBe(1053);
    expect(stats.maxLineTotal).toBe(750);
    expect(stats.minLineTotal).toBe(120);
    expect(stats.avgLineTotal).toBe(390);
    expect(stats.validityDays).toBe(30);
  });
  it("detects expired quote", () => {
    const input = sampleInput({ quoteDate: "2020-01-01", validUntil: "2020-02-01" });
    const totals = computeGrandTotal(input);
    const stats = summaryStats(totals, input.quoteDate, input.validUntil);
    expect(stats.isExpired).toBe(true);
  });
  it("handles empty totals", () => {
    const t = computeTotals([], 0);
    const stats = summaryStats(t, "2026-01-01", "2026-02-01");
    expect(stats.itemCount).toBe(0);
    expect(stats.avgLineTotal).toBe(0);
    expect(stats.maxLineTotal).toBe(0);
    expect(stats.minLineTotal).toBe(0);
  });
  it("returns null validityDays for missing dates", () => {
    const t = computeTotals([], 0);
    const stats = summaryStats(t, "", "");
    expect(stats.validityDays).toBeNull();
    expect(stats.isExpired).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = CurrencySymbol;
