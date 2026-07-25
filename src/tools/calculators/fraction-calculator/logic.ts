/**
 * Fraction Calculator — pure logic. No DOM access.
 *
 * Arbitrary-precision is out of scope; we use Number with a safe integer
 * path (up to 2^31 numerator/denominator) and GCD simplification.
 */
export interface Fraction {
  numerator: number;
  denominator: number;
}

/** Greatest common divisor (Euclid). */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

/** Parse a fraction from a string like "3/4" or "5". */
export function parseFraction(s: string): Fraction | { error: string } {
  const t = s.trim();
  if (!t) return { error: "Empty input" };
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

/** Format a fraction as "n/d" or "n" when denominator is 1. */
export function formatFraction(f: Fraction): string {
  const s = simplify(f);
  if (s.denominator === 1) return `${s.numerator}`;
  return `${s.numerator}/${s.denominator}`;
}

/** Decimal value of a fraction. */
export function toDecimal(f: Fraction): number {
  return f.numerator / f.denominator;
}
