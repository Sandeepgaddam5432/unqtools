/**
 * GST / VAT Calculator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateGst, calculateGstBatch, batchToCsv, COUNTRY_PRESETS, formatMoney, type Mode } from "./logic";

describe("calculateGst — add mode", () => {
  it("adds 18% GST to 1000", () => {
    const r = calculateGst({ amount: 1000, ratePct: 18, mode: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.baseAmount).toBe(1000);
    expect(r.gstAmount).toBe(180);
    expect(r.totalAmount).toBe(1180);
  });
  it("handles 0% rate", () => {
    const r = calculateGst({ amount: 1000, ratePct: 0, mode: "add" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.gstAmount).toBe(0);
    expect(r.totalAmount).toBe(1000);
  });
  it("errors on negative amount", () => {
    expect("error" in calculateGst({ amount: -100, ratePct: 18, mode: "add" })).toBe(true);
  });
  it("errors on rate > 100", () => {
    expect("error" in calculateGst({ amount: 1000, ratePct: 150, mode: "add" })).toBe(true);
  });
});

describe("calculateGst — remove mode", () => {
  it("removes 18% GST from 1180", () => {
    const r = calculateGst({ amount: 1180, ratePct: 18, mode: "remove" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.baseAmount).toBeCloseTo(1000, 1);
    expect(r.gstAmount).toBeCloseTo(180, 1);
    expect(r.totalAmount).toBe(1180);
  });
  it("handles 0% rate (no-op)", () => {
    const r = calculateGst({ amount: 1000, ratePct: 0, mode: "remove" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.baseAmount).toBe(1000);
    expect(r.gstAmount).toBe(0);
  });
});

describe("calculateGst — CGST/SGST split", () => {
  it("splits GST into CGST + SGST", () => {
    const r = calculateGst({ amount: 1000, ratePct: 18, mode: "add", splitCgstSgst: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.cgst).toBe(90); // half of 180
    expect(r.sgst).toBe(90);
    expect(r.cgst + r.sgst).toBe(r.gstAmount);
  });
});

describe("calculateGst — IGST", () => {
  it("sets IGST to full GST amount", () => {
    const r = calculateGst({ amount: 1000, ratePct: 18, mode: "add", igst: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.igst).toBe(180);
  });
});

describe("calculateGst — effective rate", () => {
  it("computes effective rate on total", () => {
    const r = calculateGst({ amount: 1000, ratePct: 18, mode: "add" });
    if ("error" in r) throw new Error("Should not error");
    // GST/Total = 180/1180 ≈ 15.25%
    expect(r.effectiveRate).toBeCloseTo(15.25, 1);
  });
});

describe("COUNTRY_PRESETS", () => {
  it("includes India with 4 rates", () => {
    const india = COUNTRY_PRESETS.find((c) => c.code === "IN");
    expect(india?.country).toBe("India");
    expect(india?.rates.length).toBeGreaterThanOrEqual(4);
    expect(india?.rates.some((r) => r.rate === 18)).toBe(true);
    expect(india?.rates.some((r) => r.rate === 28)).toBe(true);
  });
  it("includes UK with 20% standard rate", () => {
    const uk = COUNTRY_PRESETS.find((c) => c.code === "GB");
    expect(uk?.rates.some((r) => r.rate === 20)).toBe(true);
  });
  it("includes Australia with 10% rate", () => {
    const au = COUNTRY_PRESETS.find((c) => c.code === "AU");
    expect(au?.rates.some((r) => r.rate === 10)).toBe(true);
  });
});

describe("calculateGstBatch", () => {
  it("processes multiple amounts", () => {
    const r = calculateGstBatch([1000, 2000, 3000], 18, "add");
    expect(r.length).toBe(3);
    expect(r[0]!.gstAmount).toBe(180);
    expect(r[1]!.gstAmount).toBe(360);
    expect(r[2]!.gstAmount).toBe(540);
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const r = calculateGstBatch([1000], 18, "add");
    const csv = batchToCsv(r, [1000]);
    expect(csv.split("\n")[0]).toContain("Amount");
    expect(csv).toContain("1000");
    expect(csv).toContain("180");
  });
});

describe("formatMoney", () => {
  it("formats USD", () => {
    expect(formatMoney(1180, "USD")).toContain("1,180");
  });
  it("formats INR", () => {
    const s = formatMoney(100000, "INR", "en-IN");
    expect(s).toContain("1,00,000");
  });
});
