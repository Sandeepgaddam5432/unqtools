/**
 * Discount Rate Calculator — pure logic. No DOM access.
 *
 * Discount % = ((original - sale) / original) * 100
 * Savings = original - sale
 */

export interface DiscountInput {
  originalPrice: number;
  salePrice: number;
}

export interface DiscountResult {
  originalPrice: number;
  salePrice: number;
  savings: number;
  discountRate: number;
  /** Sale price as a fraction of original (0-1). */
  priceFraction: number;
  /** Sale price as % of original. */
  salePercent: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute discount rate from original and sale prices. */
export function calculateDiscountRate(input: DiscountInput): DiscountResult | { error: string } {
  const { originalPrice, salePrice } = input;
  if (!Number.isFinite(originalPrice) || !Number.isFinite(salePrice)) {
    return { error: "Both prices must be finite numbers." };
  }
  if (originalPrice < 0) return { error: "Original price cannot be negative." };
  if (salePrice < 0) return { error: "Sale price cannot be negative." };
  if (originalPrice === 0) return { error: "Original price cannot be zero." };
  if (salePrice > originalPrice) return { error: "Sale price cannot exceed original price." };

  const savings = originalPrice - salePrice;
  const rate = (savings / originalPrice) * 100;
  const fraction = salePrice / originalPrice;
  return {
    originalPrice: r2(originalPrice),
    salePrice: r2(salePrice),
    savings: r2(savings),
    discountRate: r2(rate),
    priceFraction: r2(fraction),
    salePercent: r2(fraction * 100),
  };
}

/** Reverse: given original + discount %, find sale price. */
export function salePriceFromDiscount(originalPrice: number, discountPercent: number): { salePrice: number; savings: number } | { error: string } {
  if (!Number.isFinite(originalPrice) || !Number.isFinite(discountPercent)) {
    return { error: "Inputs must be finite numbers." };
  }
  if (originalPrice < 0) return { error: "Original price cannot be negative." };
  if (discountPercent < 0 || discountPercent > 100) return { error: "Discount percent must be 0-100." };
  const savings = originalPrice * (discountPercent / 100);
  return { salePrice: r2(originalPrice - savings), savings: r2(savings) };
}

/** Reverse: given sale price + discount %, find original price. */
export function originalPriceFromDiscount(salePrice: number, discountPercent: number): { originalPrice: number; savings: number } | { error: string } {
  if (!Number.isFinite(salePrice) || !Number.isFinite(discountPercent)) {
    return { error: "Inputs must be finite numbers." };
  }
  if (salePrice < 0) return { error: "Sale price cannot be negative." };
  if (discountPercent < 0 || discountPercent >= 100) return { error: "Discount percent must be 0-99.99 (cannot be 100%+)." };
  const original = salePrice / (1 - discountPercent / 100);
  return { originalPrice: r2(original), savings: r2(original - salePrice) };
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
export function resultToCsv(r: DiscountResult): string {
  return [
    "Metric,Value",
    `Original Price,${r.originalPrice}`,
    `Sale Price,${r.salePrice}`,
    `Savings,${r.savings}`,
    `Discount Rate,${r.discountRate}%`,
    `Sale %,${r.salePercent}%`,
  ].join("\n");
}
