import { describe, it, expect } from "vitest";
import {
  CURRENCIES,
  getCurrency,
  convert,
  formatMoney,
  convertToAll,
  tableToCsv,
} from "./logic";

describe("currency-converter", () => {
  it("has USD and major currencies", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
    expect(codes).toContain("INR");
    expect(codes).toContain("JPY");
    expect(codes.length).toBeGreaterThan(25);
  });

  it("converts USD to itself", () => {
    const r = convert(100, "USD", "USD");
    expect(r.value).toBeCloseTo(100, 5);
  });

  it("converts between two currencies", () => {
    // USD -> EUR at 0.92
    const r = convert(100, "USD", "EUR");
    expect(r.value).toBeCloseTo(92, 5);
    expect(r.toSymbol).toBe("€");
  });

  it("converts INr via USD", () => {
    const r = convert(1, "USD", "INR");
    expect(r.value).toBeCloseTo(83.4, 5);
  });

  it("getCurrency falls back to USD for unknown", () => {
    expect(getCurrency("XXX").code).toBe("USD");
  });

  it("formats money with thousands separators", () => {
    expect(formatMoney(1000000)).toContain("1,000,000");
    expect(formatMoney(123.456, 2)).toBe("123.46");
  });

  it("builds a conversion table", () => {
    const rows = convertToAll(10, "USD");
    expect(rows).toHaveLength(CURRENCIES.length);
    expect(rows.find((r) => r.code === "USD")?.value).toBeCloseTo(10, 5);
  });

  it("exports table to CSV", () => {
    const rows = convertToAll(1, "USD");
    const csv = tableToCsv(rows);
    expect(csv).toContain("code,currency,symbol,value");
    expect(csv).toContain("USD");
  });
});
