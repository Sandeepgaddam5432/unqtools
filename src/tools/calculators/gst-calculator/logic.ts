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

// ============================================================================
// 100x features — added while preserving all existing exports
// ============================================================================

/**
 * Calculate reverse GST (extract GST from inclusive amount).
 * Alias for mode="remove", kept for API discoverability.
 */
export function extractGst(totalAmount: number, ratePct: number): GstResult | { error: string } {
  return calculateGst({ amount: totalAmount, ratePct, mode: "remove" });
}

/**
 * Add GST to a base amount.
 * Alias for mode="add", kept for API discoverability.
 */
export function addGst(baseAmount: number, ratePct: number): GstResult | { error: string } {
  return calculateGst({ amount: baseAmount, ratePct, mode: "add" });
}

/**
 * Compare GST rates side by side for the same base amount.
 */
export function compareRates(baseAmount: number, rates: number[]): Array<{ rate: number; gst: number; total: number }> {
  return rates.map((rate) => {
    const r = calculateGst({ amount: baseAmount, ratePct: rate, mode: "add" });
    if ("error" in r) return { rate, gst: 0, total: 0 };
    return { rate, gst: r.gstAmount, total: r.totalAmount };
  });
}

/**
 * Calculate GST with CGST + SGST split (India intra-state).
 */
export function calculateGstWithSplit(amount: number, ratePct: number, mode: Mode): GstResult | { error: string } {
  return calculateGst({ amount, ratePct, mode, splitCgstSgst: true });
}

/**
 * Calculate GST with IGST (India inter-state).
 */
export function calculateGstWithIgst(amount: number, ratePct: number, mode: Mode): GstResult | { error: string } {
  return calculateGst({ amount, ratePct, mode, igst: true });
}

/**
 * Get the GST slab for a given HSN code (simplified — returns the rate).
 * Note: This is a simplified lookup. Real HSN rates vary by product and state.
 */
export const HSN_RATE_SLABS: ReadonlyArray<{ hsnPrefix: string; description: string; rate: number }> = [
  { hsnPrefix: "0", description: "Live animals and animal products", rate: 0 },
  { hsnPrefix: "1", description: "Vegetable products", rate: 5 },
  { hsnPrefix: "2", description: "Foodstuffs, beverages, tobacco", rate: 12 },
  { hsnPrefix: "3", description: "Animal/vegetable oils and fats", rate: 5 },
  { hsnPrefix: "4", description: "Prepared foodstuffs", rate: 12 },
  { hsnPrefix: "5", description: "Mineral products", rate: 18 },
  { hsnPrefix: "6", description: "Chemical products", rate: 18 },
  { hsnPrefix: "7", description: "Plastics and rubber", rate: 18 },
  { hsnPrefix: "8", description: "Raw hides, leather", rate: 12 },
  { hsnPrefix: "9", description: "Wood, cork, straw", rate: 12 },
  { hsnPrefix: "10", description: "Pulp, paper", rate: 12 },
  { hsnPrefix: "11", description: "Textiles", rate: 5 },
  { hsnPrefix: "12", description: "Footwear, headgear", rate: 12 },
  { hsnPrefix: "13", description: "Stone, plaster, cement", rate: 18 },
  { hsnPrefix: "14", description: "Precious stones, jewellery", rate: 3 },
  { hsnPrefix: "15", description: "Base metals", rate: 18 },
  { hsnPrefix: "16", description: "Machinery, appliances", rate: 18 },
  { hsnPrefix: "17", description: "Vehicles, aircraft", rate: 18 },
  { hsnPrefix: "18", description: "Optical, medical instruments", rate: 12 },
  { hsnPrefix: "19", description: "Arms, ammunition", rate: 28 },
  { hsnPrefix: "20", description: "Miscellaneous", rate: 18 },
  { hsnPrefix: "21", description: "Works of art", rate: 12 },
  { hsnPrefix: "22", description: "Special transactions", rate: 18 },
];

/**
 * Look up GST rate by HSN code prefix.
 */
export function lookupHsnRate(hsnCode: string): { rate: number; description: string } | { error: string } {
  if (!hsnCode || hsnCode.length === 0) return { error: "HSN code is required." };
  const prefix = hsnCode.charAt(0);
  const slab = HSN_RATE_SLABS.find((s) => s.hsnPrefix === prefix);
  if (!slab) return { error: `No slab found for HSN prefix "${prefix}".` };
  return { rate: slab.rate, description: slab.description };
}

/**
 * Validation report.
 */
export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateInput(input: GstInput): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (input.amount < 0) {
    reports.push({ level: "fail", code: "NEGATIVE_AMOUNT", message: "Amount cannot be negative." });
    return reports;
  }
  reports.push({ level: "pass", code: "VALID_AMOUNT", message: "Amount is valid." });
  if (input.ratePct < 0) {
    reports.push({ level: "fail", code: "NEGATIVE_RATE", message: "Rate cannot be negative." });
  }
  if (input.ratePct > 100) {
    reports.push({ level: "fail", code: "RATE_TOO_HIGH", message: "Rate cannot exceed 100%." });
  }
  if (input.splitCgstSgst && input.igst) {
    reports.push({ level: "warn", code: "SPLIT_AND_IGST", message: "Both CGST/SGST split and IGST are set — typically only one applies." });
  }
  return reports;
}

/**
 * Reproducibility receipt.
 */
export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(input: GstInput): Receipt {
  const s = JSON.stringify(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    tool: "gst-calculator",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

/**
 * References.
 */
export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "CBIC-GST", citation: "CBIC India: GST Rates", summary: "Official GST rate schedules for India." },
  { id: "OECD-VAT", citation: "OECD Consumption Tax Trends", summary: "VAT/GST rates for OECD countries." },
  { id: "EU-VAT", citation: "EU VAT Rates", summary: "Standard and reduced VAT rates for EU member states." },
];
