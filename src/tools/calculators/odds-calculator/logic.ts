/**
 * Odds Calculator — pure logic. No DOM access.
 *
 * Converts between probability, decimal odds, fractional odds, and
 * American (moneyline) odds.
 */
export interface OddsResult {
  probability: number;
  decimal: number;
  fractional: { num: number; den: number };
  american: number;
}

const isP = (p: number) => Number.isFinite(p) && p > 0 && p < 1;

/** Greatest common divisor. */
export function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a || 1;
}

/** Simplify a fractional pair to lowest terms. */
export function simplifyFraction(num: number, den: number): { num: number; den: number } {
  const g = gcd(Math.round(num), Math.round(den));
  return { num: Math.round(num) / g, den: Math.round(den) / g };
}

/** Probability → decimal odds = 1 / p. */
export function probToDecimal(p: number): number | { error: string } {
  if (!isP(p)) return { error: "Probability must be in (0,1)" };
  return 1 / p;
}

/** Probability → fractional odds (num/den where num/den = (1-p)/p). */
export function probToFractional(p: number): { num: number; den: number } | { error: string } {
  if (!isP(p)) return { error: "Probability must be in (0,1)" };
  return simplifyFraction((1 - p) * 100, p * 100);
}

/** Probability → American odds (+ for underdog p<0.5, − for favorite p>0.5). */
export function probToAmerican(p: number): number | { error: string } {
  if (!isP(p)) return { error: "Probability must be in (0,1)" };
  if (p < 0.5) return Math.round((100 * (1 - p)) / p);
  if (p > 0.5) return -Math.round((100 * p) / (1 - p));
  return 100; // p = 0.5 → +100 (even)
}

/** Decimal → probability. */
export function decimalToProb(d: number): number | { error: string } {
  if (!Number.isFinite(d) || d <= 1) return { error: "Decimal odds must be > 1" };
  return 1 / d;
}

/** American → probability. */
export function americanToProb(a: number): number | { error: string } {
  if (!Number.isFinite(a) || a === 0) return { error: "American odds must be non-zero" };
  if (a > 0) return 100 / (a + 100);
  return -a / (-a + 100);
}

/** Full conversion from probability. */
export function fromProbability(p: number): OddsResult | { error: string } {
  if (!isP(p)) return { error: "Probability must be in (0,1)" };
  const decimal = 1 / p;
  const fractional = probToFractional(p) as { num: number; den: number };
  const american = probToAmerican(p) as number;
  return { probability: p, decimal, fractional, american };
}

/** Full conversion from decimal odds. */
export function fromDecimal(d: number): OddsResult | { error: string } {
  const p = decimalToProb(d);
  if (typeof p === "object" && p !== null) return p;
  return fromProbability(p);
}

/** Format fractional as "num/den". */
export function formatFractional(f: { num: number; den: number }): string {
  return `${f.num}/${f.den}`;
}

/** Format American with sign. */
export function formatAmerican(a: number): string {
  return a > 0 ? `+${a}` : `${a}`;
}
