/**
 * Discount Calculator — pure logic.
 */

export type DiscountType = "percent" | "fixed";

export interface DiscountStep {
  type: DiscountType;
  /** For percent: 20 means 20%. For fixed: amount in same currency as price. */
  value: number;
}

export interface DiscountInput {
  originalPrice: number;
  discounts: DiscountStep[];
  /** Tax percent applied to discounted price. Default 0. */
  taxPercent?: number;
  /** If true, tax is computed on original price then discount applied to tax. Default false. */
  taxOnOriginal?: boolean;
}

export interface DiscountResult {
  originalPrice: number;
  totalSavings: number;
  finalPrice: number;
  taxAmount: number;
  grandTotal: number;
  effectiveDiscountPct: number;
  steps: { description: string; priceAfter: number; saved: number }[];
}

export interface BogoInput {
  /** Price per unit. */
  unitPrice: number;
  /** Quantity bought. */
  quantity: number;
  /** How many must be bought to get `freeCount` free. E.g. buy 2 get 1 free → buyCount=2, freeCount=1. */
  buyCount: number;
  freeCount: number;
}

export interface BogoResult {
  paidUnits: number;
  freeUnits: number;
  totalPaid: number;
  totalSaved: number;
  effectiveDiscountPct: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateDiscount(input: DiscountInput): DiscountResult | { error: string } {
  const { originalPrice, discounts } = input;
  if (originalPrice < 0) return { error: "Original price cannot be negative." };
  if (originalPrice > 1e9) return { error: "Original price is unrealistically large." };
  if (!discounts.length) return { error: "At least one discount is required." };
  if (discounts.length > 5) return { error: "Maximum 5 stacked discounts supported." };

  for (const d of discounts) {
    if (d.type === "percent" && (d.value < 0 || d.value > 100)) {
      return { error: `Percent discount must be 0-100, got ${d.value}.` };
    }
    if (d.type === "fixed" && d.value < 0) {
      return { error: "Fixed discount cannot be negative." };
    }
  }

  let price = originalPrice;
  let totalSavings = 0;
  const steps: DiscountResult["steps"] = [];
  for (const d of discounts) {
    const priceBefore = price;
    let saved: number;
    if (d.type === "percent") {
      saved = price * (d.value / 100);
      price = price - saved;
    } else {
      saved = Math.min(d.value, price);
      price = price - saved;
    }
    totalSavings += saved;
    steps.push({
      description: d.type === "percent" ? `${d.value}% off` : `${r2(d.value)} off`,
      priceAfter: r2(Math.max(0, price)),
      saved: r2(saved),
    });
    if (price <= 0) {
      price = 0;
      break;
    }
  }

  const finalPrice = r2(Math.max(0, price));
  const taxPct = input.taxPercent ?? 0;
  let taxAmount = 0;
  if (taxPct > 0) {
    if (input.taxOnOriginal) {
      taxAmount = r2(originalPrice * (taxPct / 100));
      // Apply discount proportionally to tax
      const ratio = finalPrice / originalPrice;
      taxAmount = r2(taxAmount * ratio);
    } else {
      taxAmount = r2(finalPrice * (taxPct / 100));
    }
  }
  const grandTotal = r2(finalPrice + taxAmount);
  const effectiveDiscountPct = originalPrice > 0 ? r2((totalSavings / originalPrice) * 100) : 0;

  return {
    originalPrice: r2(originalPrice),
    totalSavings: r2(totalSavings),
    finalPrice,
    taxAmount,
    grandTotal,
    effectiveDiscountPct,
    steps,
  };
}

/** Reverse: given final price + discount %, find original. */
export function findOriginalFromDiscounted(discountedPrice: number, discountPercent: number): { originalPrice: number; savings: number } | { error: string } {
  if (discountedPrice < 0) return { error: "Discounted price cannot be negative." };
  if (discountPercent < 0 || discountPercent >= 100) return { error: "Discount percent must be 0-99.99 (cannot be 100%+)." };
  const original = discountedPrice / (1 - discountPercent / 100);
  return { originalPrice: r2(original), savings: r2(original - discountedPrice) };
}

export function calculateBogo(input: BogoInput): BogoResult | { error: string } {
  const { unitPrice, quantity, buyCount, freeCount } = input;
  if (unitPrice < 0) return { error: "Unit price cannot be negative." };
  if (quantity < 1 || !Number.isInteger(quantity)) return { error: "Quantity must be a positive integer." };
  if (buyCount < 1 || !Number.isInteger(buyCount)) return { error: "Buy count must be a positive integer." };
  if (freeCount < 1 || !Number.isInteger(freeCount)) return { error: "Free count must be a positive integer." };

  const cycle = buyCount + freeCount;
  const fullCycles = Math.floor(quantity / cycle);
  const remainder = quantity % cycle;
  // In a partial cycle, free units only kick in once `buyCount` items have been picked up.
  // Remainder covers items picked up but not yet forming a full cycle.
  // If remainder <= buyCount: those are paid items (no free bonus yet).
  // If remainder > buyCount: customer has met the buy threshold, so the extra items become free.
  const freeFromPartial = Math.max(0, Math.min(remainder - buyCount, freeCount));
  const freeUnits = fullCycles * freeCount + freeFromPartial;
  const paidUnits = quantity - freeUnits;
  const totalPaid = r2(paidUnits * unitPrice);
  const totalSaved = r2(freeUnits * unitPrice);
  const fullValue = r2(quantity * unitPrice);
  const effectiveDiscountPct = fullValue > 0 ? r2((totalSaved / fullValue) * 100) : 0;
  return { paidUnits, freeUnits, totalPaid, totalSaved, effectiveDiscountPct };
}

/** Apply threshold coupon: $X off if subtotal >= threshold. */
export function applyThresholdCoupon(subtotal: number, couponAmount: number, threshold: number): { discounted: number; couponApplied: boolean; savings: number } | { error: string } {
  if (subtotal < 0 || couponAmount < 0 || threshold < 0) return { error: "Inputs cannot be negative." };
  if (subtotal >= threshold) {
    return { discounted: r2(subtotal - couponAmount), couponApplied: true, savings: r2(couponAmount) };
  }
  return { discounted: r2(subtotal), couponApplied: false, savings: 0 };
}

/** Markup or markdown percent. */
export function markupMarkdown(price: number, percent: number, mode: "markup" | "markdown"): { finalPrice: number; difference: number } | { error: string } {
  if (price < 0) return { error: "Price cannot be negative." };
  if (percent < 0) return { error: "Percent cannot be negative." };
  const diff = price * (percent / 100);
  if (mode === "markdown") {
    return { finalPrice: r2(Math.max(0, price - diff)), difference: r2(diff) };
  }
  return { finalPrice: r2(price + diff), difference: r2(diff) };
}

export function formatMoney(amount: number, currency = "USD", locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function historyToCsv(history: { ts: number; original: number; final: number; savings: number; discounts: string }[]): string {
  const lines = ["Timestamp,OriginalPrice,FinalPrice,Savings,DiscountsApplied"];
  for (const h of history) {
    lines.push(`${new Date(h.ts).toISOString()},${h.original},${h.final},${h.savings},"${h.discounts.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}
