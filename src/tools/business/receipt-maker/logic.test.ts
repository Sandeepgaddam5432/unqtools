import { describe, it, expect, beforeEach } from "vitest";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  CURRENCY_PRESETS,
  parseItems,
  splitCsvRow,
  calculateTotal,
  verifyPayment,
  validateReference,
  computeTotals,
  formatCurrency,
  suggestReceiptNumber,
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
  type ReceiptInput,
  type PaymentMethod,
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

function sampleInput(overrides: Partial<ReceiptInput> = {}): ReceiptInput {
  return {
    receiptNumber: "RCT-2026-001",
    receiptDate: "2026-01-15",
    paymentMethod: "credit-card",
    payerName: "John Doe",
    payerEmail: "john@example.com",
    payeeName: "Acme LLC",
    payeeAddress: "123 Main St\nAnytown, US 12345",
    itemsText: "Web design,750.00\nHosting,120.00\nSupport,300.00",
    paymentAmount: 1170,
    currencySymbol: "$",
    referenceNumber: "4242",
    notes: "Thank you for your payment!",
    ...overrides,
  };
}

describe("receipt-maker constants", () => {
  it("has 8 payment methods", () => {
    expect(PAYMENT_METHODS).toHaveLength(8);
    expect(PAYMENT_METHODS).toContain("cash");
    expect(PAYMENT_METHODS).toContain("check");
    expect(PAYMENT_METHODS).toContain("stripe");
    expect(PAYMENT_METHODS).toContain("other");
  });
  it("has 8 payment method labels", () => {
    expect(Object.keys(PAYMENT_METHOD_LABELS)).toHaveLength(8);
    expect(PAYMENT_METHOD_LABELS["credit-card"]).toBe("Credit Card");
    expect(PAYMENT_METHOD_LABELS["paypal"]).toBe("PayPal");
  });
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS).toContain("$");
    expect(CURRENCY_PRESETS).toContain("₹");
    expect(CURRENCY_PRESETS).toContain("A$");
  });
});

describe("receipt-maker parseItems", () => {
  it("parses valid lines", () => {
    const { items, errors } = parseItems("Web design,750.00\nHosting,120.00");
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(items[0]).toEqual({ description: "Web design", amount: 750 });
    expect(items[1]).toEqual({ description: "Hosting", amount: 120 });
  });
  it("skips blank lines", () => {
    const { items } = parseItems("A,10\n\n\nB,5");
    expect(items).toHaveLength(2);
  });
  it("parses quoted descriptions with commas", () => {
    const { items } = parseItems('"Widget, premium",12.50');
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe("Widget, premium");
    expect(items[0].amount).toBe(12.5);
  });
  it("rejects invalid amount", () => {
    const { errors } = parseItems("Bad,abc");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid amount");
  });
  it("rejects negative amount", () => {
    const { errors } = parseItems("Bad,-5");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("invalid amount");
  });
  it("errors on too few fields", () => {
    const { errors } = parseItems("Only description");
    expect(errors[0]).toContain("needs description,amount");
  });
  it("returns empty for empty input", () => {
    expect(parseItems("").items).toEqual([]);
    expect(parseItems("   \n  ").items).toEqual([]);
  });
});

