/**
 * Tip Calculator — 100x enhanced logic.
 *
 * Preserves all existing exports (calculateTip, suggestTipPercent,
 * compareTips, formatMoney, historyToCsv) with exact signatures.
 *
 * Adds 100x features:
 * - Multi-currency support (enhanced)
 * - Tip comparison table (existing)
 * - Service quality suggestions (existing)
 * - Tax + tip-on-tax calculations (existing)
 * - Rounding modes (existing)
 * - Bill splitting (existing)
 * - Custom tip presets (new)
 * - Regional tipping norms (new)
 * - Multi-format export (new)
 * - Validation report (new)
 * - Reproducibility receipt (new)
 */

export interface TipInput {
  subtotal: number;
  tipPercent: number;
  taxPercent?: number;
  splitCount?: number;
  tipOnTax?: boolean;
  rounding?: "none" | "up" | "down" | "nearest";
  roundingIncrement?: number;
  /** Currency code (USD, EUR, GBP, INR, JPY, etc.). Default USD. */
  currency?: string;
}

export interface TipResult {
  subtotal: number;
  tipAmount: number;
  taxAmount: number;
  grandTotal: number;
  perPerson: {
    subtotal: number;
    tip: number;
    tax: number;
    total: number;
  };
  effectiveTipPercent: number;
  roundingDelta: number;
  currency: string;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ============================================================================
// Core calculation (preserved from original)
// ============================================================================

export function calculateTip(input: TipInput): TipResult | { error: string } {
  const { subtotal, tipPercent } = input;
  if (subtotal < 0) return { error: "Subtotal cannot be negative." };
  if (tipPercent < 0) return { error: "Tip percent cannot be negative." };
  if (tipPercent > 200) return { error: "Tip percent above 200% seems unrealistic." };
  const split = input.splitCount ?? 1;
  if (split < 1 || !Number.isInteger(split)) return { error: "Split count must be a positive integer." };
  const taxPct = input.taxPercent ?? 0;
  if (taxPct < 0 || taxPct > 100) return { error: "Tax percent must be between 0 and 100." };

  const taxAmount = r2(subtotal * (taxPct / 100));
  const tipBase = input.tipOnTax ? subtotal + taxAmount : subtotal;
  const tipAmount = r2(tipBase * (tipPercent / 100));
  let grandTotal = r2(subtotal + taxAmount + tipAmount);

  const increment = input.roundingIncrement ?? 1;
  let roundingDelta = 0;
  if (input.rounding && input.rounding !== "none" && increment > 0) {
    const raw = subtotal + taxAmount + tipAmount;
    let rounded: number;
    if (input.rounding === "up") rounded = Math.ceil(raw / increment) * increment;
    else if (input.rounding === "down") rounded = Math.floor(raw / increment) * increment;
    else rounded = Math.round(raw / increment) * increment;
    grandTotal = r2(rounded);
    roundingDelta = r2(grandTotal - raw);
  }

  const effectiveTipPercent = subtotal > 0 ? r2(((tipAmount + roundingDelta) / subtotal) * 100) : 0;

  return {
    subtotal: r2(subtotal),
    tipAmount,
    taxAmount,
    grandTotal,
    perPerson: {
      subtotal: r2(subtotal / split),
      tip: r2(tipAmount / split),
      tax: r2(taxAmount / split),
      total: r2(grandTotal / split),
    },
    effectiveTipPercent,
    roundingDelta,
    currency: input.currency ?? "USD",
  };
}

// ============================================================================
// Suggest tip percent (preserved from original)
// ============================================================================

export function suggestTipPercent(quality: "poor" | "ok" | "good" | "excellent"): { percent: number; reason: string } {
  switch (quality) {
    case "poor": return { percent: 10, reason: "10% — minimum courtesy tip for poor service." };
    case "ok": return { percent: 15, reason: "15% — standard tip for average service." };
    case "good": return { percent: 18, reason: "18% — good service, slightly above standard." };
    case "excellent": return { percent: 22, reason: "22% — excellent service, reward the staff." };
  }
}

// ============================================================================
// Compare tips (preserved from original)
// ============================================================================

export function compareTips(subtotal: number, percents: [number, number, number]): { percent: number; tip: number; total: number }[] {
  return percents.map((p) => ({
    percent: p,
    tip: r2(subtotal * (p / 100)),
    total: r2(subtotal * (1 + p / 100)),
  }));
}

// ============================================================================
// Format money (preserved from original)
// ============================================================================

export function formatMoney(amount: number, currency = "USD", locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// ============================================================================
// History to CSV (preserved from original)
// ============================================================================

export function historyToCsv(history: { ts: number; subtotal: number; tipPercent: number; tip: number; total: number; split: number }[]): string {
  const lines = ["Timestamp,Subtotal,TipPercent,TipAmount,GrandTotal,Split"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.subtotal},${h.tipPercent},${h.tip},${h.total},${h.split}`);
  }
  return lines.join("\n");
}

// ============================================================================
// NEW: 100x features
// ============================================================================

/**
 * Regional tipping norms. Source: culture-independent travel guides.
 * Note: these are norms, not legal requirements. Always verify locally.
 */
export const REGIONAL_TIPPING_NORMS: ReadonlyArray<{
  region: string;
  restaurantPct: number;
  note: string;
}> = [
  { region: "United States", restaurantPct: 18, note: "15-20% expected at sit-down restaurants. Tipping is standard." },
  { region: "Canada", restaurantPct: 15, note: "15-18% standard, similar to US." },
  { region: "United Kingdom", restaurantPct: 12, note: "10-15% if service not included. Often optional." },
  { region: "Australia", restaurantPct: 10, note: "10% appreciated but not expected. Staff paid fair wages." },
  { region: "Germany", restaurantPct: 5, note: "5-10% by rounding up the bill. Not mandatory." },
  { region: "France", restaurantPct: 0, note: "Service included (15% by law). Small change for exceptional service." },
  { region: "Japan", restaurantPct: 0, note: "No tipping. Can be considered rude." },
  { region: "India", restaurantPct: 10, note: "10% standard. Often added as 'service charge'." },
  { region: "Brazil", restaurantPct: 10, note: "10% standard, usually added to the bill." },
];

/**
 * Predefined tip presets for quick selection.
 */
export const TIP_PRESETS: ReadonlyArray<{ percent: number; label: string; description: string }> = [
  { percent: 0, label: "No tip", description: "No tip applied." },
  { percent: 10, label: "10%", description: "Minimum for basic service." },
  { percent: 15, label: "15%", description: "Standard for average service." },
  { percent: 18, label: "18%", description: "Good service (US standard)." },
  { percent: 20, label: "20%", description: "Excellent service." },
  { percent: 25, label: "25%", description: "Outstanding service." },
];

/**
 * Calculate a per-item tip split where different people ordered different items.
 */
export function calculateItemizedSplit(
  items: Array<{ name: string; price: number; person: string }>,
  tipPercent: number,
  taxPercent: number = 0,
): {
  perPerson: Array<{ person: string; subtotal: number; tip: number; tax: number; total: number; items: string[] }>;
  grandTotal: number;
  totalTip: number;
  totalTax: number;
} | { error: string } {
  if (tipPercent < 0 || tipPercent > 200) return { error: "Tip percent must be between 0 and 200." };
  if (taxPercent < 0 || taxPercent > 100) return { error: "Tax percent must be between 0 and 100." };
  if (items.length === 0) return { error: "At least one item is required." };

  const byPerson = new Map<string, { subtotal: number; items: string[] }>();
  let totalSubtotal = 0;

  for (const item of items) {
    if (item.price < 0) return { error: `Item "${item.name}" has negative price.` };
    const entry = byPerson.get(item.person) ?? { subtotal: 0, items: [] };
    entry.subtotal += item.price;
    entry.items.push(item.name);
    byPerson.set(item.person, entry);
    totalSubtotal += item.price;
  }

  const totalTip = r2(totalSubtotal * (tipPercent / 100));
  const totalTax = r2(totalSubtotal * (taxPercent / 100));
  const grandTotal = r2(totalSubtotal + totalTip + totalTax);

  const perPerson = Array.from(byPerson.entries()).map(([person, data]) => {
    const share = data.subtotal / totalSubtotal;
    return {
      person,
      subtotal: r2(data.subtotal),
      tip: r2(totalTip * share),
      tax: r2(totalTax * share),
      total: r2(data.subtotal + totalTip * share + totalTax * share),
      items: data.items,
    };
  });

  return { perPerson, grandTotal, totalTip, totalTax };
}

// ============================================================================
// NEW: Multi-format export
// ============================================================================

export interface TipResultWithExport extends TipResult {
  timestamp: string;
  inputs: TipInput;
}

export function exportResultTxt(result: TipResultWithExport): string {
  const lines = [
    "Tip Calculator — Result",
    "========================",
    `Generated: ${result.timestamp}`,
    "",
    `Subtotal: ${formatMoney(result.subtotal, result.currency)}`,
    `Tip (${result.effectiveTipPercent}%): ${formatMoney(result.tipAmount, result.currency)}`,
    `Tax: ${formatMoney(result.taxAmount, result.currency)}`,
    `Grand Total: ${formatMoney(result.grandTotal, result.currency)}`,
    "",
    `Per person: ${formatMoney(result.perPerson.total, result.currency)}`,
    `  Subtotal: ${formatMoney(result.perPerson.subtotal, result.currency)}`,
    `  Tip: ${formatMoney(result.perPerson.tip, result.currency)}`,
    `  Tax: ${formatMoney(result.perPerson.tax, result.currency)}`,
    "",
    `Rounding delta: ${formatMoney(result.roundingDelta, result.currency)}`,
    "",
    "Privacy: All calculations run in your browser.",
  ];
  return lines.join("\n");
}

export function exportResultJson(result: TipResultWithExport): string {
  return JSON.stringify(result, null, 2);
}

export function exportResultCsv(result: TipResultWithExport): string {
  const cell = (s: string | number) => {
    const str = String(s);
    return /^[=+\-@]/.test(str) ? `'${str}` : /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [
    "Field,Value",
    `Subtotal,${cell(result.subtotal)}`,
    `Tip Amount,${cell(result.tipAmount)}`,
    `Tax Amount,${cell(result.taxAmount)}`,
    `Grand Total,${cell(result.grandTotal)}`,
    `Per Person,${cell(result.perPerson.total)}`,
    `Currency,${cell(result.currency)}`,
  ].join("\n");
}

// ============================================================================
// NEW: Validation report
// ============================================================================

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateInput(input: TipInput): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (input.subtotal < 0) {
    reports.push({ level: "fail", code: "NEGATIVE_SUBTOTAL", message: "Subtotal cannot be negative." });
    return reports;
  }
  reports.push({ level: "pass", code: "VALID_SUBTOTAL", message: "Subtotal is valid." });
  if (input.tipPercent < 0) {
    reports.push({ level: "fail", code: "NEGATIVE_TIP", message: "Tip percent cannot be negative." });
  }
  if (input.tipPercent > 50) {
    reports.push({ level: "warn", code: "HIGH_TIP", message: `Tip of ${input.tipPercent}% is generous — verify this is intended.` });
  }
  if (input.tipPercent > 200) {
    reports.push({ level: "fail", code: "UNREALISTIC_TIP", message: "Tip above 200% seems unrealistic." });
  }
  const split = input.splitCount ?? 1;
  if (split < 1 || !Number.isInteger(split)) {
    reports.push({ level: "fail", code: "INVALID_SPLIT", message: "Split count must be a positive integer." });
  }
  return reports;
}

// ============================================================================
// NEW: Reproducibility receipt
// ============================================================================

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(input: TipInput): Receipt {
  const s = JSON.stringify(input);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    tool: "tip-calculator",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

// ============================================================================
// NEW: References
// ============================================================================

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "IRS-Pub531", citation: "IRS Publication 531 (2024)", summary: "Reporting tip income. US federal tipping guidelines." },
  { id: "DOL-FLSA", citation: "DOL Fact Sheet #15 (FLSA)", summary: "Tipped employee minimum wage and tip credit rules." },
];
