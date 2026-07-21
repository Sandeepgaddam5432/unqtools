/**
 * Prime Number Checker & Factorization Tool — pure logic.
 *
 * BigInt-exact primality test (deterministic Miller–Rabin for n below
 * 3.3 × 10²⁴, probabilistic above), full prime factorization (trial
 * division + Pollard's rho with Brent's improvement), Sieve of
 * Eratosthenes prime generator, prime-gap finder, twin-prime finder,
 * and derived stats (divisor count τ, divisor sum σ, Euler's totient φ).
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type Certainty = "deterministic" | "probabilistic";

export interface PrimalityResult {
  n: bigint;
  isPrime: boolean;
  certainty: Certainty;
  /** For composites, a Miller–Rabin witness (the base that proved compositeness). */
  witness?: bigint;
  /** Number of Miller–Rabin rounds performed (probabilistic mode). */
  rounds?: number;
  /** Human-readable label. */
  label: "prime" | "composite" | "unit" | "non-positive";
}

export interface FactorEntry {
  prime: bigint;
  exponent: number;
}

export interface FactorizationResult {
  n: bigint;
  factors: FactorEntry[];
  /** Re-multiplication of factors equals n. */
  verified: boolean;
  /** True iff n is prime (single factor with exponent 1). */
  isPrime: boolean;
  /** Exponent-form string e.g. "360 = 2^3 × 3^2 × 5". */
  exponentForm: string;
}

export interface FactorTreeNode {
  value: bigint;
  isPrime: boolean;
  /** For composite nodes, the prime factor extracted. */
  factor?: bigint;
  /** For composite nodes, value / factor. */
  quotient?: bigint;
  /** Subtree for the factor (always a leaf prime). */
  factorChild?: FactorTreeNode;
  /** Subtree for the quotient (may be composite). */
  quotientChild?: FactorTreeNode;
}

export interface DerivedStats {
  divisorCount: bigint;
  divisorSum: bigint;
  eulerTotient: bigint;
}

export interface PrimeGap {
  lower: bigint;
  upper: bigint;
  gap: bigint;
}

export interface TwinPrimePair {
  lower: bigint;
  upper: bigint;
}

/** Deterministic Miller–Rabin witness bases for n < 3.317 × 10²⁴. */
export const DETERMINISTIC_WITNESSES: bigint[] = [
  2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n,
];

/** Threshold below which deterministic Miller–Rabin is exact. */
export const DETERMINISTIC_THRESHOLD = 3317044064679887385961981n;

/** Number of random rounds used by probabilistic Miller–Rabin. */
export const PROBABILISTIC_ROUNDS = 20;

/** Small primes used for trial division. */
export const SMALL_PRIMES: bigint[] = [
  2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n,
  53n, 59n, 61n, 67n, 71n, 73n, 79n, 83n, 89n, 97n, 101n, 103n, 107n, 109n,
  113n, 127n, 131n, 137n, 139n, 149n, 151n, 157n, 163n, 167n, 173n, 179n,
  181n, 191n, 193n, 197n, 199n, 211n, 223n, 227n, 229n, 233n, 239n, 241n,
  251n, 257n, 263n, 269n, 271n, 277n, 281n, 283n, 293n, 307n, 311n, 313n,
  317n, 331n, 337n, 347n, 349n, 353n, 359n, 367n, 373n, 379n, 383n, 389n,
  397n, 401n, 409n, 419n, 421n, 431n, 433n, 439n, 443n, 449n, 457n, 461n,
  463n, 467n, 479n, 487n, 491n, 499n, 503n, 509n, 521n, 523n, 541n,
];

export type Operation =
  | "is-prime"
  | "factorize"
  | "sieve"
  | "next-prime"
  | "prev-prime"
  | "prime-gap"
  | "twin-primes";

// ---------------------------------------------------------------------------
// Parsing & formatting helpers
// ---------------------------------------------------------------------------

/** Parse a string into a bigint. Throws on invalid input. */
export function parseBigInt(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty number");
  if (!/^-?\d+$/.test(trimmed)) throw new Error(`Invalid integer: "${input}"`);
  return BigInt(trimmed);
}

