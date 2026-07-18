/**
 * Affiliate Commission Calculator — pure logic.
 *
 * Calculate affiliate commissions across four program types:
 * flat percent, tiered percent (progressive brackets),
 * recurring (monthly × N months), and hybrid (initial + recurring).
 * Pure functions only — no DOM, no network.
 */

export type ProgramType = "flat-percent" | "tiered-percent" | "recurring" | "hybrid";

export interface Tier {
  minSales: number;
  percent: number;
}

export interface TierBreakdown {
  tier: Tier;
  salesInTier: number;
  commission: number;
  rangeLabel: string;
}

export interface CalculatorInput {
  programType: ProgramType;
  productPrice: number;
  salesCount: number;
  commissionPercent: number;
  tiers: Tier[];
  recurringMonths: number;
  refundRatePercent: number;
  taxPercent: number;
}

export interface CalculationResult {
  programType: ProgramType;
  grossCommission: number;
  refundDeduction: number;
  taxDeduction: number;
  netCommission: number;
  effectiveRatePercent: number;
  /** Tier-by-tier commission for tiered-percent; empty for others. */
  tierBreakdown: TierBreakdown[];
  /** Per-month commission for recurring/hybrid; empty otherwise. */
  monthlyBreakdown: { month: number; commission: number }[];
  /** Human-readable component rows for CSV/text rendering. */
  components: { label: string; value: number }[];
}

export interface ComparisonResult {
  a: CalculationResult;
  b: CalculationResult;
  delta: number;
  deltaPercent: number;
  winner: "a" | "b" | "tie";
}

export interface BreakEvenResult {
  salesRequired: number;
  perSaleNet: number;
  targetIncome: number;
  programType: ProgramType;
  feasible: boolean;
}

export interface HistoryEntry {
  ts: number;
  programType: ProgramType;
  netCommission: number;
  grossCommission: number;
}

export const HISTORY_KEY = "unqtools:affiliate-commission-calculator:history";
export const HISTORY_MAX = 20;

/** Default tier set used as the example preset. */
export const DEFAULT_TIERS: Tier[] = [
  { minSales: 1, percent: 10 },
  { minSales: 10, percent: 15 },
  { minSales: 50, percent: 20 },
  { minSales: 100, percent: 30 },
];

export const PROGRAM_TYPE_LABELS: Record<ProgramType, string> = {
  "flat-percent": "Flat Percent",
  "tiered-percent": "Tiered Percent",
  "recurring": "Recurring",
  "hybrid": "Hybrid (Initial + Recurring)",
};

export const PROGRAM_TYPE_PRESETS: Record<ProgramType, CalculatorInput> = {
  "flat-percent": {
    programType: "flat-percent",
    productPrice: 99.99,
    salesCount: 100,
    commissionPercent: 30,
    tiers: [],
    recurringMonths: 0,
    refundRatePercent: 5,
    taxPercent: 0,
  },
  "tiered-percent": {
    programType: "tiered-percent",
    productPrice: 99.99,
    salesCount: 120,
    commissionPercent: 0,
    tiers: DEFAULT_TIERS,
    recurringMonths: 0,
    refundRatePercent: 5,
    taxPercent: 0,
  },
  "recurring": {
    programType: "recurring",
    productPrice: 49.0,
    salesCount: 50,
    commissionPercent: 20,
    tiers: [],
    recurringMonths: 12,
    refundRatePercent: 5,
    taxPercent: 0,
  },
  "hybrid": {
    programType: "hybrid",
    productPrice: 99.99,
    salesCount: 50,
    commissionPercent: 30,
    tiers: [],
    recurringMonths: 12,
    refundRatePercent: 5,
    taxPercent: 0,
  },
};

