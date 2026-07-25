/**
 * Fraction Calculator — pure logic. No DOM access.
 *
 * Supports:
 *  - Parse fractions from strings: "3/4", "5", "1 1/2" (mixed), "-2/3"
 *  - Add / subtract / multiply / divide
 *  - Simplify (GCD via Euclid, sign on numerator)
 *  - Mixed-number conversion (improper ↔ mixed)
 *  - Decimal ↔ fraction conversion (with rounding tolerance)
 *  - Reciprocal, negation
 *  - Comparison (less / equal / greater)
 *  - Batch mode (one expression per line)
 *  - CSV export of batch
 *  - Validate fraction (denominator ≠ 0, integer terms)
 *  - Power (fraction^n)
 *  - Find common denominators
 *  - Format as "n/d", mixed "w n/d", or decimal
 */
export interface Fraction {
  numerator: number;
  denominator: number;
}

export interface MixedNumber {
  whole: number;
  numerator: number;
  denominator: number;
}

/** Greatest common divisor (Euclid). */
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

/** Parse a fraction from a string like "3/4", "5", "1 1/2", "-2/3". */
export function parseFraction(s: string): Fraction | { error: string } {
  const t = s.trim();
  if (!t) return { error: "Empty input" };
  // Mixed number: "1 1/2" or "1 1/2"
  const mixed = t.match(/^(-?\d+)\s+(-?\d+)\s*\/\s*(-?\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]); const num = Number(mixed[2]); const den = Number(mixed[3]);
    if (!Number.isInteger(whole) || !Number.isInteger(num) || !Number.isInteger(den)) return { error: "All parts must be integers" };
    if (den === 0) return { error: "Denominator cannot be zero" };
    const sign = whole < 0 || (whole === 0 && num < 0) ? -1 : 1;
    return { numerator: sign * (Math.abs(whole) * Math.abs(den) + Math.abs(num)), denominator: Math.abs(den) };
  }
  const m = t.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (m) {
    const num = Number(m[1]); const den = Number(m[2]);
    if (!Number.isInteger(num) || !Number.isInteger(den)) return { error: "Numerator and denominator must be integers" };
    if (den === 0) return { error: "Denominator cannot be zero" };
    return { numerator: num, denominator: den };
  }
  const n = Number(t);
  if (Number.isFinite(n)) return { numerator: n, denominator: 1 };
  return { error: "Invalid fraction format" };
}

/** Simplify a fraction (sign on numerator, lowest terms). */
export function simplify(f: Fraction): Fraction {
  if (f.denominator === 0) return { numerator: NaN, denominator: NaN };
  const g = gcd(f.numerator, f.denominator);
  let num = f.numerator / g;
  let den = f.denominator / g;
  if (den < 0) { num = -num; den = -den; }
  return { numerator: num, denominator: den };
}

/** Fraction arithmetic. */
export function add(a: Fraction, b: Fraction): Fraction {
  return simplify({ numerator: a.numerator * b.denominator + b.numerator * a.denominator, denominator: a.denominator * b.denominator });
}
export function sub(a: Fraction, b: Fraction): Fraction {
  return simplify({ numerator: a.numerator * b.denominator - b.numerator * a.denominator, denominator: a.denominator * b.denominator });
}
export function mul(a: Fraction, b: Fraction): Fraction {
  return simplify({ numerator: a.numerator * b.numerator, denominator: a.denominator * b.denominator });
}
export function div(a: Fraction, b: Fraction): Fraction | { error: string } {
  if (b.numerator === 0) return { error: "Cannot divide by zero" };
  return simplify({ numerator: a.numerator * b.denominator, denominator: a.denominator * b.numerator });
}

/** Power: fraction^n (integer n). */
export function pow(f: Fraction, n: number): Fraction | { error: string } {
  if (!Number.isInteger(n)) return { error: "Exponent must be an integer" };
  if (n === 0) return { numerator: 1, denominator: 1 };
  const abs = Math.abs(n);
  let num = 1; let den = 1;
  for (let i = 0; i < abs; i++) { num *= f.numerator; den *= f.denominator; }
  return n > 0 ? simplify({ numerator: num, denominator: den }) : simplify({ numerator: den, denominator: num });
}

/** Reciprocal: 1 / f. */
export function reciprocal(f: Fraction): Fraction | { error: string } {
  if (f.numerator === 0) return { error: "Cannot take reciprocal of zero" };
  return simplify({ numerator: f.denominator, denominator: f.numerator });
}

/** Negation: -f. */
export function negate(f: Fraction): Fraction {
  return { numerator: -f.numerator, denominator: f.denominator };
}