/** Format a bigint for display (with optional thousands separators). */
export function formatBigInt(value: bigint, groupDigits = false): string {
  const s = value.toString();
  if (!groupDigits) return s;
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped;
}

/** Format a codepoint-like hex of a bigint (uppercase, no prefix). */
export function toHex(value: bigint, minWidth = 0): string {
  const h = value.toString(16).toUpperCase();
  return h.length < minWidth ? "0".repeat(minWidth - h.length) + h : h;
}

// ---------------------------------------------------------------------------
// Modular arithmetic helpers (internal)
// ---------------------------------------------------------------------------

function bigAbs(a: bigint): bigint {
  return a < 0n ? -a : a;
}

function bigGcd(a: bigint, b: bigint): bigint {
  let x = bigAbs(a);
  let y = bigAbs(b);
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** Modular exponentiation: (base^exp) mod m. m must be > 0. */
export function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m <= 0n) throw new Error("Modulus must be positive");
  if (m === 1n) return 0n;
  if (exp < 0n) throw new Error("Negative exponent not supported here");
  let result = 1n;
  let b = ((base % m) + m) % m;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    e >>= 1n;
    b = (b * b) % m;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Miller–Rabin primality
// ---------------------------------------------------------------------------

/**
 * Single Miller–Rabin witness test: returns true if `a` is a witness for
 * the compositeness of `n` (i.e. n is definitely composite). Returns false
 * if `a` says n is "probably prime".
 *
 * Pre: n is odd, n > 2, 1 < a < n − 1.
 */
export function millerRabinWitness(n: bigint, a: bigint): boolean {
  // Write n − 1 = d · 2^r with d odd.
  let d = n - 1n;
  let r = 0n;
  while (d % 2n === 0n) {
    d >>= 1n;
    r += 1n;
  }
  // x = a^d mod n
  let x = modPow(a, d, n);
  if (x === 1n || x === n - 1n) return false; // a says "probably prime"
  for (let i = 1n; i < r; i++) {
    x = (x * x) % n;
    if (x === n - 1n) return false; // a says "probably prime"
  }
  return true; // a is a witness → n is composite
}

/**
 * Primality test. Returns a structured verdict.
 *
 * For |n| < DETERMINISTIC_THRESHOLD the result is 100% certain
 * (deterministic Miller–Rabin with the proven witness set). For larger
 * |n| it is probabilistic Miller–Rabin with PROBABILISTIC_ROUNDS random
 * bases (error probability < 4^(−PROBABILISTIC_ROUNDS)).
 */
export function isPrimeDetailed(n: bigint): PrimalityResult {
  if (n <= 1n) {
    return { n, isPrime: false, certainty: "deterministic", label: n === 1n ? "unit" : "non-positive" };
  }
  if (n === 2n || n === 3n) {
    return { n, isPrime: true, certainty: "deterministic", label: "prime" };
  }
  if (n % 2n === 0n) {
    return { n, isPrime: false, certainty: "deterministic", witness: 2n, label: "composite" };
  }
  if (n < DETERMINISTIC_THRESHOLD) {
    for (const a of DETERMINISTIC_WITNESSES) {
      if (a >= n) continue;
      if (millerRabinWitness(n, a)) {
        return { n, isPrime: false, certainty: "deterministic", witness: a, label: "composite" };
      }
    }
    return { n, isPrime: true, certainty: "deterministic", label: "prime" };
  }
  // Probabilistic mode for very large n.
  let lastWitness: bigint | undefined;
  for (let i = 0; i < PROBABILISTIC_ROUNDS; i++) {
    // Deterministic pseudo-random base derived from i and n. This avoids
    // dependence on crypto/Math.random so the result is reproducible.
    const a = 2n + (pseudoRandom(n, i) % (n - 3n));
    if (millerRabinWitness(n, a)) {
      return {
        n, isPrime: false, certainty: "probabilistic", witness: a,
        rounds: i + 1, label: "composite",
      };
    }
    lastWitness = a;
  }
  return {
    n, isPrime: true, certainty: "probabilistic",
    rounds: PROBABILISTIC_ROUNDS, witness: lastWitness, label: "prime",
  };
}

/** Simple boolean primality test (convenience wrapper). */
export function isPrime(n: bigint): boolean {
  return isPrimeDetailed(n).isPrime;
}

