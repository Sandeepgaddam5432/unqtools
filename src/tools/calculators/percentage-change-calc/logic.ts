/**
 * Percentage Change Calculator — pure logic. No DOM access.
 *
 * Formula: pctChange = ((new - old) / |old|) * 100
 *  - old = 0 → undefined (error)
 *  - sign indicates direction (+ growth, - decline)
 */

export interface PctChangeInput {
  oldValue: number;
  newValue: number;
}

export interface PctChangeResult {
  change: number;
  absoluteDifference: number;
  percentChange: number;
  direction: "increase" | "decrease" | "no-change";
  multiplier: number;
}

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Compute percentage change between two values. */
export function calculatePercentageChange(input: PctChangeInput): PctChangeResult | { error: string } {
  const { oldValue, newValue } = input;
  if (!Number.isFinite(oldValue) || !Number.isFinite(newValue)) {
    return { error: "Both values must be finite numbers." };
  }
  if (oldValue === 0) {
    return { error: "Old value cannot be zero (division by zero)." };
  }
  const absDiff = newValue - oldValue;
  const pct = (absDiff / Math.abs(oldValue)) * 100;
  const direction: PctChangeResult["direction"] =
    absDiff > 0 ? "increase" : absDiff < 0 ? "decrease" : "no-change";
  const multiplier = newValue / oldValue;
  return {
    change: r2(absDiff),
    absoluteDifference: r2(absDiff),
    percentChange: r2(pct),
    direction,
    multiplier: r2(multiplier),
  };
}

/** Reverse: given old value + percent change, find the new value. */
export function newValueFromPctChange(oldValue: number, pctChange: number): { newValue: number } | { error: string } {
  if (!Number.isFinite(oldValue) || !Number.isFinite(pctChange)) {
    return { error: "Inputs must be finite numbers." };
  }
  const nv = oldValue * (1 + pctChange / 100);
  return { newValue: r2(nv) };
}

/** Reverse: given new value + percent change, find the old value. */
export function oldValueFromPctChange(newValue: number, pctChange: number): { oldValue: number } | { error: string } {
  if (!Number.isFinite(newValue) || !Number.isFinite(pctChange)) {
    return { error: "Inputs must be finite numbers." };
  }
  if (pctChange === -100) {
    return { error: "Cannot reverse a -100% change (old value would be infinite)." };
  }
  const ov = newValue / (1 + pctChange / 100);
  return { oldValue: r2(ov) };
}

/** Format a number as a percentage string with sign. */
export function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Convert a result to a CSV string. */
export function resultToCsv(r: PctChangeResult): string {
  return ["Metric,Value", `Absolute Difference,${r.absoluteDifference}`, `Percent Change,${r.percentChange}`, `Direction,${r.direction}`, `Multiplier,${r.multiplier}`].join("\n");
}