/** Parse a non-negative number; returns 0 on parse failure or NaN. */
export function normalizeNumber(s: string | number): number {
  if (typeof s === "number") return Number.isFinite(s) ? Math.max(0, s) : 0;
  const n = Number.parseFloat(String(s ?? "").trim());
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/** Parse tiers text — one `minSales,percent` per line. */
export function parseTiers(text: string): Tier[] {
  if (!text) return [];
  const out: Tier[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const parts = line.split(/[,\s]+/).filter(Boolean);
    if (parts.length < 2) continue;
    const minSales = Number.parseFloat(parts[0]);
    const percent = Number.parseFloat(parts[1]);
    if (!Number.isFinite(minSales) || !Number.isFinite(percent)) continue;
    if (minSales < 0 || percent < 0) continue;
    out.push({ minSales: Math.floor(minSales), percent });
  }
  // Sort ascending by minSales; dedupe same minSales keeping last.
  out.sort((a, b) => a.minSales - b.minSales);
  const seen = new Map<number, Tier>();
  for (const t of out) seen.set(t.minSales, t);
  return Array.from(seen.values());
}

/** Validate tiers: must be sorted ascending and have non-negative percents. */
export function validateTiers(tiers: Tier[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  if (tiers.length === 0) {
    issues.push("At least one tier is required for tiered-percent");
    return { valid: false, issues };
  }
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    if (t.minSales < 0) issues.push(`Tier ${i + 1}: minSales must be ≥ 0`);
    if (t.percent < 0) issues.push(`Tier ${i + 1}: percent must be ≥ 0`);
    if (i > 0 && t.minSales <= tiers[i - 1].minSales) {
      issues.push(`Tier ${i + 1}: minSales must be greater than previous tier`);
    }
  }
  return { valid: issues.length === 0, issues };
}

/** Apply refund + tax adjustments to a gross amount. */
export function applyAdjustments(
  gross: number,
  refundRatePercent: number,
  taxPercent: number,
): { net: number; refundDeduction: number; taxDeduction: number } {
  const refundDeduction = gross * (refundRatePercent / 100);
  const afterRefund = gross - refundDeduction;
  const taxDeduction = afterRefund * (taxPercent / 100);
  const net = afterRefund - taxDeduction;
  return { net, refundDeduction, taxDeduction };
}

/**
 * Calculate flat-percent commission.
 * Gross = productPrice × salesCount × (commissionPercent / 100)
 */
export function calculateFlatPercent(input: CalculatorInput): CalculationResult {
  const gross = input.productPrice * input.salesCount * (input.commissionPercent / 100);
  const adj = applyAdjustments(gross, input.refundRatePercent, input.taxPercent);
  const effectiveRate = gross > 0 ? (adj.net / gross) * 100 : 0;
  return {
    programType: "flat-percent",
    grossCommission: gross,
    refundDeduction: adj.refundDeduction,
    taxDeduction: adj.taxDeduction,
    netCommission: adj.net,
    effectiveRatePercent: effectiveRate,
    tierBreakdown: [],
    monthlyBreakdown: [],
    components: [
      { label: "Product price", value: input.productPrice },
      { label: "Sales count", value: input.salesCount },
      { label: "Commission percent", value: input.commissionPercent },
      { label: "Gross commission", value: gross },
      { label: "Refund deduction", value: adj.refundDeduction },
      { label: "Tax deduction", value: adj.taxDeduction },
      { label: "Net commission", value: adj.net },
      { label: "Effective rate (%)", value: effectiveRate },
    ],
  };
}

/**
 * Calculate tiered-percent commission with progressive brackets.
 *
 * For each tier, only the sales falling inside [tier.minSales, nextTier.minSales - 1]
 * earn that tier's percent. Sales below the lowest tier's minSales earn 0%.
 */
export function calculateTieredPercent(input: CalculatorInput): CalculationResult {
  const tiers = [...input.tiers].sort((a, b) => a.minSales - b.minSales);
  const breakdown: TierBreakdown[] = [];
  let gross = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const upperBound = i + 1 < tiers.length ? tiers[i + 1].minSales - 1 : Number.POSITIVE_INFINITY;
    const lower = tier.minSales;
    const salesInTier = Math.max(0, Math.min(input.salesCount, upperBound) - lower + 1);
    if (salesInTier <= 0) {
      const rangeLabel = Number.isFinite(upperBound)
        ? `${lower}-${upperBound}`
        : `${lower}+`;
      breakdown.push({ tier, salesInTier: 0, commission: 0, rangeLabel });
      continue;
    }
    const commission = salesInTier * input.productPrice * (tier.percent / 100);
    gross += commission;
    const rangeLabel = Number.isFinite(upperBound)
      ? `${lower}-${upperBound}`
      : `${lower}+`;
    breakdown.push({ tier, salesInTier, commission, rangeLabel });
  }
  const adj = applyAdjustments(gross, input.refundRatePercent, input.taxPercent);
  const effectiveRate = gross > 0 ? (adj.net / gross) * 100 : 0;
  return {
    programType: "tiered-percent",
    grossCommission: gross,
    refundDeduction: adj.refundDeduction,
    taxDeduction: adj.taxDeduction,
    netCommission: adj.net,
    effectiveRatePercent: effectiveRate,
    tierBreakdown: breakdown,
    monthlyBreakdown: [],
    components: [
      { label: "Product price", value: input.productPrice },
      { label: "Sales count", value: input.salesCount },
      ...breakdown.map((b) => ({ label: `Tier ${b.rangeLabel} (${b.tier.percent}%)`, value: b.commission })),
      { label: "Gross commission", value: gross },
      { label: "Refund deduction", value: adj.refundDeduction },
      { label: "Tax deduction", value: adj.taxDeduction },
      { label: "Net commission", value: adj.net },
      { label: "Effective rate (%)", value: effectiveRate },
    ],
  };
}

