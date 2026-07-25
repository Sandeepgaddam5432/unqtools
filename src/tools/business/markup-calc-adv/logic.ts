/**
 * Markup Calculator Advanced — pure logic.
 * Markup, margin, retail price, and tax calculations.
 */

export interface MarkupInput {
  cost: number;
  markupPercent: number; // markup on cost
  taxPercent: number;
  discountPercent: number;
}

export interface MarkupResult {
  cost: number;
  markupAmount: number;
  preTaxPrice: number;
  discountAmount: number;
  discountedPrice: number;
  taxAmount: number;
  finalPrice: number;
  grossMarginPercent: number; // (price - cost) / price
  markupPercent: number;
  profit: number;
  isValid: boolean;
  error?: string;
}

/** Calculate retail price from cost + markup + discount + tax. */
export function calculateMarkup(input: MarkupInput): MarkupResult {
  if (input.cost < 0) {
    return emptyResult(input, "Cost cannot be negative.");
  }
  if (input.markupPercent < 0) {
    return emptyResult(input, "Markup cannot be negative.");
  }
  if (input.taxPercent < 0 || input.taxPercent > 100) {
    return emptyResult(input, "Tax must be between 0 and 100.");
  }
  if (input.discountPercent < 0 || input.discountPercent > 100) {
    return emptyResult(input, "Discount must be between 0 and 100.");
  }

  const markupAmount = input.cost * (input.markupPercent / 100);
  const preTaxPrice = input.cost + markupAmount;
  const discountAmount = preTaxPrice * (input.discountPercent / 100);
  const discountedPrice = preTaxPrice - discountAmount;
  const taxAmount = discountedPrice * (input.taxPercent / 100);
  const finalPrice = discountedPrice + taxAmount;
  const grossMarginPercent = finalPrice > 0 ? ((finalPrice - input.cost) / finalPrice) * 100 : 0;
  const profit = finalPrice - input.cost;

  return {
    cost: input.cost,
    markupAmount,
    preTaxPrice,
    discountAmount,
    discountedPrice,
    taxAmount,
    finalPrice,
    grossMarginPercent,
    markupPercent: input.markupPercent,
    profit,
    isValid: true,
  };
}

function emptyResult(input: MarkupInput, error: string): MarkupResult {
  return {
    cost: input.cost,
    markupAmount: 0,
    preTaxPrice: 0,
    discountAmount: 0,
    discountedPrice: 0,
    taxAmount: 0,
    finalPrice: 0,
    grossMarginPercent: 0,
    markupPercent: input.markupPercent,
    profit: 0,
    isValid: false,
    error,
  };
}

/** Reverse: given a target retail price, compute the required markup percent. */
export function markupFromTargetPrice(cost: number, targetPrice: number): number {
  if (cost <= 0) return 0;
  return ((targetPrice - cost) / cost) * 100;
}

/** Convert markup percent (on cost) to margin percent (on price). */
export function markupToMargin(markupPercent: number): number {
  // margin = markup / (1 + markup)
  const m = markupPercent / 100;
  return (m / (1 + m)) * 100;
}

/** Convert margin percent to markup percent. */
export function marginToMarkup(marginPercent: number): number {
  if (marginPercent >= 100) return Infinity;
  const m = marginPercent / 100;
  return (m / (1 - m)) * 100;
}

/** Format currency with 2 decimals. */
export function formatMoney(value: number, currency = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

/** Default input. */
export function defaultInput(): MarkupInput {
  return { cost: 100, markupPercent: 50, taxPercent: 8, discountPercent: 0 };
}
