/**
 * Ratio Calculator — pure logic. No DOM access.
 *
 * Supports:
 *  - Simplify a:b using GCD (Euclidean algorithm)
 *  - Solve proportion a:b = c:d for any one missing term
 *  - Scale a ratio by a factor (multiply both terms)
 *  - Convert ratio to decimal / percentage / fraction string
 *  - Batch mode (multiple ratios) with CSV export
 *  - Ratio comparison (a:b vs c:d → which is larger?)
 *  - Continued-fraction expansion of a/b
 *  - Golden ratio / aspect-ratio helpers
 *  - Inverse ratio (b:a)
 *  - Part-to-part and part-to-whole conversions
 *  - Common aspect-ratio presets (16:9, 4:3, 21:9, etc.)
 *  - Validate inputs (finite, non-zero where required)
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

export interface AspectPreset { label: string; w: number; h: number; }

export const ASPECT_PRESETS: AspectPreset[] = [
  { label: "16:9 (widescreen)", w: 16, h: 9 },
  { label: "4:3 (standard)", w: 4, h: 3 },
  { label: "21:9 (cinema)", w: 21, h: 9 },
  { label: "1:1 (square)", w: 1, h: 1 },
  { label: "3:2 (35mm)", w: 3, h: 2 },
  { label: "9:16 (vertical)", w: 9, h: 16 },
  { label: "Golden ratio (1.618:1)", w: 1618, h: 1000 },
];

/** Greatest common divisor. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

/** Least common multiple. */
export function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
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

/** Inverse ratio: b:a. */
export function inverseRatio(a: number, b: number): { a: number; b: number } | { error: string } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: "Both terms must be finite numbers" };
  return { a: b, b: a };
}

/** Scale a ratio by a factor (both terms multiplied). */
export function scaleRatio(a: number, b: number, factor: number): { a: number; b: number } | { error: string } {
  if (!Number.isFinite(factor)) return { error: "Factor must be finite" };
  return { a: a * factor, b: b * factor };
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

/** Convert ratio to percentage string (e.g. "3:2 → 150.00%"). */
export function ratioToPercentage(a: number, b: number): string | { error: string } {
  const d = ratioToDecimal(a, b);
  if (typeof d !== "number") return d;
  return `${(d * 100).toFixed(2)}%`;
}

/** Compare two ratios a:b vs c:d → -1, 0, or 1. */
export function compareRatios(a: number, b: number, c: number, d: number): number | { error: string } {
  if (b === 0 || d === 0) return { error: "Cannot compare with zero denominator" };
  const left = a / b;
  const right = c / d;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Continued-fraction expansion of a/b. */
export function continuedFraction(a: number, b: number, maxTerms = 20): number[] | { error: string } {
  if (b === 0) return { error: "Cannot divide by zero" };
  const out: number[] = [];
  let x = a; let y = b;
  for (let i = 0; i < maxTerms && y !== 0; i++) {
    const q = Math.floor(x / y);
    out.push(q);
    [x, y] = [y, x - q * y];
  }
  return out;
}

/** Part-to-whole: given a:b, what fraction is a of the total? */
export function partToWhole(a: number, b: number): { aFraction: number; bFraction: number; total: number } | { error: string } {
  if (a + b === 0) return { error: "Total is zero" };
  const total = a + b;
  return { aFraction: a / total, bFraction: b / total, total };
}

/** Batch simplify. */
export function simplifyBatch(ratios: [number, number][]): ({ a: number; b: number } | { error: string })[] {
  return ratios.map(([a, b]) => simplifyRatio(a, b));
}

/** Convert batch of simplified ratios to CSV. */
export function batchToCsv(ratios: [number, number][], simplified: ({ a: number; b: number } | { error: string })[]): string {
  const lines = ["Input,Simplified,Decimal,Percentage"];
  for (let i = 0; i < ratios.length; i++) {
    const [a, b] = ratios[i]!;
    const s = simplified[i]!;
    if ("error" in s) lines.push(`${a}:${b},ERROR,,`);
    else {
      const dec = ratioToDecimal(s.a, s.b);
      const pct = ratioToPercentage(s.a, s.b);
      const decStr = typeof dec === "number" ? dec.toFixed(6) : "err";
      const pctStr = typeof pct === "string" ? pct : "err";
      lines.push(`${a}:${b},${s.a}:${s.b},${decStr},${pctStr}`);
    }
  }
  return lines.join("\n");
}

/** Format a ratio as "a:b". */
export function formatRatio(a: number, b: number): string {
  return `${a}:${b}`;
}

/** Format ratio as a fraction "a/b". */
export function formatFraction(a: number, b: number): string {
  return `${a}/${b}`;
}

/** Find a closest preset for a given aspect ratio. */
export function closestAspect(a: number, b: number): AspectPreset | null {
  if (b === 0) return null;
  const target = a / b;
  let best: AspectPreset | null = null;
  let bestDiff = Infinity;
  for (const p of ASPECT_PRESETS) {
    const diff = Math.abs(p.w / p.h - target);
    if (diff < bestDiff) { bestDiff = diff; best = p; }
  }
  return best;
}

/** Validate that both terms are finite numbers. */
export function validateRatio(a: number, b: number): { ok: true } | { error: string } {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { error: "Both terms must be finite numbers" };
  return { ok: true };
}