/**
 * Calculate recurring commission.
 * Monthly commission = productPrice × salesCount × (commissionPercent / 100)
 * Total = monthly × recurringMonths (then apply adjustments).
 *
 * Refunds are applied to the total gross.
 */
export function calculateRecurring(input: CalculatorInput): CalculationResult {
  const monthly = input.productPrice * input.salesCount * (input.commissionPercent / 100);
  const months = Math.max(0, input.recurringMonths);
  const gross = monthly * months;
  const adj = applyAdjustments(gross, input.refundRatePercent, input.taxPercent);
  const effectiveRate = gross > 0 ? (adj.net / gross) * 100 : 0;
  const monthlyBreakdown: { month: number; commission: number }[] = [];
  for (let m = 1; m <= months; m++) {
    monthlyBreakdown.push({ month: m, commission: monthly });
  }
  return {
    programType: "recurring",
    grossCommission: gross,
    refundDeduction: adj.refundDeduction,
    taxDeduction: adj.taxDeduction,
    netCommission: adj.net,
    effectiveRatePercent: effectiveRate,
    tierBreakdown: [],
    monthlyBreakdown,
    components: [
      { label: "Product price", value: input.productPrice },
      { label: "Sales count", value: input.salesCount },
      { label: "Commission percent", value: input.commissionPercent },
      { label: "Monthly commission", value: monthly },
      { label: "Recurring months", value: months },
      { label: "Gross commission", value: gross },
      { label: "Refund deduction", value: adj.refundDeduction },
      { label: "Tax deduction", value: adj.taxDeduction },
      { label: "Net commission", value: adj.net },
      { label: "Effective rate (%)", value: effectiveRate },
    ],
  };
}

/**
 * Calculate hybrid commission.
 * Initial = productPrice × salesCount × (commissionPercent / 100) (first payment, all customers).
 * Recurring = productPrice × salesCount × (commissionPercent × 0.5 / 100) × (recurringMonths - 1)
 *   (half-percent for subsequent months).
 * Total = initial + recurring; then apply adjustments.
 */
export function calculateHybrid(input: CalculatorInput): CalculationResult {
  const initial = input.productPrice * input.salesCount * (input.commissionPercent / 100);
  const recurringPercent = input.commissionPercent * 0.5;
  const subsequentMonths = Math.max(0, input.recurringMonths - 1);
  const recurring = input.productPrice * input.salesCount * (recurringPercent / 100) * subsequentMonths;
  const gross = initial + recurring;
  const adj = applyAdjustments(gross, input.refundRatePercent, input.taxPercent);
  const effectiveRate = gross > 0 ? (adj.net / gross) * 100 : 0;
  const monthlyBreakdown: { month: number; commission: number }[] = [];
  monthlyBreakdown.push({ month: 1, commission: initial });
  for (let m = 2; m <= input.recurringMonths; m++) {
    const perMonthRecurring = input.productPrice * input.salesCount * (recurringPercent / 100);
    monthlyBreakdown.push({ month: m, commission: perMonthRecurring });
  }
  return {
    programType: "hybrid",
    grossCommission: gross,
    refundDeduction: adj.refundDeduction,
    taxDeduction: adj.taxDeduction,
    netCommission: adj.net,
    effectiveRatePercent: effectiveRate,
    tierBreakdown: [],
    monthlyBreakdown,
    components: [
      { label: "Product price", value: input.productPrice },
      { label: "Sales count", value: input.salesCount },
      { label: "Initial commission percent", value: input.commissionPercent },
      { label: "Recurring commission percent", value: recurringPercent },
      { label: "Recurring months", value: input.recurringMonths },
      { label: "Initial commission", value: initial },
      { label: "Recurring commission", value: recurring },
      { label: "Gross commission", value: gross },
      { label: "Refund deduction", value: adj.refundDeduction },
      { label: "Tax deduction", value: adj.taxDeduction },
      { label: "Net commission", value: adj.net },
      { label: "Effective rate (%)", value: effectiveRate },
    ],
  };
}

