/**
 * Percentage Of Calculator — pure logic.
 * Solves X% of Y, X is what % of Y, and % change (increase/decrease).
 * Supports batch and reverse-percentage (e.g. "price after tax").
 */

export interface PctResult {
  value: number;
  formatted: string;
  formula: string;
}

const round = (n: number, dp = 4) => {
  if (!isFinite(n)) return NaN;
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
};

/** Format a number with up to `dp` decimals and thousands separators. */
export function fmt(n: number, dp = 4): string {
  if (!isFinite(n)) return "—";
  if (n === 0) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: dp });
}

/** X% of Y. */
export function percentOf(x: number, y: number): PctResult {
  const value = (x / 100) * y;
  return {
    value: round(value),
    formatted: fmt(value),
    formula: `${x}% × ${y} = ${fmt(value)}`,
  };
}

/** X is what percent of Y? Returns percentage. */
export function whatPercent(x: number, y: number): PctResult {
  if (y === 0) return { value: NaN, formatted: "—", formula: "Cannot divide by zero" };
  const value = (x / y) * 100;
  return {
    value: round(value),
    formatted: `${fmt(value)}%`,
    formula: `(${x} ÷ ${y}) × 100 = ${fmt(value)}%`,
  };
}

/** Percent change from Y to X (X − Y) / Y. */
export function percentChange(oldVal: number, newVal: number): PctResult {
  if (oldVal === 0) return { value: NaN, formatted: "—", formula: "Cannot compute % change from 0" };
  const value = ((newVal - oldVal) / Math.abs(oldVal)) * 100;
  const direction = value >= 0 ? "increase" : "decrease";
  return {
    value: round(value),
    formatted: `${fmt(value)}% ${direction}`,
    formula: `((${newVal} − ${oldVal}) ÷ |${oldVal}|) × 100 = ${fmt(value)}% (${direction})`,
  };
}

/** Reverse percentage: if final value V includes P% markup, find the original. */
export function reversePercent(finalValue: number, pct: number): PctResult {
  const value = finalValue / (1 + pct / 100);
  return {
    value: round(value),
    formatted: fmt(value),
    formula: `${finalValue} ÷ (1 + ${pct}%) = ${fmt(value)} (original before ${pct}% markup)`,
  };
}

/** Add P% to a value. */
export function addPercent(value: number, pct: number): PctResult {
  const v = value * (1 + pct / 100);
  return { value: round(v), formatted: fmt(v), formula: `${value} × (1 + ${pct}%) = ${fmt(v)}` };
}

/** Subtract P% from a value. */
export function subtractPercent(value: number, pct: number): PctResult {
  const v = value * (1 - pct / 100);
  return { value: round(v), formatted: fmt(v), formula: `${value} × (1 − ${pct}%) = ${fmt(v)}` };
}

/** Compound percentage growth over n periods. */
export function compoundGrowth(
  principal: number,
  pctPerPeriod: number,
  periods: number,
): PctResult {
  const v = principal * Math.pow(1 + pctPerPeriod / 100, periods);
  return {
    value: round(v),
    formatted: fmt(v),
    formula: `${principal} × (1 + ${pctPerPeriod}%)^${periods} = ${fmt(v)}`,
  };
}

/** Tip calculator: total bill, tip%, split between N people. */
export function tipCalc(bill: number, tipPct: number, people = 1): {
  tip: number;
  total: number;
  perPerson: number;
  formatted: { tip: string; total: string; perPerson: string };
} {
  const tip = (bill * tipPct) / 100;
  const total = bill + tip;
  const perPerson = total / Math.max(1, people);
  return {
    tip: round(tip),
    total: round(total),
    perPerson: round(perPerson),
    formatted: { tip: fmt(tip), total: fmt(total), perPerson: fmt(perPerson) },
  };
}

/** Discount calculator: original price, discount %. */
export function discountCalc(original: number, discountPct: number): {
  saved: number;
  final: number;
  formatted: { saved: string; final: string };
} {
  const saved = (original * discountPct) / 100;
  const final = original - saved;
  return {
    saved: round(saved),
    final: round(final),
    formatted: { saved: fmt(saved), final: fmt(final) },
  };
}

/** Batch: list of "X Y" pairs, apply percentage, return rows. */
export function batchPercent(rows: string, pct: number, mode: "of" | "add" | "sub" | "reverse"): string {
  return rows
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const n = parseFloat(r);
      if (!isFinite(n)) return `${r}\tINVALID`;
      let res: PctResult;
      switch (mode) {
        case "of":
          res = percentOf(pct, n);
          break;
        case "add":
          res = addPercent(n, pct);
          break;
        case "sub":
          res = subtractPercent(n, pct);
          break;
        case "reverse":
          res = reversePercent(n, pct);
          break;
      }
      return `${r}\t${res.formatted}`;
    })
    .join("\n");
}

/** Convert fraction (numerator/denominator) to percentage. */
export function fractionToPercent(num: number, denom: number): PctResult {
  return whatPercent(num, denom);
}

/** Convert decimal (0.42) to percentage (42%). */
export function decimalToPercent(d: number): PctResult {
  const v = d * 100;
  return { value: round(v), formatted: `${fmt(v)}%`, formula: `${d} × 100 = ${fmt(v)}%` };
}

/** Convert ppm/ppb to percent. */
export function ppmToPercent(ppm: number): PctResult {
  const v = ppm / 1e4;
  return { value: round(v), formatted: `${fmt(v)}%`, formula: `${ppm} ppm ÷ 10,000 = ${fmt(v)}%` };
}

/** Validate a numeric string. */
export function validateNumber(input: string): { value: number; error?: string } {
  const t = input.trim();
  if (!t) return { value: NaN, error: "Empty" };
  const v = parseFloat(t);
  if (!isFinite(v)) return { value: NaN, error: "Not a number" };
  return { value: v };
}

/** Grade calculator: score/max → percentage and letter. */
export function gradeCalc(score: number, max: number): {
  pct: number;
  letter: string;
  gpa: number;
} {
  const pct = max === 0 ? NaN : (score / max) * 100;
  let letter = "F";
  let gpa = 0;
  if (pct >= 93) { letter = "A"; gpa = 4.0; }
  else if (pct >= 90) { letter = "A-"; gpa = 3.7; }
  else if (pct >= 87) { letter = "B+"; gpa = 3.3; }
  else if (pct >= 83) { letter = "B"; gpa = 3.0; }
  else if (pct >= 80) { letter = "B-"; gpa = 2.7; }
  else if (pct >= 77) { letter = "C+"; gpa = 2.3; }
  else if (pct >= 73) { letter = "C"; gpa = 2.0; }
  else if (pct >= 70) { letter = "C-"; gpa = 1.7; }
  else if (pct >= 67) { letter = "D+"; gpa = 1.3; }
  else if (pct >= 60) { letter = "D"; gpa = 1.0; }
  return { pct: round(pct), letter, gpa };
}

/** Convert percentage to angle (for pie charts). */
export function percentToAngle(pct: number): number {
  return (pct / 100) * 360;
}

/** Convert percentage to radians. */
export function percentToRadians(pct: number): number {
  return (pct / 100) * 2 * Math.PI;
}
