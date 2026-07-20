/**
 * Random Number Generator (Seeded) — pure logic.
 *
 * Multiple PRNG algorithms (mulberry32, LCG, xorshift, simplified
 * Mersenne-Twister) with seed-based reproducibility. Multiple distributions
 * (uniform / normal / exponential / Poisson), unique-set mode, weighted
 * choice, Fisher-Yates shuffle, histogram preview, CSV/JSON export, and a
 * clearly-labeled CSPRNG mode using crypto.getRandomValues().
 *
 * Pure functions only — no DOM, no network. Safe to unit-test and to run
 * inside a Web Worker. All numeric state is unsigned 32-bit.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PrngAlgorithm = "mulberry32" | "lcg" | "xorshift" | "mt";

export type Distribution = "uniform" | "normal" | "exponential" | "poisson";

export interface Prng {
  /** Algorithm name. */
  algorithm: PrngAlgorithm;
  /** Original numeric seed (uint32). */
  seed: number;
  /** Returns a 32-bit unsigned integer in [0, 2^32 - 1]. */
  nextUint32(): number;
  /** Returns a float in [0, 1). */
  next(): number;
}

export interface GenerateOptions {
  algorithm: PrngAlgorithm;
  seed: number;
  count: number;
  min: number;
  max: number;
  distribution: Distribution;
  unique: boolean;
  decimals: number;
  mean: number;
  std: number;
  lambda: number;
  csprng: boolean;
}

export type GenerateResult =
  | { ok: true; values: number[]; algorithm: PrngAlgorithm | "csprng"; seed: number; distribution: Distribution }
  | { ok: false; error: string };

export interface WeightedItem<T> { item: T; weight: number; }

export interface HistogramBucket {
  min: number;
  max: number;
  count: number;
}

export interface HistoryEntry {
  ts: number;
  algorithm: PrngAlgorithm | "csprng";
  seed: number;
  distribution: Distribution;
  count: number;
  min: number;
  max: number;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants / option catalogs (UI drives off these)
// ---------------------------------------------------------------------------

export const PRNG_ALGORITHMS: ReadonlyArray<{ value: PrngAlgorithm; label: string }> = [
  { value: "mulberry32", label: "mulberry32 (fast, high quality)" },
  { value: "lcg", label: "LCG (Linear Congruential — classic)" },
  { value: "xorshift", label: "xorshift32 (tiny state)" },
  { value: "mt", label: "Mersenne-Twister (long period, excellent quality)" },
];

export const DISTRIBUTIONS: ReadonlyArray<{ value: Distribution; label: string }> = [
  { value: "uniform", label: "Uniform (integers or decimals in range)" },
  { value: "normal", label: "Normal / Gaussian (Box-Muller)" },
  { value: "exponential", label: "Exponential (rate λ)" },
  { value: "poisson", label: "Poisson (rate λ, integer output)" },
];

export const DEFAULT_OPTIONS: GenerateOptions = {
  algorithm: "mulberry32",
  seed: 42,
  count: 10,
  min: 1,
  max: 100,
  distribution: "uniform",
  unique: false,
  decimals: 0,
  mean: 0,
  std: 1,
  lambda: 1,
  csprng: false,
};

export const MAX_COUNT = 10000;

// ---------------------------------------------------------------------------
// PRNG implementations
// ---------------------------------------------------------------------------

/** Mulberry32 — fast, high quality, 32-bit state. */
export function mulberry32(seed: number): Prng {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  };
  return {
    algorithm: "mulberry32",
    seed: seed >>> 0,
    nextUint32,
    next: () => nextUint32() / 4294967296,
  };
}

/** LCG (Numerical Recipes constants: a=1664525, c=1013904223, m=2^32). */
export function lcg(seed: number): Prng {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
  return {
    algorithm: "lcg",
    seed: seed >>> 0,
    nextUint32,
    next: () => nextUint32() / 4294967296,
  };
}