/** Dispatcher — calculate based on programType. */
export function calculate(input: CalculatorInput): CalculationResult {
  switch (input.programType) {
    case "flat-percent": return calculateFlatPercent(input);
    case "tiered-percent": return calculateTieredPercent(input);
    case "recurring": return calculateRecurring(input);
    case "hybrid": return calculateHybrid(input);
    default: return calculateFlatPercent(input);
  }
}

/** Effective commission rate = net / gross × 100. */
export function computeEffectiveRate(result: CalculationResult): number {
  if (result.grossCommission <= 0) return 0;
  return (result.netCommission / result.grossCommission) * 100;
}

export interface SummaryStats {
  gross: number;
  refunds: number;
  tax: number;
  net: number;
  effectiveRate: number;
}

/** Build summary stats from a result. */
export function computeSummaryStats(result: CalculationResult): SummaryStats {
  return {
    gross: result.grossCommission,
    refunds: result.refundDeduction,
    tax: result.taxDeduction,
    net: result.netCommission,
    effectiveRate: computeEffectiveRate(result),
  };
}

/**
 * Compare two program types for the same sales volume.
 * `inputB` may omit fields not relevant to its program type.
 */
export function comparePrograms(
  inputA: CalculatorInput,
  inputB: CalculatorInput,
): ComparisonResult {
  const a = calculate(inputA);
  const b = calculate(inputB);
  const delta = a.netCommission - b.netCommission;
  const base = Math.max(Math.abs(a.netCommission), Math.abs(b.netCommission));
  const deltaPercent = base > 0 ? (delta / base) * 100 : 0;
  const winner: "a" | "b" | "tie" =
    Math.abs(delta) < 1e-9 ? "tie" : a.netCommission > b.netCommission ? "a" : "b";
  return { a, b, delta, deltaPercent, winner };
}

/**
 * Break-even: how many sales are required to hit `targetIncome` net?
 * Uses the per-sale net for the given program type and input (with
 * salesCount=1 baseline). For tiered-percent, uses the highest tier's
 * percent as a conservative approximation.
 */
export function computeBreakEven(
  targetIncome: number,
  input: CalculatorInput,
): BreakEvenResult {
  const target = normalizeNumber(targetIncome);
  if (target <= 0) {
    return {
      salesRequired: 0,
      perSaleNet: 0,
      targetIncome: target,
      programType: input.programType,
      feasible: false,
    };
  }
  // Compute one sale's commission, then apply refund + tax adjustments to get
  // per-sale net commission.
  let perSaleGross = 0;
  if (input.programType === "flat-percent") {
    perSaleGross = input.productPrice * (input.commissionPercent / 100);
  } else if (input.programType === "recurring") {
    const months = Math.max(0, input.recurringMonths);
    perSaleGross = input.productPrice * (input.commissionPercent / 100) * months;
  } else if (input.programType === "hybrid") {
    const initial = input.productPrice * (input.commissionPercent / 100);
    const subsequentMonths = Math.max(0, input.recurringMonths - 1);
    const recurring = input.productPrice * (input.commissionPercent * 0.5 / 100) * subsequentMonths;
    perSaleGross = initial + recurring;
  } else {
    // tiered-percent: use highest tier percent as approximation.
    const tiers = [...input.tiers].sort((a, b) => b.percent - a.percent);
    const highest = tiers[0];
    perSaleGross = highest ? input.productPrice * (highest.percent / 100) : 0;
  }
  const adj = applyAdjustments(perSaleGross, input.refundRatePercent, input.taxPercent);
  const perSaleNet = adj.net;
  if (perSaleNet <= 0) {
    return {
      salesRequired: 0,
      perSaleNet,
      targetIncome: target,
      programType: input.programType,
      feasible: false,
    };
  }
  const salesRequired = Math.ceil(target / perSaleNet);
  return {
    salesRequired,
    perSaleNet,
    targetIncome: target,
    programType: input.programType,
    feasible: true,
  };
}