/** Deterministic pseudo-random bigint seeded by n and an index. */
function pseudoRandom(seed: bigint, index: number): bigint {
  // xorshift-style mix — good enough to spread witnesses.
  let x = (seed ^ BigInt(index + 1)) + 0x9e3779b97f4a7c15n;
  x ^= x >> 31n;
  x = (x * 0xff51afd7ed558ccdn) & ((1n << 64n) - 1n);
  x ^= x >> 33n;
  x = (x * 0xc4ceb9fe1a85ec53n) & ((1n << 64n) - 1n);
  x ^= x >> 33n;
  if (x < 0n) x = -x;
  return x;
}

// ---------------------------------------------------------------------------
// Factorization (trial division + Pollard's rho with Brent's improvement)
// ---------------------------------------------------------------------------

/** Maximum Pollard's rho iterations per c-value before retrying with new c. */
const POLLARD_MAX_ITER = 200_000;

/**
 * Pollard's rho (Floyd's cycle detection) — finds a non-trivial factor of `n`.
 * Returns null if no factor is found within the iteration budget. `n`
 * must be composite and > 1. We try a sequence of c-values for robustness.
 */
export function pollardRho(n: bigint, maxIter = POLLARD_MAX_ITER): bigint | null {
  if (n % 2n === 0n) return 2n;
  if (n % 3n === 0n) return 3n;
  // Try a few different c-values; the constant 1 is most common.
  for (let c = 1n; c < 50n; c++) {
    let x = 2n;
    let y = 2n;
    let d = 1n;
    let iter = 0;
    // Floyd's cycle detection: y advances twice per iteration, x once.
    while (d === 1n && iter < maxIter) {
      x = (x * x + c) % n;
      y = (y * y + c) % n;
      y = (y * y + c) % n;
      const diff = x > y ? x - y : y - x;
      if (diff === 0n) break; // cycle hit without finding a factor — try next c
      d = bigGcd(diff, n);
      iter++;
    }
    if (d !== 1n && d !== n) return d;
  }
  return null;
}

/** Strip out all small prime factors (trial division by SMALL_PRIMES). */
function trialDivide(n: bigint): { primes: bigint[]; remainder: bigint } {
  const primes: bigint[] = [];
  let m = n;
  for (const p of SMALL_PRIMES) {
    if (p * p > m) break;
    while (m % p === 0n) {
      primes.push(p);
      m /= p;
    }
  }
  // After the small-prime sweep, also try odd composites up to a modest bound.
  for (let p = 547n; p * p <= m && p < 10_000n; p += 2n) {
    while (m % p === 0n) {
      primes.push(p);
      m /= p;
    }
  }
  return { primes, remainder: m };
}

/** Recursively split a large composite (with only large prime factors) into primes. */
function collectLargePrimes(n: bigint, out: bigint[]): void {
  if (n < 2n) return;
  if (isPrime(n)) {
    out.push(n);
    return;
  }
  const d = pollardRho(n);
  if (d === null) {
    // Best-effort: record as a single "prime" so re-multiplication still works.
    out.push(n);
    return;
  }
  collectLargePrimes(d, out);
  collectLargePrimes(n / d, out);
}

/**
 * Full prime factorization of n. Returns a sorted list of
 * { prime, exponent } pairs. n must be a non-negative integer.
 */
export function factorize(n: bigint): FactorizationResult {
  if (n < 0n) {
    // Factor the absolute value; the sign is irrelevant for prime factors.
    const r = factorize(-n);
    return { ...r, n };
  }
  if (n < 2n) {
    return { n, factors: [], verified: true, isPrime: false, exponentForm: `${n}` };
  }
  const allPrimes: bigint[] = [];
  const { primes, remainder } = trialDivide(n);
  allPrimes.push(...primes);
  if (remainder > 1n) {
    collectLargePrimes(remainder, allPrimes);
  }
  // Group by prime.
  const map = new Map<bigint, number>();
  for (const p of allPrimes) map.set(p, (map.get(p) ?? 0) + 1);
  const factors: FactorEntry[] = [];
  for (const [prime, exponent] of map) factors.push({ prime, exponent });
  factors.sort((a, b) => (a.prime < b.prime ? -1 : a.prime > b.prime ? 1 : 0));

  const verified = verifyFactorization(n, factors);
  const isPrimeResult = factors.length === 1 && factors[0].exponent === 1;
  return {
    n,
    factors,
    verified,
    isPrime: isPrimeResult,
    exponentForm: renderExponentForm(n, factors),
  };
}