describe("receipt-maker splitCsvRow", () => {
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

describe("receipt-maker calculateTotal", () => {
  it("sums item amounts", () => {
    const items = parseItems("A,10\nB,20.50\nC,30").items;
    expect(calculateTotal(items)).toBe(60.5);
  });
  it("returns 0 for empty", () => {
    expect(calculateTotal([])).toBe(0);
  });
  it("rounds to 2 decimals", () => {
    const items = parseItems("A,33.33\nB,33.33\nC,33.34").items;
    expect(calculateTotal(items)).toBe(100);
  });
});

describe("receipt-maker verifyPayment", () => {
  it("returns matched when within 0.01", () => {
    const v = verifyPayment(100, 100);
    expect(v.status).toBe("matched");
    expect(v.difference).toBe(0);
    expect(v.warning).toBeUndefined();
  });
  it("returns matched when within tolerance", () => {
    const v = verifyPayment(100.005, 100);
    expect(v.status).toBe("matched");
  });
  it("returns short when underpaid", () => {
    const v = verifyPayment(90, 100);
    expect(v.status).toBe("short");
    expect(v.difference).toBe(-10);
    expect(v.warning).toContain("short by 10");
  });
  it("returns over when overpaid", () => {
    const v = verifyPayment(110, 100);
    expect(v.status).toBe("over");
    expect(v.difference).toBe(10);
    expect(v.warning).toContain("over by 10");
  });
  it("returns unpaid when payment is 0 and total > 0", () => {
    const v = verifyPayment(0, 100);
    expect(v.status).toBe("unpaid");
    expect(v.warning).toContain("No payment");
  });
  it("returns matched when both are 0", () => {
    const v = verifyPayment(0, 0);
    expect(v.status).toBe("matched");
  });
  it("handles NaN payment as 0", () => {
    const v = verifyPayment(NaN, 100);
    expect(v.status).toBe("unpaid");
  });
});

describe("receipt-maker validateReference", () => {
  it("cash accepts anything (including empty)", () => {
    expect(validateReference("cash", "").valid).toBe(true);
    expect(validateReference("cash", "anything").valid).toBe(true);
  });
  it("check requires 3-6 digits", () => {
    expect(validateReference("check", "").valid).toBe(false);
    expect(validateReference("check", "123").valid).toBe(true);
    expect(validateReference("check", "123456").valid).toBe(true);
    expect(validateReference("check", "12").valid).toBe(false);
    expect(validateReference("check", "1234567").valid).toBe(false);
    expect(validateReference("check", "abcd").valid).toBe(false);
  });
  it("credit-card requires exactly 4 digits", () => {
    expect(validateReference("credit-card", "").valid).toBe(false);
    expect(validateReference("credit-card", "4242").valid).toBe(true);
    expect(validateReference("credit-card", "424").valid).toBe(false);
    expect(validateReference("credit-card", "42424").valid).toBe(false);
    expect(validateReference("credit-card", "abcd").valid).toBe(false);
  });
  it("debit-card requires exactly 4 digits", () => {
    expect(validateReference("debit-card", "1234").valid).toBe(true);
    expect(validateReference("debit-card", "123").valid).toBe(false);
  });
  it("bank-transfer requires min 4 chars", () => {
    expect(validateReference("bank-transfer", "").valid).toBe(false);
    expect(validateReference("bank-transfer", "abc").valid).toBe(false);
    expect(validateReference("bank-transfer", "TXN12345").valid).toBe(true);
  });
  it("paypal requires 8-20 alphanumeric", () => {
    expect(validateReference("paypal", "").valid).toBe(false);
    expect(validateReference("paypal", "abc").valid).toBe(false);
    expect(validateReference("paypal", "PAYID1234567").valid).toBe(true);
    expect(validateReference("paypal", "PAYID12345678901234567890").valid).toBe(false); // too long
  });
  it("stripe requires ch_/pi_/py_/in_ prefix", () => {
    expect(validateReference("stripe", "").valid).toBe(false);
    expect(validateReference("stripe", "abc123").valid).toBe(false);
    expect(validateReference("stripe", "ch_1234567890").valid).toBe(true);
    expect(validateReference("stripe", "pi_abc1234567").valid).toBe(true);
    expect(validateReference("stripe", "py_xyz1234567").valid).toBe(true);
    expect(validateReference("stripe", "in_abc1234567").valid).toBe(true);
  });
  it("other accepts anything", () => {
    expect(validateReference("other", "").valid).toBe(true);
    expect(validateReference("other", "any-ref-123").valid).toBe(true);
  });
});

describe("receipt-maker computeTotals", () => {
  it("computes all totals correctly", () => {
    const input = sampleInput();
    const t = computeTotals(input);
    expect(t.items).toHaveLength(3);
    expect(t.total).toBe(1170);
    expect(t.itemCount).toBe(3);
    expect(t.payment.status).toBe("matched");
    expect(t.payment.payment).toBe(1170);
    expect(t.payment.difference).toBe(0);
    expect(t.referenceValid).toBe(true);
  });
  it("flags short payment", () => {
    const input = sampleInput({ paymentAmount: 1000 });
    const t = computeTotals(input);
    expect(t.payment.status).toBe("short");
    expect(t.payment.difference).toBe(-170);
  });
  it("flags over payment", () => {
    const input = sampleInput({ paymentAmount: 1200 });
    const t = computeTotals(input);
    expect(t.payment.status).toBe("over");
    expect(t.payment.difference).toBe(30);
  });
  it("flags invalid reference", () => {
    const input = sampleInput({ referenceNumber: "abc" });
    const t = computeTotals(input);
    expect(t.referenceValid).toBe(false);
    expect(t.referenceError).toContain("4 digits");
  });
  it("handles empty items", () => {
    const input = sampleInput({ itemsText: "", paymentAmount: 0 });
    const t = computeTotals(input);
    expect(t.total).toBe(0);
    expect(t.itemCount).toBe(0);
    // payment 0, total 0 → matched (both zero)
    expect(t.payment.status).toBe("matched");
  });
  it("flags over payment when items empty but payment > 0", () => {
    const input = sampleInput({ itemsText: "" });
    const t = computeTotals(input);
    expect(t.total).toBe(0);
    expect(t.payment.status).toBe("over");
  });
});

describe("receipt-maker formatCurrency", () => {
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

describe("receipt-maker suggestReceiptNumber", () => {
  it("suggests with year and padded sequence", () => {
    expect(suggestReceiptNumber("2026-05-10", 1)).toBe("RCT-2026-001");
    expect(suggestReceiptNumber("2026-05-10", 42)).toBe("RCT-2026-042");
  });
  it("falls back to current year when date empty", () => {
    const result = suggestReceiptNumber("");
    expect(result.startsWith("RCT-")).toBe(true);
  });
  it("clamps sequence below 1", () => {
    expect(suggestReceiptNumber("2026-01-01", 0)).toBe("RCT-2026-001");
    expect(suggestReceiptNumber("2026-01-01", -3)).toBe("RCT-2026-001");
  });
});

describe("receipt-maker renderText", () => {
  it("renders text with key fields", () => {
    const input = sampleInput();
    const totals = computeTotals(input);
    const text = renderText(input, totals);
    expect(text).toContain("PAYMENT RECEIPT");
    expect(text).toContain("RCT-2026-001");
    expect(text).toContain("John Doe");
    expect(text).toContain("Acme LLC");
    expect(text).toContain("Web design");
    expect(text).toContain("TOTAL:");
    expect(text).toContain("PAYMENT:");
    expect(text).toContain("Status: MATCHED");
    expect(text).toContain("Notes:");
  });
  it("includes warning when payment mismatched", () => {
    const input = sampleInput({ paymentAmount: 1000 });
    const totals = computeTotals(input);
    const text = renderText(input, totals);
    expect(text).toContain("Status: SHORT");
    expect(text).toContain("short by");
  });
});

describe("receipt-maker renderCsv", () => {
  it("renders header + rows + metadata", () => {
    const input = sampleInput();
    const totals = computeTotals(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain("description,amount");
    expect(csv).toContain("Web design,750.00");
    expect(csv).toContain("receipt_number,RCT-2026-001");
    expect(csv).toContain(`total,${totals.total.toFixed(2)}`);
    expect(csv).toContain("status,matched");
  });
  it("escapes commas in descriptions", () => {
    const input = sampleInput({ itemsText: '"Widget, premium",12.50' });
    const totals = computeTotals(input);
    const csv = renderCsv(input, totals);
    expect(csv).toContain('"Widget, premium"');
  });
});

describe("receipt-maker renderHtml", () => {
  it("renders HTML with receipt data", () => {
    const input = sampleInput();
    const totals = computeTotals(input);
    const html = renderHtml(input, totals);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("RECEIPT");
    expect(html).toContain("RCT-2026-001");
    expect(html).toContain("Acme LLC");
    expect(html).toContain("John Doe");
    expect(html).toContain("MATCHED");
  });
  it("escapes HTML special chars", () => {
    const input = sampleInput({ payerName: "John <script>alert(1)</script>" });
    const totals = computeTotals(input);
    const html = renderHtml(input, totals);
    expect(html).toContain("John &lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("receipt-maker generatePdf", () => {
  it("generates non-empty PDF bytes", async () => {
    const input = sampleInput();
    const totals = computeTotals(input);
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
    const input = sampleInput({ itemsText: "" });
    const totals = computeTotals(input);
    const bytes = await generatePdf(input, totals);
    expect(bytes.length).toBeGreaterThan(500);
  });
});

describe("receipt-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      receiptNumber: "RCT-1",
      total: 100,
      currencySymbol: "$",
      paymentMethod: "cash",
      status: "matched",
      itemCount: 3,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].receiptNumber).toBe("RCT-1");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        receiptNumber: `RCT-${i}`,
        total: i,
        currencySymbol: "$",
        paymentMethod: "cash",
        status: "matched",
        itemCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
    // Most recent first
    expect(loadHistory()[0].ts).toBe(24);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      receiptNumber: "RCT-1",
      total: 100,
      currencySymbol: "$",
      paymentMethod: "cash",
      status: "matched",
      itemCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("receipt-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ receiptNumber: "RCT-1", paymentAmount: 100 });
    expect(url).toContain("rct=RCT-1");
    expect(url).toContain("amt=100");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const input = sampleInput();
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.receiptNumber).toBe("RCT-2026-001");
    expect(parsed.payerName).toBe("John Doe");
    expect(parsed.itemsText).toContain("Web design");
    expect(parsed.paymentAmount).toBe(1170);
    expect(parsed.paymentMethod).toBe("credit-card");
    expect(parsed.currencySymbol).toBe("$");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown payment method", () => {
    const parsed = parseShareUrl("method=bitcoin");
    expect(parsed.paymentMethod).toBeUndefined();
  });
  it("filters unknown currency", () => {
    const parsed = parseShareUrl("cur=ZZZ");
    expect(parsed.currencySymbol).toBeUndefined();
  });
  it("ignores non-numeric payment amount", () => {
    const parsed = parseShareUrl("amt=abc");
    expect(parsed.paymentAmount).toBeUndefined();
  });
});

describe("receipt-maker summaryStats", () => {
  it("computes summary stats", () => {
    const input = sampleInput();
    const totals = computeTotals(input);
    const stats = summaryStats(totals, input.paymentMethod);
    expect(stats.itemCount).toBe(3);
    expect(stats.total).toBe(1170);
    expect(stats.payment).toBe(1170);
    expect(stats.difference).toBe(0);
    expect(stats.status).toBe("matched");
    expect(stats.paymentMethod).toBe("credit-card");
    expect(stats.maxItemAmount).toBe(750); // Web design
    expect(stats.minItemAmount).toBe(120); // Hosting
    // avg = (750+120+300)/3 = 390
    expect(stats.avgItemAmount).toBe(390);
  });
  it("handles empty totals", () => {
    const input = sampleInput({ itemsText: "", paymentAmount: 0 });
    const totals = computeTotals(input);
    const stats = summaryStats(totals, input.paymentMethod);
    expect(stats.itemCount).toBe(0);
    expect(stats.avgItemAmount).toBe(0);
    expect(stats.maxItemAmount).toBe(0);
    expect(stats.minItemAmount).toBe(0);
  });
});

// Suppress unused-import lint
export type _Unused = PaymentMethod | CurrencySymbol;