/** xorshift32 — tiny state, fast. */
export function xorshift32(seed: number): Prng {
  let state = (seed >>> 0) || 1; // xorshift state must be non-zero
  const nextUint32 = (): number => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return {
    algorithm: "xorshift",
    seed: seed >>> 0,
    nextUint32,
    next: () => nextUint32() / 4294967296,
  };
}

/**
 * Simplified Mersenne-Twister (MT19937-style) — 624-element state array,
 * long period, excellent statistical quality.
 */
export function mersenneTwister(seed: number): Prng {
  const N = 624;
  const M = 397;
  const MATRIX_A = 0x9908b0df;
  const UPPER_MASK = 0x80000000;
  const LOWER_MASK = 0x7fffffff;
  const mt = new Uint32Array(N);
  mt[0] = seed >>> 0;
  for (let i = 1; i < N; i++) {
    mt[i] = (Math.imul(1812433253, mt[i - 1] ^ (mt[i - 1] >>> 30)) + i) >>> 0;
  }
  let index = N;

  const twist = (): void => {
    for (let i = 0; i < N; i++) {
      const y = (mt[i] & UPPER_MASK) | (mt[(i + 1) % N] & LOWER_MASK);
      mt[i] = mt[(i + M) % N] ^ (y >>> 1);
      if (y & 1) mt[i] = (mt[i] ^ MATRIX_A) >>> 0;
    }
    index = 0;
  };

  const nextUint32 = (): number => {
    if (index >= N) twist();
    let y = mt[index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  };

  return {
    algorithm: "mt",
    seed: seed >>> 0,
    nextUint32,
    next: () => nextUint32() / 4294967296,
  };
}

/** Factory: dispatch to the correct PRNG by algorithm name. */
export function createPrng(seed: number, algorithm: PrngAlgorithm): Prng {
  switch (algorithm) {
    case "mulberry32": return mulberry32(seed);
    case "lcg": return lcg(seed);
    case "xorshift": return xorshift32(seed);
    case "mt": return mersenneTwister(seed);
  }
}

// ---------------------------------------------------------------------------
// CSPRNG (crypto-secure) — clearly labeled, separate from seeded PRNGs
// ---------------------------------------------------------------------------

/**
 * Returns a 32-bit unsigned integer from the browser's CSPRNG.
 * Falls back to Math.random() (NOT secure) if crypto is unavailable —
 * callers must check isCsprngAvailable() before relying on this for security.
 */
export function secureRandomUint32(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] >>> 0;
  }
  // Fallback — NOT secure. Use only when security is not required.
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

/** Returns true iff the browser exposes crypto.getRandomValues(). */
export function isCsprngAvailable(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function";
}

/** A Prng-like object that draws from crypto.getRandomValues(). */
export function createCsprng(): Prng {
  return {
    algorithm: "mt" as PrngAlgorithm, // label is overridden by caller via csprng flag
    seed: 0,
    nextUint32: () => secureRandomUint32(),
    next: () => secureRandomUint32() / 4294967296,
  };
}

// ---------------------------------------------------------------------------
// Generation primitives
// ---------------------------------------------------------------------------

/** Single integer in [min, max] inclusive. */
export function nextIntInclusive(prng: Prng, min: number, max: number): number {
  if (max < min) [min, max] = [max, min];
  const range = max - min + 1;
  return min + Math.floor(prng.next() * range);
}

/** Single float in [min, max) with `decimals` precision. */
export function nextFloatIn(prng: Prng, min: number, max: number, decimals: number): number {
  if (max < min) [min, max] = [max, min];
  const v = min + (max - min) * prng.next();
  const mult = Math.pow(10, decimals);
  return Math.round(v * mult) / mult;
}

/** Box-Muller transform — Normal(mean, std). */
export function gaussian(prng: Prng, mean = 0, std = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = prng.next();
  while (v === 0) v = prng.next();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return z * std + mean;
}

/** Exponential distribution — rate λ > 0. */
export function exponential(prng: Prng, lambda = 1): number {
  if (lambda <= 0) return NaN;
  let u = 0;
  while (u === 0) u = prng.next();
  return -Math.log(u) / lambda;
}

