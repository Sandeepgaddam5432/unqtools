/**
 * Modular Arithmetic & GCD/LCM Calculator — pure logic.
 *
 * BigInt-exact modular arithmetic primitives: mod, modular add/sub/mul/pow,
 * GCD/LCM, extended GCD with Bézout coefficients, modular inverse, and the
 * Chinese Remainder Theorem. Pure functions only — no DOM, no network.
 *
 * All public functions accept `bigint` and return `bigint` (or null for
 * non-existent inverses / unsolvable CRT). Throws on invalid inputs
 * (zero modulus where undefined, etc.).
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type SignConvention = "floor" | "truncated";

export const SIGN_CONVENTIONS: SignConvention[] = ["floor", "truncated"];

export interface BezoutResult {
  gcd: bigint;
  x: bigint;
  y: bigint;
}

export interface EuclidStep {
  /** Dividend at this step. */
  a: bigint;
  /** Divisor at this step. */
  b: bigint;
  /** Quotient a div b. */
  q: bigint;
  /** Remainder a mod b. */
  r: bigint;
}

export interface ExtEuclidStep {
  a: bigint;
  b: bigint;
  q: bigint;
  r: bigint;
  /** Bézout coefficient for `a` after this step. */
  x: bigint;
  /** Bézout coefficient for `b` after this step. */
  y: bigint;
}

export interface CRTCongruence {
  /** x ≡ remainder (mod modulus). */
  remainder: bigint;
  modulus: bigint;
}

export type CRTResult =
  | { ok: true; result: bigint; modulus: bigint }
  | { ok: false; error: string };

export type Operation = "mod" | "add" | "sub" | "mul" | "pow" | "gcd" | "lcm" | "inverse" | "ext-gcd" | "crt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a string into a bigint. Throws on invalid input. */
export function parseBigInt(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty number");
  if (!/^-?\d+$/.test(trimmed)) throw new Error(`Invalid integer: "${input}"`);
  return BigInt(trimmed);
}

/** Format a bigint for display (with thousands separators optional). */
export function formatBigInt(value: bigint, groupDigits = false): string {
  const s = value.toString();
  if (!groupDigits) return s;
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  const grouped = body.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (neg ? "-" : "") + grouped;
}

// ---------------------------------------------------------------------------
// Modular arithmetic primitives
// ---------------------------------------------------------------------------

/** Floor mod: result always in [0, m) for positive m. */
export function floorMod(a: bigint, m: bigint): bigint {
  if (m === 0n) throw new Error("Modulus must be non-zero");
  if (m < 0n) throw new Error("Modulus must be positive");
  const r = a % m;
  return r < 0n ? r + m : r;
}

/** Truncated mod: result has the sign of the dividend. */
export function truncMod(a: bigint, m: bigint): bigint {
  if (m === 0n) throw new Error("Modulus must be non-zero");
  if (m < 0n) throw new Error("Modulus must be positive");
  return a % m;
}

/** Modular reduction with the chosen sign convention. */
export function mod(a: bigint, m: bigint, convention: SignConvention = "floor"): bigint {
  return convention === "floor" ? floorMod(a, m) : truncMod(a, m);
}

/** Modular addition: (a + b) mod m. */
export function modAdd(a: bigint, b: bigint, m: bigint): bigint {
  if (m <= 0n) throw new Error("Modulus must be positive");
  return floorMod(floorMod(a, m) + floorMod(b, m), m);
}

/** Modular subtraction: (a - b) mod m. */
export function modSub(a: bigint, b: bigint, m: bigint): bigint {
  if (m <= 0n) throw new Error("Modulus must be positive");
  return floorMod(floorMod(a, m) - floorMod(b, m), m);
}

/** Modular multiplication: (a * b) mod m. */
export function modMul(a: bigint, b: bigint, m: bigint): bigint {
  if (m <= 0n) throw new Error("Modulus must be positive");
  return floorMod(floorMod(a, m) * floorMod(b, m), m);
}

/**
 * Modular exponentiation: (base^exp) mod m via binary exponentiation.
 * Supports negative exponents via the modular inverse (when it exists).
 */
export function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  if (m <= 0n) throw new Error("Modulus must be positive");
  if (m === 1n) return 0n;
  if (exp === 0n) return 1n;
  if (exp < 0n) {
    const inv = modInverse(base, m);
    if (inv === null) {
      throw new Error(`Modular inverse of ${base} mod ${m} does not exist; cannot compute negative exponent`);
    }
    return modPow(inv, -exp, m);
  }
  let result = 1n;
  let b = floorMod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    e >>= 1n;
    b = (b * b) % m;
  }
  return result;
}

// ---------------------------------------------------------------------------
// GCD & LCM
// ---------------------------------------------------------------------------

/** Euclidean GCD of two integers (handles negatives). */
export function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    [x, y] = [y, x % y];
  }
  return x;
}

/** GCD of a list of integers. */
export function gcdMulti(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  return values.reduce((acc, v) => gcd(acc, v));
}

/** LCM of two integers (returns 0 if either is 0). */
export function lcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  return (absA / gcd(a, b)) * absB;
}

/** LCM of a list of integers. */
export function lcmMulti(values: bigint[]): bigint {
  if (values.length === 0) return 0n;
  return values.reduce((acc, v) => lcm(acc, v));
}

// ---------------------------------------------------------------------------
// Extended Euclidean algorithm (Bézout coefficients)
// ---------------------------------------------------------------------------

/**
 * Extended Euclidean algorithm. Returns { gcd, x, y } such that
 * a·x + b·y = gcd(a, b). Handles negative inputs (sign-corrected).
 */
