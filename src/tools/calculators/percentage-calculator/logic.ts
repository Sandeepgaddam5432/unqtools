/**
 * Percentage Calculator — pure logic.
 * 6 calculation modes + reverse + compound + percent error.
 */

export type PercentMode = "of" | "isWhatPercent" | "change" | "ofTotal" | "reverse" | "error";

export interface PercentInput {
  mode: PercentMode;
  a: number;
  b: number;
  /** Decimal places to round to (0-6). */
  precision?: number;
}

export interface CompoundPercentInput {
  /** Starting value. */
  initial: number;
  /** Chained percentages (e.g. [+10, -5, +20] for +10%, -5%, +20%). */
  changes: number[];
  precision?: number;
}

export interface CompoundPercentStep {
  change: number;
  valueBefore: number;
  valueAfter: number;
  cumulativeChange: number;
}

export interface CompoundPercentResult {
  steps: CompoundPercentStep[];
  finalValue: number;
  totalChangePct: number;
  multiplier: number;
}

export interface PercentResult {
  mode: PercentMode;
  result: number;
  /** Human-readable explanation of what was computed. */
  explanation: string;
}

const r = (n: number, precision = 2): number => {
  const p = Math.max(0, Math.min(6, precision));
  const factor = Math.pow(10, p);
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

export function calculatePercent(input: PercentInput): PercentResult | { error: string } {
  const { mode, a, b, precision = 2 } = input;
  if (Number.isNaN(a) || Number.isNaN(b)) return { error: "Inputs must be valid numbers." };

  switch (mode) {
    case "of": {
      // What is A% of B?
      if (a === 0) return { mode, result: 0, explanation: `0% of ${b} is 0` };
      const result = r((a / 100) * b, precision);
      return { mode, result, explanation: `${a}% of ${b} = ${result}` };
    }
    case "isWhatPercent": {
      // A is what percent of B?
      if (b === 0) return { error: "Cannot divide by zero. The second value must be non-zero." };
      const result = r((a / b) * 100, precision);
      return { mode, result, explanation: `${a} is ${result}% of ${b}` };
    }
    case "change": {
      // % change from A to B
      if (a === 0) return { error: "Cannot compute percent change from 0. Use a non-zero starting value." };
      const result = r(((b - a) / Math.abs(a)) * 100, precision);
      const direction = result > 0 ? "increase" : result < 0 ? "decrease" : "no change";
      return { mode, result, explanation: `From ${a} to ${b}: ${Math.abs(result)}% ${direction}` };
    }
    case "ofTotal": {
      // A is what % of total (A+B)?
      const total = a + b;
      if (total === 0) return { error: "Sum is zero — cannot compute percentage." };
      const result = r((a / total) * 100, precision);
      return { mode, result, explanation: `${a} is ${result}% of total (${total})` };
    }
    case "reverse": {
      // If A is the final value after B% increase, what was the original?
      if (b === -100) return { error: "Cannot reverse a -100% change (would divide by zero)." };
      const result = r(a / (1 + b / 100), precision);
      return { mode, result, explanation: `Original value before ${b}% change to reach ${a}: ${result}` };
    }
    case "error": {
      // Percent error: |A - B| / |B| * 100, where A=measured, B=accepted
      if (b === 0) return { error: "Accepted value cannot be zero." };
      const result = r((Math.abs(a - b) / Math.abs(b)) * 100, precision);
      return { mode, result, explanation: `Percent error (measured ${a}, accepted ${b}): ${result}%` };
    }
    default:
      return { error: "Unknown calculation mode." };
  }
}

export function calculateCompoundPercent(input: CompoundPercentInput): CompoundPercentResult | { error: string } {
  const { initial, changes, precision = 2 } = input;
  if (Number.isNaN(initial)) return { error: "Initial value must be a number." };
  if (!changes.length) return { error: "At least one percent change is required." };

  let value = initial;
  let multiplier = 1;
  const steps: CompoundPercentStep[] = [];
  for (const change of changes) {
    const valueBefore = value;
    value = valueBefore * (1 + change / 100);
    multiplier *= (1 + change / 100);
    steps.push({
      change,
      valueBefore: r(valueBefore, precision),
      valueAfter: r(value, precision),
      cumulativeChange: r((multiplier - 1) * 100, precision),
    });
  }
  return {
    steps,
    finalValue: r(value, precision),
    totalChangePct: r((multiplier - 1) * 100, precision),
    multiplier: r(multiplier, 6),
  };
}

/** Convert a fraction (numerator/denominator) to a percentage. */
export function fractionToPercent(numerator: number, denominator: number, precision = 2): number | { error: string } {
  if (denominator === 0) return { error: "Denominator cannot be zero." };
  return r((numerator / denominator) * 100, precision);
}

/** Convert history to CSV. */
export function historyToCsv(history: { mode: string; explanation: string; result: number; ts: number }[]): string {
  const lines = ["Timestamp,Mode,Result,Explanation"];
  for (const h of history) {
    const ts = new Date(h.ts).toISOString();
    lines.push(`${ts},${h.mode},${h.result},"${h.explanation.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}
