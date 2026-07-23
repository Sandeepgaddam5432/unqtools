/**
 * Tip Calculator — pure logic.
 */

export interface TipInput {
  /** Bill subtotal before tax (in chosen currency). */
  subtotal: number;
  /** Tip percent (e.g. 18 for 18%). */
  tipPercent: number;
  /** Tax percent (e.g. 8.5). Optional. */
  taxPercent?: number;
  /** Number of people to split the bill. Default 1. */
  splitCount?: number;
  /** If true, calculate tip on (subtotal + tax). Default false (tip on subtotal only). */
  tipOnTax?: boolean;
  /** Rounding mode for the grand total. */
  rounding?: "none" | "up" | "down" | "nearest";
  /** Rounding increment (e.g. 0.25 for quarter, 1 for dollar). Default 1. */
  roundingIncrement?: number;
}

export interface TipResult {
  subtotal: number;
  tipAmount: number;
  taxAmount: number;
  /** Subtotal + tip + tax */
  grandTotal: number;
  perPerson: {
    subtotal: number;
    tip: number;
    tax: number;
    total: number;
  };
  /** Effective tip percent after rounding. */
  effectiveTipPercent: number;
  /** Amount added/removed by rounding (positive = added). */
  roundingDelta: number;
  currency: string;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

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

  // Rounding
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
    currency: "USD", // UI overrides per user choice
  };
}

/** Suggested tip percent based on service quality. */
export function suggestTipPercent(quality: "poor" | "ok" | "good" | "excellent"): { percent: number; reason: string } {
  switch (quality) {
    case "poor": return { percent: 10, reason: "10% — minimum courtesy tip for poor service." };
    case "ok": return { percent: 15, reason: "15% — standard tip for average service." };
    case "good": return { percent: 18, reason: "18% — good service, slightly above standard." };
    case "excellent": return { percent: 22, reason: "22% — excellent service, reward the staff." };
  }
}

/** Compare 3 tip percentages side-by-side. */
export function compareTips(subtotal: number, percents: [number, number, number]): { percent: number; tip: number; total: number }[] {
  return percents.map((p) => ({
    percent: p,
    tip: r2(subtotal * (p / 100)),
    total: r2(subtotal * (1 + p / 100)),
  }));
}

/** Format amount with currency. */
export function formatMoney(amount: number, currency = "USD", locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** History → CSV. */
export function historyToCsv(history: { ts: number; subtotal: number; tipPercent: number; tip: number; total: number; split: number }[]): string {
  const lines = ["Timestamp,Subtotal,TipPercent,TipAmount,GrandTotal,Split"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.subtotal},${h.tipPercent},${h.tip},${h.total},${h.split}`);
  }
  return lines.join("\n");
}