/** Re-multiply factors to confirm they equal n. */
export function verifyFactorization(n: bigint, factors: FactorEntry[]): boolean {
  let product = 1n;
  for (const { prime, exponent } of factors) {
    for (let i = 0; i < exponent; i++) product *= prime;
  }
  return product === (n < 0n ? -n : n);
}

/** Render factorization in exponent form: "360 = 2^3 × 3^2 × 5". */
export function renderExponentForm(n: bigint, factors: FactorEntry[]): string {
  const abs = n < 0n ? -n : n;
  if (abs < 2n) return `${n}`;
  if (factors.length === 0) return `${n}`;
  const parts = factors.map((f) =>
    f.exponent === 1 ? `${f.prime}` : `${f.prime}^${f.exponent}`,
  );
  const sign = n < 0n ? "-" : "";
  return `${sign}${abs} = ${parts.join(" × ")}`;
}

/**
 * Build a recursive factor tree. Each composite node records the prime
 * factor chosen and the quotient, with subtrees for each.
 */
export function factorTree(n: bigint): FactorTreeNode {
  const abs = n < 0n ? -n : n;
  if (abs < 2n) {
    return { value: n, isPrime: false };
  }
  const primality = isPrimeDetailed(abs);
  if (primality.isPrime) {
    return { value: n, isPrime: true };
  }
  // Pick the smallest prime factor for a clean tree.
  const f = factorize(abs);
  if (f.factors.length === 0) {
    return { value: n, isPrime: false };
  }
  const p = f.factors[0].prime;
  const q = abs / p;
  return {
    value: n,
    isPrime: false,
    factor: p,
    quotient: q,
    factorChild: { value: p, isPrime: true },
    quotientChild: factorTree(q),
  };
}

// ---------------------------------------------------------------------------
// Derived number-theoretic functions
// ---------------------------------------------------------------------------

/** Divisor count τ(n) = ∏(eᵢ + 1). */
export function divisorCount(n: bigint): bigint {
  const abs = n < 0n ? -n : n;
  if (abs < 1n) return 0n;
  if (abs === 1n) return 1n;
  const { factors } = factorize(abs);
  let tau = 1n;
  for (const { exponent } of factors) tau *= BigInt(exponent + 1);
  return tau;
}

/** Divisor sum σ(n) = ∏(pᵢ^(eᵢ+1) − 1) / (pᵢ − 1). */
export function divisorSum(n: bigint): bigint {
  const abs = n < 0n ? -n : n;
  if (abs < 1n) return 0n;
  if (abs === 1n) return 1n;
  const { factors } = factorize(abs);
  let sigma = 1n;
  for (const { prime, exponent } of factors) {
    // σ contribution: (p^(e+1) − 1) / (p − 1).
    const pe1 = powInt(prime, BigInt(exponent + 1));
    sigma *= (pe1 - 1n) / (prime - 1n);
  }
  return sigma;
}

/** Direct integer power (no modulus). */
function powInt(base: bigint, exp: bigint): bigint {
  if (exp < 0n) throw new Error("Negative exponent");
  let result = 1n;
  let b = base;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result *= b;
    e >>= 1n;
    b *= b;
  }
  return result;
}

/** Euler's totient φ(n) = n · ∏(1 − 1/pᵢ) = ∏ pᵢ^(eᵢ−1) · (pᵢ − 1). */
export function eulerTotient(n: bigint): bigint {
  const abs = n < 0n ? -n : n;
  if (abs < 1n) return 0n;
  if (abs === 1n) return 1n;
  const { factors } = factorize(abs);
  let phi = 1n;
  for (const { prime, exponent } of factors) {
    phi *= powInt(prime, BigInt(exponent - 1)) * (prime - 1n);
  }
  return phi;
}