/** Compare: -1 if a<b, 0 if equal, 1 if a>b. */
export function compare(a: Fraction, b: Fraction): number {
  const lhs = a.numerator * b.denominator;
  const rhs = b.numerator * a.denominator;
  // Account for sign of denominators
  const sign = a.denominator * b.denominator < 0 ? -1 : 1;
  const diff = (lhs - rhs) * sign;
  if (diff < 0) return -1;
  if (diff > 0) return 1;
  return 0;
}

/** Convert improper fraction → mixed number. */
export function toMixed(f: Fraction): MixedNumber {
  const s = simplify(f);
  const absNum = Math.abs(s.numerator);
  const sign = s.numerator < 0 ? -1 : 1;
  const whole = Math.floor(absNum / s.denominator) * sign;
  const num = (absNum % s.denominator) * sign;
  return { whole, numerator: num, denominator: s.denominator };
}

/** Convert mixed number → improper fraction. */
export function fromMixed(m: MixedNumber): Fraction {
  const sign = m.whole < 0 || (m.whole === 0 && m.numerator < 0) ? -1 : 1;
  return simplify({
    numerator: sign * (Math.abs(m.whole) * m.denominator + Math.abs(m.numerator)),
    denominator: m.denominator,
  });
}

/** Convert decimal to fraction (with rounding tolerance). */
export function fromDecimal(decimal: number, maxDenominator = 10000): Fraction | { error: string } {
  if (!Number.isFinite(decimal)) return { error: "Decimal must be finite" };
  const sign = decimal < 0 ? -1 : 1;
  const abs = Math.abs(decimal);
  let bestN = 1; let bestD = 1; let bestErr = Math.abs(abs - 1);
  for (let d = 1; d <= maxDenominator; d++) {
    const n = Math.round(abs * d);
    const err = Math.abs(abs - n / d);
    if (err < bestErr) { bestErr = err; bestN = n; bestD = d; }
    if (err < 1e-12) break;
  }
  return { numerator: sign * bestN, denominator: bestD };
}

/** Decimal value of a fraction. */
export function toDecimal(f: Fraction): number {
  return f.numerator / f.denominator;
}

/** Format a fraction as "n/d" or "n" when denominator is 1. */
export function formatFraction(f: Fraction): string {
  const s = simplify(f);
  if (s.denominator === 1) return `${s.numerator}`;
  return `${s.numerator}/${s.denominator}`;
}

/** Format as a mixed number string. */
export function formatMixed(f: Fraction): string {
  const m = toMixed(f);
  if (m.numerator === 0) return `${m.whole}`;
  if (m.whole === 0) return `${m.numerator}/${m.denominator}`;
  return `${m.whole} ${Math.abs(m.numerator)}/${m.denominator}`;
}

/** Validate a fraction. */
export function validateFraction(f: Fraction): { ok: true } | { error: string } {
  if (!Number.isInteger(f.numerator) || !Number.isInteger(f.denominator)) return { error: "Numerator and denominator must be integers" };
  if (f.denominator === 0) return { error: "Denominator cannot be zero" };
  return { ok: true };
}

/** Find a common denominator for two fractions. */
export function commonDenominator(a: Fraction, b: Fraction): number {
  return lcm(Math.abs(a.denominator), Math.abs(b.denominator));
}

/** Batch: parse + simplify a list of strings. */
export function parseBatch(lines: string[]): (Fraction | { error: string })[] {
  return lines.map((l) => parseFraction(l));
}

/** Convert a batch of fractions to CSV. */
export function batchToCsv(inputs: string[], parsed: (Fraction | { error: string })[]): string {
  const lines = ["Input,Simplified,Decimal,Mixed"];
  for (let i = 0; i < inputs.length; i++) {
    const f = parsed[i]!;
    if ("error" in f) lines.push(`"${inputs[i]}",ERROR,,`);
    else lines.push(`"${inputs[i]}",${formatFraction(f)},${toDecimal(f).toFixed(6)},"${formatMixed(f)}"`);
  }
  return lines.join("\n");
}

/** Parse + evaluate an expression like "1/2 + 3/4" or "1/2 * 2/3". */
export function evaluateExpression(expr: string): Fraction | { error: string } {
  // Require whitespace around the operator so '/' inside fractions isn't mistaken.
  const m = expr.match(/^\s*(\S+)\s+([+\-*/])\s+(\S+)\s*$/);
  if (!m) return { error: "Expression must be of form 'a op b' (with spaces around op)" };
  const left = parseFraction(m[1]!);
  const right = parseFraction(m[3]!);
  if ("error" in left) return left;
  if ("error" in right) return right;
  const op = m[2]!;
  if (op === "+") return add(left, right);
  if (op === "-") return sub(left, right);
  if (op === "*") return mul(left, right);
  if (op === "/") return div(left, right);
  return { error: `Unknown operator: ${op}` };
}
