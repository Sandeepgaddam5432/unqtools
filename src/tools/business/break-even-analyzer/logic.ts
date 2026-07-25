/**
 * Break-Even Analyzer — pure logic.
 * Compute break-even in units and revenue: BE = fixed / (price - variable).
 */

export interface BreakEvenInput {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
}

export interface BreakEvenResult {
  contributionMarginPerUnit: number;
  breakEvenUnits: number;
  breakEvenRevenue: number;
  contributionMarginRatio: number; // CM / price
  isValid: boolean;
  error?: string;
}

export function calculateBreakEven(input: BreakEvenInput): BreakEvenResult {
  if (input.fixedCosts < 0) {
    return { contributionMarginPerUnit: 0, breakEvenUnits: 0, breakEvenRevenue: 0, contributionMarginRatio: 0, isValid: false, error: "Fixed costs cannot be negative." };
  }
  if (input.variableCostPerUnit < 0) {
    return { contributionMarginPerUnit: 0, breakEvenUnits: 0, breakEvenRevenue: 0, contributionMarginRatio: 0, isValid: false, error: "Variable cost cannot be negative." };
  }
  if (input.pricePerUnit <= 0) {
    return { contributionMarginPerUnit: 0, breakEvenUnits: 0, breakEvenRevenue: 0, contributionMarginRatio: 0, isValid: false, error: "Price must be positive." };
  }
  const cm = input.pricePerUnit - input.variableCostPerUnit;
  if (cm <= 0) {
    return { contributionMarginPerUnit: cm, breakEvenUnits: Infinity, breakEvenRevenue: Infinity, contributionMarginRatio: 0, isValid: false, error: "Price must exceed variable cost to break even." };
  }
  const breakEvenUnits = input.fixedCosts / cm;
  const breakEvenRevenue = breakEvenUnits * input.pricePerUnit;
  const contributionMarginRatio = cm / input.pricePerUnit;
  return {
    contributionMarginPerUnit: cm,
    breakEvenUnits,
    breakEvenRevenue,
    contributionMarginRatio,
    isValid: true,
  };
}

/** Project profit at a given sales volume. */
export function projectProfit(input: BreakEvenInput, units: number): {
  revenue: number;
  totalCosts: number;
  profit: number;
  marginPercent: number;
} {
  const cm = input.pricePerUnit - input.variableCostPerUnit;
  const revenue = units * input.pricePerUnit;
  const totalCosts = input.fixedCosts + units * input.variableCostPerUnit;
  const profit = revenue - totalCosts;
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { revenue, totalCosts, profit, marginPercent };
}

/** Compute margin of safety: (actual - breakEven) / actual. */
export function marginOfSafety(actualUnits: number, breakEvenUnits: number): number {
  if (actualUnits <= 0) return 0;
  return ((actualUnits - breakEvenUnits) / actualUnits) * 100;
}

/** Generate a sensitivity table varying price or volume. */
export function sensitivityTable(
  input: BreakEvenInput,
  vary: "price" | "volume",
  values: number[]
): Array<{ label: string; breakEvenUnits: number; profit: number }> {
  return values.map((v) => {
    const r = calculateBreakEven(vary === "price" ? { ...input, pricePerUnit: v } : input);
    const profit = vary === "volume" ? projectProfit(input, v).profit : 0;
    return {
      label: vary === "price" ? `Price ${v}` : `Volume ${v}`,
      breakEvenUnits: r.breakEvenUnits,
      profit,
    };
  });
}

/** Format money. */
export function formatMoney(value: number, currency = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export function defaultInput(): BreakEvenInput {
  return { fixedCosts: 10000, variableCostPerUnit: 5, pricePerUnit: 25 };
}