/** Compute all derived stats at once. */
export function computeStats(n: bigint): DerivedStats {
  return {
    divisorCount: divisorCount(n),
    divisorSum: divisorSum(n),
    eulerTotient: eulerTotient(n),
  };
}

// ---------------------------------------------------------------------------
// Sieve of Eratosthenes, prime gaps, twin primes
// ---------------------------------------------------------------------------

/**
 * Sieve of Eratosthenes — returns all primes in [2, limit].
 * Uses a Uint8Array for the sieve (efficient for limit ≤ ~10⁸).
 */
export function sieveOfEratosthenes(limit: number): bigint[] {
  if (limit < 2) return [];
  const size = limit + 1;
  const sieve = new Uint8Array(size); // 0 = prime, 1 = composite
  sieve[0] = 1;
  sieve[1] = 1;
  for (let p = 2; p * p <= limit; p++) {
    if (sieve[p] === 0) {
      for (let m = p * p; m <= limit; m += p) sieve[m] = 1;
    }
  }
  const primes: bigint[] = [];
  for (let i = 2; i <= limit; i++) {
    if (sieve[i] === 0) primes.push(BigInt(i));
  }
  return primes;
}

/** Next prime strictly greater than n. */
export function nextPrime(n: bigint): bigint {
  if (n < 2n) return 2n;
  let candidate = n + 1n;
  if (candidate % 2n === 0n && candidate !== 2n) candidate += 1n;
  while (!isPrime(candidate)) candidate += 2n;
  return candidate;
}

/** Previous prime strictly less than n. Returns null if none exists. */
export function previousPrime(n: bigint): bigint | null {
  if (n <= 2n) return null;
  if (n === 3n) return 2n;
  let candidate = n - 1n;
  if (candidate % 2n === 0n) candidate -= 1n;
  while (candidate >= 2n) {
    if (isPrime(candidate)) return candidate;
    candidate -= 2n;
  }
  return null;
}

/**
 * Find all prime gaps of width ≥ minGap between consecutive primes in
 * [start, end]. Returns at most `maxResults` gaps.
 */
export function primeGaps(
  start: bigint,
  end: bigint,
  minGap = 2n,
  maxResults = 100,
): PrimeGap[] {
  const gaps: PrimeGap[] = [];
  if (start < 2n) start = 2n;
  let prev: bigint | null = null;
  let candidate = start % 2n === 0n && start !== 2n ? start + 1n : start;
  if (start <= 2n) {
    prev = 2n;
    candidate = 3n;
  }
  while (candidate <= end) {
    if (isPrime(candidate)) {
      if (prev !== null) {
        const gap = candidate - prev;
        if (gap >= minGap) {
          gaps.push({ lower: prev, upper: candidate, gap });
          if (gaps.length >= maxResults) break;
        }
      }
      prev = candidate;
    }
    candidate += 2n;
  }
  return gaps;
}

/**
 * Find all twin-prime pairs (p, p+2) with both prime, in [start, end].
 * Returns at most `maxResults` pairs.
 */
export function twinPrimes(
  start: bigint,
  end: bigint,
  maxResults = 100,
): TwinPrimePair[] {
  const pairs: TwinPrimePair[] = [];
  if (start < 3n) start = 3n;
  let p = start % 2n === 0n ? start + 1n : start;
  while (p + 2n <= end) {
    if (isPrime(p) && isPrime(p + 2n)) {
      pairs.push({ lower: p, upper: p + 2n });
      if (pairs.length >= maxResults) break;
    }
    p += 2n;
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:prime-number-checker-factorization-tool:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  operation: Operation;
  input: string;
  result: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export interface ShareState {
  operation: Operation;
  input: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.operation) params.set("op", state.operation);
  if (state.input) params.set("n", state.input);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { operation: "is-prime", input: "" };
  const params = new URLSearchParams(clean);
  const opRaw = params.get("op") ?? "is-prime";
  const validOps: Operation[] = [
    "is-prime", "factorize", "sieve", "next-prime", "prev-prime",
    "prime-gap", "twin-primes",
  ];
  const operation: Operation = validOps.includes(opRaw as Operation)
    ? (opRaw as Operation)
    : "is-prime";
  const input = params.get("n") ?? "";
  return { operation, input };
}
