/**
 * Ratio Calculator — pure logic. No DOM access.
 *
 * Simplifies a ratio a:b using GCD, and solves the proportion a:b = c:d
 * for the missing term (when one of a/b/c/d is null).
 */
export interface RatioInput {
  a: number | null;
  b: number | null;
  c: number | null;
  d: number | null;
}

export interface RatioResult {
  simplified?: { a: number; b: number };
  solved?: { missing: "a" | "b" | "c" | "d"; value: number };
  decimal?: number;
}

/** Greatest common divisor. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

/** Simplify a 2-term ratio to lowest terms. */
export function simplifyRatio(a: number, b: number): { a: number; b: number } | { error: string } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: "Both terms must be finite numbers" };
  if (a === 0 && b === 0) return { error: "Cannot simplify 0:0" };
  if (b === 0) return { a: 1, b: 0 };
  if (a === 0) return { a: 0, b: 1 };
  const g = gcd(a, b);
  return { a: a / g, b: b / g };
}

/** Solve a:b = c:d for the missing term. */
export function solveProportion(input: RatioInput): RatioResult | { error: string } {
  const { a, b, c, d } = input;
  const missing = [a, b, c, d].filter((v) => v === null).length;
  if (missing === 0) return { error: "No missing term — provide exactly one null" };
  if (missing > 1) return { error: "Exactly one term must be unknown (null)" };
  if (a === null) {
    if (!b || !c || !d) return { error: "Cannot solve — division by zero" };
    return { solved: { missing: "a", value: (b * c) / d } };
  }
  if (b === null) {
    if (!a || !c || !d) return { error: "Cannot solve — division by zero" };
    return { solved: { missing: "b", value: (a * d) / c } };
  }
  if (c === null) {
    if (!a || !b || !d) return { error: "Cannot solve — division by zero" };
    return { solved: { missing: "c", value: (a * d) / b } };
  }
  // d === null
  if (!a || !b || !c) return { error: "Cannot solve — division by zero" };
  return { solved: { missing: "d", value: (b * c) / a } };
}

/** Compute a decimal ratio a/b (with guard against /0). */
export function ratioToDecimal(a: number, b: number): number | { error: string } {
  if (b === 0) return { error: "Cannot divide by zero" };
  return a / b;
}

/** Format a ratio as "a:b". */
export function formatRatio(a: number, b: number): string {
  return `${a}:${b}`;
}
