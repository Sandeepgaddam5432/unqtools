/**
 * Probability Calculator — pure logic. No DOM/canvas access.
 *
 * Supports:
 *  - P(A), P(B), P(A∩B), P(A∪B)
 *  - Conditional probability P(A|B), P(B|A)
 *  - Bayes' theorem P(A|B) = P(B|A)·P(A) / P(B)
 *  - Independence check: P(A∩B) ≈ P(A)·P(B)
 *  - Mutual exclusivity check: P(A∩B) = 0
 *  - Odds form: P / (1 − P) and inverse
 *  - Complement helper: 1 − P
 *  - Batch mode (compute summary for many inputs)
 *  - CSV export of batch
 *  - Format helpers (percentage, decimal, odds)
 *  - Validation of all probabilities (range, inclusion-exclusion bounds)
 *  - Permutations & combinations helpers (nPr, nCr)
 *  - Binomial distribution P(X=k) and P(X≤k)
 */
export interface ProbabilityInput {
  pA: number;
  pB: number;
  /** P(A ∩ B). If omitted, computes assuming independence (pA * pB). */
  pAB?: number;
}

export interface ProbabilitySummary {
  pA: number;
  pB: number;
  pAB: number;
  pAUB: number;
  pAGivenB: number | null;
  pBGivenA: number | null;
  pNotA: number;
  pNotB: number;
  independent: boolean;
  mutuallyExclusive: boolean;
  oddsA: number | null;
  oddsB: number | null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const isP = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
const EPS = 1e-9;

/** Validate a probability input. */
export function validateInput(input: ProbabilityInput): ProbabilityInput | { error: string } {
  if (!isP(input.pA)) return { error: "P(A) must be a number in [0,1]" };
  if (!isP(input.pB)) return { error: "P(B) must be a number in [0,1]" };
  if (input.pAB !== undefined && !isP(input.pAB)) return { error: "P(A∩B) must be in [0,1]" };
  if (input.pAB !== undefined) {
    if (input.pAB > Math.min(input.pA, input.pB) + EPS) return { error: "P(A∩B) cannot exceed min(P(A), P(B))" };
    if (input.pAB < Math.max(0, input.pA + input.pB - 1) - EPS) return { error: "P(A∩B) violates inclusion-exclusion lower bound" };
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

/** Inverse: odds → P. */
export function probFromOdds(odds: number): number | { error: string } {
  if (!Number.isFinite(odds) || odds < 0) return { error: "Odds must be ≥ 0" };
  return odds / (1 + odds);
}

/** Complement: 1 − P. */
export function complement(p: number): number | { error: string } {
  if (!isP(p)) return { error: "Probability must be in [0,1]" };
  return 1 - p;
}

/** Independence check: P(A∩B) ≈ P(A)·P(B). */
export function isIndependent(input: ProbabilityInput): boolean {
  const pAB = intersection(input);
  const expected = input.pA * input.pB;
  return Math.abs(pAB - expected) < 1e-6;
}

/** Mutual exclusivity: P(A∩B) = 0. */
export function isMutuallyExclusive(input: ProbabilityInput): boolean {
  return intersection(input) < EPS;
}

/** Full summary for one input. */
export function summarize(input: ProbabilityInput): ProbabilitySummary {
  const pAB = intersection(input);
  const aGivenB = conditionalAGivenB(input);
  const bGivenA = conditionalBGivenA(input);
  return {
    pA: input.pA,
    pB: input.pB,
    pAB,
    pAUB: union(input),
    pAGivenB: typeof aGivenB === "number" ? aGivenB : null,
    pBGivenA: typeof bGivenA === "number" ? bGivenA : null,
    pNotA: 1 - input.pA,
    pNotB: 1 - input.pB,
    independent: isIndependent(input),
    mutuallyExclusive: isMutuallyExclusive(input),
    oddsA: typeof oddsFromProb(input.pA) === "number" ? (oddsFromProb(input.pA) as number) : null,
    oddsB: typeof oddsFromProb(input.pB) === "number" ? (oddsFromProb(input.pB) as number) : null,
  };
}

/** Batch: summarize many inputs. */
export function summarizeBatch(inputs: ProbabilityInput[]): ProbabilitySummary[] {
  return inputs.map(summarize);
}

/** Permutations: nPr = n! / (n-r)!. */
export function permutations(n: number, r: number): number | { error: string } {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) return { error: "n and r must be non-negative integers" };
  if (r > n) return 0;
  let p = 1;
  for (let i = 0; i < r; i++) p *= (n - i);
  return p;
}

/** Combinations: nCr = n! / (r! · (n-r)!). */
export function combinations(n: number, r: number): number | { error: string } {
  if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0) return { error: "n and r must be non-negative integers" };
  if (r > n) return 0;
  const rMin = Math.min(r, n - r);
  let c = 1;
  for (let i = 0; i < rMin; i++) c = (c * (n - i)) / (i + 1);
  return Math.round(c);
}

/** Binomial P(X=k) for n trials, success p. */
export function binomialPmf(n: number, p: number, k: number): number | { error: string } {
  if (!Number.isInteger(n) || n < 0) return { error: "n must be a non-negative integer" };
  if (!isP(p)) return { error: "p must be in [0,1]" };
  if (!Number.isInteger(k) || k < 0 || k > n) return { error: "k must be 0..n" };
  const c = combinations(n, k);
  if (typeof c !== "number") return { error: "combinations failed" };
  return c * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

/** Binomial CDF P(X≤k). */
export function binomialCdf(n: number, p: number, k: number): number | { error: string } {
  if (!Number.isInteger(k) || k < 0 || k > n) return { error: "k must be 0..n" };
  let total = 0;
  for (let i = 0; i <= k; i++) {
    const v = binomialPmf(n, p, i);
    if (typeof v !== "number") return { error: "pmf failed" };
    total += v;
  }
  return total;
}

/** Format a probability as a percentage. */
export function formatPct(p: number): string {
  return `${(p * 100).toFixed(2)}%`;
}

/** Format a probability as a decimal (4 digits). */
export function formatDec(p: number): string {
  return p.toFixed(4);
}

/** Convert summary to CSV row (header). */
export function summaryHeader(): string {
  return "P(A),P(B),P(A∩B),P(A∪B),P(A|B),P(B|A),Independent,MutuallyExclusive,Odds(A),Odds(B)";
}

/** Convert summary to CSV row. */
export function summaryToCsv(s: ProbabilitySummary): string {
  return [
    s.pA, s.pB, s.pAB, s.pAUB,
    s.pAGivenB ?? "", s.pBGivenA ?? "",
    s.independent ? "yes" : "no",
    s.mutuallyExclusive ? "yes" : "no",
    s.oddsA ?? "", s.oddsB ?? "",
  ].join(",");
}

/** Convert a batch of summaries to a full CSV. */
export function batchToCsv(summaries: ProbabilitySummary[]): string {
  const lines = [summaryHeader()];
  for (const s of summaries) lines.push(summaryToCsv(s));
  return lines.join("\n");
}