/** Format a number as currency-style string with 2 decimals. */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

/** Render the full text report. */
export function renderTextReport(result: CalculationResult): string {
  const lines: string[] = [
    "=== Affiliate Commission Calculator — Report ===",
    `Program type: ${PROGRAM_TYPE_LABELS[result.programType]}`,
    "",
  ];
  if (result.tierBreakdown.length > 0) {
    lines.push("## Tier breakdown");
    for (const b of result.tierBreakdown) {
      lines.push(
        `  ${b.rangeLabel} @ ${b.tier.percent}%: ${b.salesInTier} sales → ${formatMoney(b.commission)}`,
      );
    }
    lines.push("");
  }
  if (result.monthlyBreakdown.length > 0) {
    lines.push("## Monthly breakdown");
    for (const m of result.monthlyBreakdown) {
      lines.push(`  Month ${m.month}: ${formatMoney(m.commission)}`);
    }
    lines.push("");
  }
  lines.push("## Components");
  for (const c of result.components) {
    const val = Number.isInteger(c.value) ? String(c.value) : formatMoney(c.value);
    lines.push(`  ${c.label}: ${val}`);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push(`  Gross: ${formatMoney(result.grossCommission)}`);
  lines.push(`  Refunds: ${formatMoney(result.refundDeduction)}`);
  lines.push(`  Tax: ${formatMoney(result.taxDeduction)}`);
  lines.push(`  Net: ${formatMoney(result.netCommission)}`);
  lines.push(`  Effective rate: ${result.effectiveRatePercent.toFixed(2)}%`);
  return lines.join("\n");
}

/** Render CSV (component, value). */
export function renderCsv(result: CalculationResult): string {
  const lines = ["component,value"];
  for (const c of result.components) {
    const val = Number.isInteger(c.value) ? String(c.value) : c.value.toFixed(4);
    const escaped = /[",\n]/.test(c.label) ? `"${c.label.replace(/"/g, '""')}"` : c.label;
    lines.push(`${escaped},${val}`);
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(input: CalculatorInput): string {
  const params = new URLSearchParams();
  params.set("type", input.programType);
  params.set("price", String(input.productPrice));
  params.set("sales", String(input.salesCount));
  params.set("pct", String(input.commissionPercent));
  if (input.tiers.length > 0) {
    params.set("tiers", input.tiers.map((t) => `${t.minSales},${t.percent}`).join(";"));
  }
  if (input.recurringMonths > 0) params.set("months", String(input.recurringMonths));
  if (input.refundRatePercent > 0) params.set("refund", String(input.refundRatePercent));
  if (input.taxPercent > 0) params.set("tax", String(input.taxPercent));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<CalculatorInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<CalculatorInput> = {};
  const type = params.get("type") as ProgramType | null;
  if (type && ["flat-percent", "tiered-percent", "recurring", "hybrid"].includes(type)) {
    out.programType = type;
  }
  if (params.get("price")) out.productPrice = normalizeNumber(params.get("price")!);
  if (params.get("sales")) out.salesCount = normalizeNumber(params.get("sales")!);
  if (params.get("pct")) out.commissionPercent = normalizeNumber(params.get("pct")!);
  const tiersStr = params.get("tiers");
  if (tiersStr) out.tiers = parseTiers(tiersStr.split(";").join("\n"));
  if (params.get("months")) out.recurringMonths = normalizeNumber(params.get("months")!);
  if (params.get("refund")) out.refundRatePercent = normalizeNumber(params.get("refund")!);
  if (params.get("tax")) out.taxPercent = normalizeNumber(params.get("tax")!);
  return out;
}
