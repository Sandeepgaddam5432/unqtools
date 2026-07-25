/**
 * Markup Margin Calculator — pure logic. No DOM access.
 *
 * Markup % = (price - cost) / cost * 100
 * Margin % = (price - cost) / price * 100
 * Profit = price - cost
 */

export interface MarkupMarginInput {
  cost: number;
  price: number;
}

export interface MarkupMarginResult {
  cost: number;
  price: number;
  profit: number;
  markupPercent: number;
  marginPercent: number;
  /** Multiplier: price / cost. */
  markupMultiplier: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute markup % and margin % from cost + price. */
export function calculateMarkupMargin(input: MarkupMarginInput): MarkupMarginResult | { error: string } {
  const { cost, price } = input;
  if (!Number.isFinite(cost) || !Number.isFinite(price)) {
    return { error: "Both cost and price must be finite numbers." };
  }
  if (cost < 0) return { error: "Cost cannot be negative." };
  if (price < 0) return { error: "Price cannot be negative." };
  if (cost === 0) return { error: "Cost cannot be zero (markup undefined)." };
  if (price === 0) return { error: "Price cannot be zero (margin undefined)." };

  const profit = price - cost;
  const markup = (profit / cost) * 100;
  const margin = (profit / price) * 100;
  const multiplier = price / cost;
  return {
    cost: r2(cost),
    price: r2(price),
    profit: r2(profit),
    markupPercent: r2(markup),
    marginPercent: r2(margin),
    markupMultiplier: r2(multiplier),
  };
}

/** Reverse: given cost + desired markup %, find price. */
export function priceFromMarkup(cost: number, markupPercent: number): { price: number; profit: number; marginPercent: number } | { error: string } {
  if (!Number.isFinite(cost) || !Number.isFinite(markupPercent)) return { error: "Inputs must be finite." };
  if (cost < 0) return { error: "Cost cannot be negative." };
  if (markupPercent < -100) return { error: "Markup cannot be below -100%." };
  const price = cost * (1 + markupPercent / 100);
  if (price <= 0) return { error: "Resulting price must be greater than 0." };
  return { price: r2(price), profit: r2(price - cost), marginPercent: r2(((price - cost) / price) * 100) };
}

/** Reverse: given price + desired margin %, find cost. */
export function costFromMargin(price: number, marginPercent: number): { cost: number; profit: number; markupPercent: number } | { error: string } {
  if (!Number.isFinite(price) || !Number.isFinite(marginPercent)) return { error: "Inputs must be finite." };
  if (price <= 0) return { error: "Price must be greater than 0." };
  if (marginPercent >= 100) return { error: "Margin cannot be 100% or more." };
  if (marginPercent < 0) return { error: "Margin cannot be negative in this calculator." };
  const cost = price * (1 - marginPercent / 100);
  return { cost: r2(cost), profit: r2(price - cost), markupPercent: r2(((price - cost) / cost) * 100) };
}

/** Format a number as currency. */
export function formatCurrency(amount: number, locale = "en-US", currency = "USD"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Format a percentage. */
export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** Convert result to CSV. */
export function resultToCsv(r: MarkupMarginResult): string {
  return [
    "Metric,Value",
    `Cost,${r.cost}`,
    `Price,${r.price}`,
    `Profit,${r.profit}`,
    `Markup %,${r.markupPercent}%`,
    `Margin %,${r.marginPercent}%`,
    `Markup Multiplier,${r.markupMultiplier}`,
  ].join("\n");
}