/** Poisson distribution — Knuth's algorithm, rate λ > 0. Returns integer. */
export function poisson(prng: Prng, lambda = 1): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= prng.next();
  } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------------------
// Bulk generation
// ---------------------------------------------------------------------------

/** Generate `count` unique integers in [min, max]. Fisher-Yates partial shuffle. */
export function generateUnique(prng: Prng, count: number, min: number, max: number): number[] {
  if (max < min) [min, max] = [max, min];
  const range = max - min + 1;
  if (count > range) {
    throw new Error(`Cannot generate ${count} unique values from a range of ${range}. Max is ${range}.`);
  }
  if (count <= 0) return [];
  const pool = Array.from({ length: range }, (_, i) => min + i);
  for (let i = range - 1; i > range - 1 - count; i--) {
    const j = Math.floor(prng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(range - count);
}

/** Generate `count` uniform integers in [min, max]. */
export function generateInts(prng: Prng, count: number, min: number, max: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(nextIntInclusive(prng, min, max));
  return out;
}

/** Generate `count` uniform floats in [min, max] with `decimals` precision. */
export function generateFloats(prng: Prng, count: number, min: number, max: number, decimals: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(nextFloatIn(prng, min, max, decimals));
  return out;
}

/**
 * Execute a full GenerateOptions request. This is the top-level entry point.
 * Returns a discriminated union; on error the UI shows `error`.
 */
export function execute(opts: GenerateOptions): GenerateResult {
  if (opts.count <= 0) return { ok: false, error: "Count must be greater than 0." };
  if (opts.count > MAX_COUNT) {
    return { ok: false, error: `Count ${opts.count} exceeds maximum of ${MAX_COUNT}.` };
  }

  // CSPRNG mode — only uniform distribution is supported, no reproducibility.
  if (opts.csprng) {
    if (opts.distribution !== "uniform") {
      return { ok: false, error: "CSPRNG mode only supports the uniform distribution." };
    }
    const prng = createCsprng();
    let values: number[];
    if (opts.decimals > 0) {
      values = generateFloats(prng, opts.count, opts.min, opts.max, opts.decimals);
    } else {
      values = generateInts(prng, opts.count, opts.min, opts.max);
    }
    return { ok: true, values, algorithm: "csprng", seed: 0, distribution: opts.distribution };
  }

  const prng = createPrng(opts.seed, opts.algorithm);
  let values: number[];

  switch (opts.distribution) {
    case "uniform": {
      if (opts.unique) {
        if (opts.decimals > 0) {
          return { ok: false, error: "Unique mode is only supported for integers (decimals = 0)." };
        }
        try {
          values = generateUnique(prng, opts.count, opts.min, opts.max);
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
      } else if (opts.decimals > 0) {
        values = generateFloats(prng, opts.count, opts.min, opts.max, opts.decimals);
      } else {
        values = generateInts(prng, opts.count, opts.min, opts.max);
      }
      break;
    }
    case "normal":
      values = Array.from({ length: opts.count }, () => gaussian(prng, opts.mean, opts.std));
      break;
    case "exponential":
      values = Array.from({ length: opts.count }, () => exponential(prng, opts.lambda));
      break;
    case "poisson":
      values = Array.from({ length: opts.count }, () => poisson(prng, opts.lambda));
      break;
    default:
      return { ok: false, error: `Unknown distribution: ${opts.distribution}` };
  }

  return { ok: true, values, algorithm: opts.algorithm, seed: opts.seed, distribution: opts.distribution };
}

// ---------------------------------------------------------------------------
// Weighted choice + Fisher-Yates shuffle
// ---------------------------------------------------------------------------

/** Pick one item from a weighted list. Higher weight = higher chance. */
export function weightedChoice<T>(prng: Prng, items: WeightedItem<T>[]): T {
  if (items.length === 0) throw new Error("Cannot pick from an empty list.");
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) throw new Error("All weights are zero or negative — cannot pick.");
  let r = prng.next() * total;
  for (const it of items) {
    if (it.weight <= 0) continue;
    r -= it.weight;
    if (r < 0) return it.item;
  }
  return items[items.length - 1].item;
}

/** Fisher-Yates shuffle — returns a new shuffled array. */
export function shuffle<T>(prng: Prng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(prng.next() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Histogram preview
// ---------------------------------------------------------------------------

/** Bucket the values into `bucketCount` evenly-spaced bins. */
export function computeHistogram(values: number[], bucketCount: number): HistogramBucket[] {
  if (values.length === 0) return [];
  if (bucketCount <= 0) return [];
  let min = values[0];
  let max = values[0];
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    return [{ min, max, count: values.length }];
  }
  const span = max - min;
  const width = span / bucketCount;
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    min: min + i * width,
    max: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), bucketCount - 1);
    buckets[idx].count += 1;
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render values as plain text (one per line). */
export function renderText(values: number[]): string {
  return values.map((v) => String(v)).join("\n");
}

/** Render values as CSV (single column "value" + row numbers). */
export function renderCsv(values: number[]): string {
  const lines = ["index,value"];
  for (let i = 0; i < values.length; i++) {
    lines.push(`${i},${values[i]}`);
  }
  return lines.join("\n");
}

/** Render values as a JSON array. */
export function renderJson(values: number[]): string {
  return JSON.stringify(values);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:rng-seeded:history";
const HISTORY_MAX = 20;

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
// Shareable URL (config encoded in fragment — never sent to server)
// ---------------------------------------------------------------------------

export function buildShareUrl(opts: GenerateOptions): string {
  const params = new URLSearchParams();
  params.set("alg", opts.algorithm);
  params.set("seed", String(opts.seed));
  params.set("n", String(opts.count));
  params.set("min", String(opts.min));
  params.set("max", String(opts.max));
  params.set("dist", opts.distribution);
  params.set("u", opts.unique ? "1" : "0");
  params.set("dec", String(opts.decimals));
  params.set("mu", String(opts.mean));
  params.set("sd", String(opts.std));
  params.set("lam", String(opts.lambda));
  params.set("cs", opts.csprng ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): GenerateOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const base: GenerateOptions = { ...DEFAULT_OPTIONS };
  if (!clean) return base;
  const params = new URLSearchParams(clean);

  const alg = params.get("alg") as PrngAlgorithm | null;
  if (alg && (["mulberry32", "lcg", "xorshift", "mt"] as PrngAlgorithm[]).includes(alg)) {
    base.algorithm = alg;
  }
  const seed = Number(params.get("seed"));
  if (Number.isFinite(seed)) base.seed = seed >>> 0;
  const n = Number(params.get("n"));
  if (Number.isFinite(n) && n > 0 && n <= MAX_COUNT) base.count = Math.floor(n);
  const mn = Number(params.get("min"));
  if (Number.isFinite(mn)) base.min = mn;
  const mx = Number(params.get("max"));
  if (Number.isFinite(mx)) base.max = mx;
  const dist = params.get("dist") as Distribution | null;
  if (dist && (["uniform", "normal", "exponential", "poisson"] as Distribution[]).includes(dist)) {
    base.distribution = dist;
  }
  if (params.get("u") === "1") base.unique = true;
  if (params.get("u") === "0") base.unique = false;
  const dec = Number(params.get("dec"));
  if (Number.isFinite(dec) && dec >= 0 && dec <= 12) base.decimals = Math.floor(dec);
  const mu = Number(params.get("mu"));
  if (Number.isFinite(mu)) base.mean = mu;
  const sd = Number(params.get("sd"));
  if (Number.isFinite(sd) && sd >= 0) base.std = sd;
  const lam = Number(params.get("lam"));
  if (Number.isFinite(lam) && lam > 0) base.lambda = lam;
  if (params.get("cs") === "1") base.csprng = true;
  if (params.get("cs") === "0") base.csprng = false;
  return base;
}

// ---------------------------------------------------------------------------
// Sample
// ---------------------------------------------------------------------------

export const SAMPLE_SEED = 1729;