export function extendedGcd(a: bigint, b: bigint): BezoutResult {
  const signA = a < 0n ? -1n : 1n;
  const signB = b < 0n ? -1n : 1n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  const r = extendedGcdHelper(absA, absB);
  return { gcd: r.gcd, x: r.x * signA, y: r.y * signB };
}

function extendedGcdHelper(a: bigint, b: bigint): BezoutResult {
  if (b === 0n) return { gcd: a, x: 1n, y: 0n };
  const r = extendedGcdHelper(b, a % b);
  return { gcd: r.gcd, x: r.y, y: r.x - (a / b) * r.y };
}

/** Verify the Bézout identity: a·x + b·y should equal gcd. */
export function verifyBezout(a: bigint, b: bigint, x: bigint, y: bigint, g: bigint): boolean {
  return a * x + b * y === g;
}

/**
 * Modular inverse: returns x in [0, m) such that a·x ≡ 1 (mod m),
 * or null if no inverse exists (i.e. gcd(a, m) ≠ 1).
 */
export function modInverse(a: bigint, m: bigint): bigint | null {
  if (m <= 0n) return null;
  if (m === 1n) return 0n;
  const aNorm = floorMod(a, m);
  if (aNorm === 0n) return null;
  const ext = extendedGcd(aNorm, m);
  if (ext.gcd !== 1n) return null;
  return floorMod(ext.x, m);
}

// ---------------------------------------------------------------------------
// Step tables
// ---------------------------------------------------------------------------

/** Generate step-by-step Euclidean algorithm table. */
export function euclidSteps(a: bigint, b: bigint): EuclidStep[] {
  const steps: EuclidStep[] = [];
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) {
    const q = x / y;
    const r = x % y;
    steps.push({ a: x, b: y, q, r });
    x = y;
    y = r;
  }
  return steps;
}

/**
 * Generate step-by-step extended Euclidean algorithm table with Bézout
 * coefficients. Each step records (a, b, q, r, x, y) where x and y are
 * the Bézout coefficients for that row's (a, b). The last row's (x, y)
 * satisfies a_orig · x + b_orig · y = gcd(a, b).
 */
export function extendedEuclidSteps(a: bigint, b: bigint): ExtEuclidStep[] {
  const steps: ExtEuclidStep[] = [];
  // Use the iterative version: track (old_r, r) and (old_s, s) and (old_t, t).
  let oldR = a < 0n ? -a : a;
  let r = b < 0n ? -b : b;
  let oldS = 1n;
  let s = 0n;
  let oldT = 0n;
  let t = 1n;
  while (r !== 0n) {
    const q = oldR / r;
    const newR = oldR - q * r;
    const newS = oldS - q * s;
    const newT = oldT - q * t;
    steps.push({
      a: oldR,
      b: r,
      q,
      r: newR,
      x: newS,
      y: newT,
    });
    oldR = r;
    r = newR;
    oldS = s;
    s = newS;
    oldT = t;
    t = newT;
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Chinese Remainder Theorem
// ---------------------------------------------------------------------------

/**
 * Solve a system of congruences x ≡ r_i (mod m_i) using the pairwise-merge
 * algorithm. Supports non-coprime moduli when a solution exists.
 */
export function chineseRemainderTheorem(congruences: CRTCongruence[]): CRTResult {
  if (congruences.length === 0) return { ok: false, error: "No congruences provided" };
  for (const c of congruences) {
    if (c.modulus <= 0n) {
      return { ok: false, error: `Modulus must be positive (got ${c.modulus})` };
    }
  }
  let curR = floorMod(congruences[0].remainder, congruences[0].modulus);
  let curM = congruences[0].modulus;
  for (let i = 1; i < congruences.length; i++) {
    const { remainder: r2, modulus: m2 } = congruences[i];
    const r2Norm = floorMod(r2, m2);
    const g = gcd(curM, m2);
    const diff = r2Norm - curR;
    if (diff % g !== 0n) {
      return {
        ok: false,
        error: `No solution: gcd(${curM}, ${m2}) = ${g} does not divide (${r2Norm} − ${curR})`,
      };
    }
    const lcmM = (curM / g) * m2;
    // Solve: curM * t ≡ diff (mod m2)
    // Reduce: (curM/g) * t ≡ (diff/g) (mod m2/g)
    const m1g = curM / g;
    const m2g = m2 / g;
    const diffG = diff / g;
    const inv = modInverse(floorMod(m1g, m2g), m2g);
    if (inv === null) {
      // Shouldn't happen because gcd(m1g, m2g) = 1 by construction.
      return { ok: false, error: `Internal error: inverse of ${m1g} mod ${m2g} not found` };
    }
    const t = floorMod(diffG * inv, m2g);
    curR = floorMod(curR + curM * t, lcmM);
    curM = lcmM;
  }
  return { ok: true, result: curR, modulus: curM };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:modular-arithmetic-gcd-lcm-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  operation: Operation;
  inputs: string[];
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
  inputs: string[];
  convention: SignConvention;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.operation) params.set("op", state.operation);
  if (state.inputs.length > 0) params.set("in", state.inputs.join(","));
  if (state.convention) params.set("conv", state.convention);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { operation: "mod", inputs: [], convention: "floor" };
  const params = new URLSearchParams(clean);
  const opRaw = params.get("op") ?? "mod";
  const operation: Operation = (
    ["mod", "add", "sub", "mul", "pow", "gcd", "lcm", "inverse", "ext-gcd", "crt"] as Operation[]
  ).includes(opRaw as Operation)
    ? (opRaw as Operation)
    : "mod";
  const inRaw = params.get("in") ?? "";
  const inputs = inRaw ? inRaw.split(",").filter(Boolean) : [];
  const convRaw = params.get("conv");
  const convention: SignConvention =
    convRaw === "truncated" ? "truncated" : "floor";
  return { operation, inputs, convention };
}
