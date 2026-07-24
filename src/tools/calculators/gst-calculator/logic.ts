/**
 * GST / VAT Calculator — pure logic.
 */

export type Mode = "add" | "remove";

export interface GstInput {
  amount: number;
  ratePct: number;
  mode: Mode;
  /** Split GST into CGST + SGST (each = rate/2). Common in India for intra-state. */
  splitCgstSgst?: boolean;
  /** Use IGST (full rate, no split). Common in India for inter-state. */
  igst?: boolean;
}

export interface GstResult {
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  effectiveRate: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  mode: Mode;
  ratePct: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateGst(input: GstInput): GstResult | { error: string } {
  const { amount, ratePct, mode } = input;
  if (amount < 0) return { error: "Amount cannot be negative." };
  if (ratePct < 0) return { error: "Rate cannot be negative." };
  if (ratePct > 100) return { error: "Rate cannot exceed 100%." };

  let baseAmount: number, gstAmount: number, totalAmount: number;
  if (mode === "add") {
    // GST-exclusive → add GST on top
    baseAmount = amount;
    gstAmount = amount * (ratePct / 100);
    totalAmount = baseAmount + gstAmount;
  } else {
    // GST-inclusive → remove GST from total
    totalAmount = amount;
    baseAmount = amount / (1 + ratePct / 100);
    gstAmount = amount - baseAmount;
  }

  const effectiveRate = totalAmount > 0 ? (gstAmount / totalAmount) * 100 : 0;

  const result: GstResult = {
    baseAmount: r2(baseAmount),
    gstAmount: r2(gstAmount),
    totalAmount: r2(totalAmount),
    effectiveRate: r2(effectiveRate),
    mode,
    ratePct,
  };

  if (input.splitCgstSgst) {
    result.cgst = r2(gstAmount / 2);
    result.sgst = r2(gstAmount / 2);
  }
  if (input.igst) {
    result.igst = r2(gstAmount);
  }

  return result;
}

/** Country-specific GST/VAT presets. */
export const COUNTRY_PRESETS: { code: string; country: string; rates: { label: string; rate: number }[] }[] = [
  { code: "IN", country: "India", rates: [
    { label: "Essential goods", rate: 5 },
    { label: "Standard goods", rate: 12 },
    { label: "Most goods/services", rate: 18 },
    { label: "Luxury items", rate: 28 },
  ]},
  { code: "GB", country: "United Kingdom", rates: [
    { label: "Standard VAT", rate: 20 },
    { label: "Reduced rate", rate: 5 },
  ]},
  { code: "AU", country: "Australia", rates: [
    { label: "Standard GST", rate: 10 },
  ]},
  { code: "SG", country: "Singapore", rates: [
    { label: "Standard GST", rate: 9 },
  ]},
  { code: "NZ", country: "New Zealand", rates: [
    { label: "Standard GST", rate: 15 },
  ]},
  { code: "DE", country: "Germany", rates: [
    { label: "Standard VAT", rate: 19 },
    { label: "Reduced rate", rate: 7 },
  ]},
  { code: "FR", country: "France", rates: [
    { label: "Standard VAT", rate: 20 },
    { label: "Reduced rate", rate: 5.5 },
  ]},
  { code: "IT", country: "Italy", rates: [
    { label: "Standard VAT", rate: 22 },
  ]},
  { code: "ES", country: "Spain", rates: [
    { label: "Standard VAT", rate: 21 },
  ]},
  { code: "CA", country: "Canada", rates: [
    { label: "Standard GST", rate: 5 },
  ]},
];

/** Batch mode: process multiple amounts. */
export function calculateGstBatch(amounts: number[], ratePct: number, mode: Mode): GstResult[] {
  return amounts.map((amount) => {
    const r = calculateGst({ amount, ratePct, mode });
    return "error" in r
      ? { baseAmount: 0, gstAmount: 0, totalAmount: 0, effectiveRate: 0, mode, ratePct }
      : r;
  });
}

/** Convert batch results to CSV. */
export function batchToCsv(results: GstResult[], amounts: number[]): string {
  const lines = ["Amount,Mode,Rate,Base,GST,Total,CGST,SGST,IGST"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    lines.push(`${amounts[i]},${r.mode},${r.ratePct}%,${r.baseAmount},${r.gstAmount},${r.totalAmount},${r.cgst ?? ""},${r.sgst ?? ""},${r.igst ?? ""}`);
  }
  return lines.join("\n");
}

export function formatMoney(amount: number, currency = "USD", locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
