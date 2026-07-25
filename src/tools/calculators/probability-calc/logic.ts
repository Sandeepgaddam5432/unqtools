/**
 * Probability Calculator — pure logic. No DOM access.
 *
 * Computes union, intersection (assuming independence or via joint input),
 * conditional probability P(A|B), and Bayes' theorem P(A|B) from
 * P(B|A), P(A), P(B).
 */
export interface ProbabilityInput {
  pA: number;
  pB: number;
  /** P(A ∩ B). If omitted, computes assuming independence (pA * pB). */
  pAB?: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isP = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;

/** Validate a probability input. */
export function validateInput(input: ProbabilityInput): ProbabilityInput | { error: string } {
  if (!isP(input.pA)) return { error: "P(A) must be a number in [0,1]" };
  if (!isP(input.pB)) return { error: "P(B) must be a number in [0,1]" };
  if (input.pAB !== undefined && !isP(input.pAB)) return { error: "P(A∩B) must be in [0,1]" };
  if (input.pAB !== undefined) {
    if (input.pAB > Math.min(input.pA, input.pB) + 1e-9) return { error: "P(A∩B) cannot exceed min(P(A), P(B))" };
    if (input.pAB < Math.max(0, input.pA + input.pB - 1) - 1e-9) return { error: "P(A∩B) violates inclusion-exclusion lower bound" };
  }
  return { pA: input.pA, pB: input.pB, pAB: input.pAB };
}

/** P(A ∩ B) — uses provided value or assumes independence. */
export function intersection(input: ProbabilityInput): number {
  return input.pAB ?? input.pA * input.pB;
}

/** P(A ∪ B) = P(A) + P(B) − P(A ∩ B). */
export function union(input: ProbabilityInput): number {
  return input.pA + input.pB - intersection(input);
}

/** P(A|B) = P(A∩B) / P(B). */
export function conditionalAGivenB(input: ProbabilityInput): number | { error: string } {
  if (input.pB === 0) return { error: "P(B) is 0 — conditional undefined" };
  return intersection(input) / input.pB;
}

/** P(B|A) = P(A∩B) / P(A). */
export function conditionalBGivenA(input: ProbabilityInput): number | { error: string } {
  if (input.pA === 0) return { error: "P(A) is 0 — conditional undefined" };
  return intersection(input) / input.pA;
}

/** Bayes: P(A|B) = P(B|A) × P(A) / P(B). */
export function bayes(pA: number, pB: number, pBA: number): number | { error: string } {
  if (!isP(pA) || !isP(pB) || !isP(pBA)) return { error: "All probabilities must be in [0,1]" };
  if (pB === 0) return { error: "P(B) is 0 — Bayes undefined" };
  return clamp01((pBA * pA) / pB);
}

/** Odds form: P / (1 − P). */
export function oddsFromProb(p: number): number | { error: string } {
  if (!isP(p)) return { error: "Probability must be in [0,1]" };
  if (p === 1) return { error: "P=1 → infinite odds" };
  return p / (1 - p);
}

/** Format a probability as a percentage. */
export function formatPct(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}
