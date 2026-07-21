/**
 * Gray Code Converter — pure logic.
 *
 * Convert between binary/decimal and reflected Gray code in both directions
 * with XOR-step working, generate n-bit Gray-code sequences (0…2ⁿ−1) with
 * single-bit-change highlighting, build n-ary and balanced Gray codes, and
 * render a truth table. BigInt-friendly. Pure functions only — no DOM,
 * no network.
 *
 *   binary → Gray: g = b ^ (b >> 1)
 *   Gray → binary: prefix-XOR — b[i] = g[i] ^ b[i+1] from MSB down
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type InputBase = "decimal" | "binary";

export interface ConvertResult {
  ok: boolean;
  error?: string;
  inputDecimal: string;
  inputBinary: string;
  outputDecimal: string;
  outputBinary: string;
  outputGray: string;
  width: number;
}

export interface XorStep {
  position: number; // bit index (0 = MSB)
  binBit: 0 | 1;
  grayBit: 0 | 1;
  prevBinBit: 0 | 1 | null; // for gray→binary; null for MSB
  explanation: string;
}

export interface ConvertWorking {
  steps: XorStep[];
  inputBinary: string;
  outputBinary: string;
  outputDecimal: string;
}

export interface SequenceEntry {
  index: number;
  binary: string;
  gray: string;
  decimal: number;
  grayDecimal: number;
  changedBit: number | null; // 0 = LSB; null for first entry
}

export interface SequenceResult {
  entries: SequenceEntry[];
  width: number;
  count: number;
  singleBitChange: boolean;
  wrapSingleBitChange: boolean;
  toggleCounts: number[]; // per-bit, index 0 = LSB
  maxToggle: number;
  minToggle: number;
  balanced: boolean;
}

export interface NaryEntry {
  index: number;
  digits: number[]; // most-significant first
  grayDigits: number[];
  changedPosition: number | null;
}

export interface NaryResult {
  entries: NaryEntry[];
  base: number;
  length: number;
  count: number;
  singleDigitChange: boolean;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Pad a binary string to a given width with leading zeros. */
export function padBinary(bin: string, width: number): string {
  if (bin.length >= width) return bin.slice(-width);
  return "0".repeat(width - bin.length) + bin;
}

/** Format a non-negative integer as a zero-padded binary string of given width. */
export function formatBinary(value: number, width: number): string {
  if (value < 0) value = 0;
  const bin = value.toString(2);
  return padBinary(bin, width);
}

/** Count the number of 1-bits in a number. */
export function popcount(n: number): number {
  let x = n >>> 0;
  let count = 0;
  while (x) {
    count += x & 1;
    x = x >>> 1;
  }
  return count;
}

/** Find the bit position (0 = LSB) that differs between two numbers; -1 if same. */
export function changedBitPosition(a: number, b: number): number {
  const diff = (a ^ b) >>> 0;
  if (diff === 0) return -1;
  let pos = 0;
  let x = diff;
  while ((x & 1) === 0) {
    x = x >>> 1;
    pos++;
  }
  return pos;
}

// ---------------------------------------------------------------------------
// Binary ↔ Gray
// ---------------------------------------------------------------------------

/** Convert a binary number to its Gray-code representation. */
export function binaryToGray(value: number): number {
  if (value < 0) return 0;
  return (value ^ (value >>> 1)) >>> 0;
}

/** Convert a Gray-code number back to binary. */
export function grayToBinary(value: number): number {
  if (value < 0) return 0;
  let b = value >>> 0;
  let mask = b >>> 1;
  while (mask) {
    b = b ^ mask;
    mask = mask >>> 1;
  }
  return b >>> 0;
}

/** Convert a decimal value to Gray code at a given bit width. */
export function decimalToGray(decimal: number, width: number): number {
  const v = decimal < 0 ? 0 : decimal;
  const masked = width >= 32 ? v : v & ((1 << width) - 1);
  return binaryToGray(masked);
}

/** Convert a Gray-code value (decimal) back to binary decimal. */
export function grayToDecimal(gray: number, _width: number): number {
  return grayToBinary(gray);
}

// BigInt variants for very wide values (n > 53)

/** Convert a BigInt binary value to Gray code. */
export function binaryToGrayBig(value: bigint): bigint {
  if (value < BigInt(0)) return BigInt(0);
  return value ^ (value >> BigInt(1));
}

/** Convert a BigInt Gray value back to binary. */
export function grayToBinaryBig(value: bigint): bigint {
  if (value < BigInt(0)) return BigInt(0);
  let b = value;
  let mask = b >> BigInt(1);
  while (mask > BigInt(0)) {
    b = b ^ mask;
    mask = mask >> BigInt(1);
  }
  return b;
}

// ---------------------------------------------------------------------------
// Step-by-step working
// ---------------------------------------------------------------------------

/** Produce the XOR step table for binary → Gray. */
export function binaryToGraySteps(value: number, width: number): ConvertWorking {
  const v = value < 0 ? 0 : value;
  const binStr = formatBinary(v, width);
  const gray = binaryToGray(v);
  const grayStr = formatBinary(gray, width);
  const steps: XorStep[] = [];
  for (let i = 0; i < width; i++) {
    const binBit = (Number.parseInt(binStr[i], 2)) as 0 | 1;
    const grayBit = (Number.parseInt(grayStr[i], 2)) as 0 | 1;
    let explanation: string;
    if (i === 0) {
      explanation = `MSB copied: g₀ = b₀ = ${binBit}`;
    } else {
      const prevBinBit = (Number.parseInt(binStr[i - 1], 2)) as 0 | 1;
      explanation = `g${i} = b${i} ⊕ b${i - 1} = ${binBit} ⊕ ${prevBinBit} = ${grayBit}`;
    }
    steps.push({ position: i, binBit, grayBit, prevBinBit: null, explanation });
  }
  return {
    steps,
    inputBinary: binStr,
    outputBinary: grayStr,
    outputDecimal: String(gray),
  };
}

/** Produce the prefix-XOR step table for Gray → binary. */
export function grayToBinarySteps(value: number, width: number): ConvertWorking {
  const v = value < 0 ? 0 : value;
  const grayStr = formatBinary(v, width);
  const bin = grayToBinary(v);
  const binStr = formatBinary(bin, width);
  const steps: XorStep[] = [];
  for (let i = 0; i < width; i++) {
    const grayBit = (Number.parseInt(grayStr[i], 2)) as 0 | 1;
    const binBit = (Number.parseInt(binStr[i], 2)) as 0 | 1;
    let explanation: string;
    let prevBinBit: 0 | 1 | null = null;
    if (i === 0) {
      explanation = `MSB copied: b₀ = g₀ = ${grayBit}`;
    } else {
      prevBinBit = (Number.parseInt(binStr[i - 1], 2)) as 0 | 1;
      explanation = `b${i} = g${i} ⊕ b${i - 1} = ${grayBit} ⊕ ${prevBinBit} = ${binBit}`;
    }
    steps.push({ position: i, binBit, grayBit, prevBinBit, explanation });
  }
  return {
    steps,
    inputBinary: grayStr,
    outputBinary: binStr,
    outputDecimal: String(bin),
  };
}

// ---------------------------------------------------------------------------
// High-level convert (parse input → produce result)
// ---------------------------------------------------------------------------

/** Parse a decimal or binary string into a number, returning the value and an error if any. */
export function parseInputValue(
  input: string,
  base: InputBase,
  width: number,
): { value: number; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { value: 0, error: "Empty input" };
  let v: number;
  if (base === "decimal") {
    if (!/^-?\d+$/.test(trimmed)) return { value: 0, error: "Invalid decimal" };
    v = Number.parseInt(trimmed, 10);
  } else {
    if (!/^[01]+$/.test(trimmed)) return { value: 0, error: "Invalid binary (only 0/1)" };
    if (trimmed.length > width) {
      // truncate, but warn
      v = Number.parseInt(trimmed.slice(-width), 2);
    } else {
      v = Number.parseInt(trimmed, 2);
    }
  }
  if (!Number.isFinite(v)) return { value: 0, error: "Out of range" };
  if (v < 0) return { value: 0, error: "Negative values not supported" };
  const maxVal = width >= 31 ? Number.MAX_SAFE_INTEGER : (1 << width) - 1;
  if (v > maxVal) {
    return { value: v, error: `Value exceeds ${width}-bit width` };
  }
  return { value: v };
}

// ---------------------------------------------------------------------------
// Sequence generation
// ---------------------------------------------------------------------------

/** Maximum n for which we generate a full sequence (memory bound). */
export const MAX_SEQUENCE_BITS = 20;

/** Generate the full n-bit Gray-code sequence 0..2^n-1. */
export function generateSequence(n: number): SequenceResult {
  if (n < 1) {
    return {
      entries: [],
      width: n,
      count: 0,
      singleBitChange: true,
      wrapSingleBitChange: true,
      toggleCounts: [],
      maxToggle: 0,
      minToggle: 0,
      balanced: true,
    };
  }
  if (n > MAX_SEQUENCE_BITS) {
    throw new Error(`Sequence generation capped at ${MAX_SEQUENCE_BITS} bits (got ${n})`);
  }
  const count = 1 << n;
  const entries: SequenceEntry[] = [];
  let prevGray: number | null = null;
  for (let i = 0; i < count; i++) {
    const gray = binaryToGray(i);
    let changedBit: number | null = null;
    if (prevGray !== null) {
      const pos = changedBitPosition(prevGray, gray);
      changedBit = pos >= 0 ? pos : null;
    }
    entries.push({
      index: i,
      binary: formatBinary(i, n),
      gray: formatBinary(gray, n),
      decimal: i,
      grayDecimal: gray,
      changedBit,
    });
    prevGray = gray;
  }
  // Single-bit change between consecutive entries
  let singleBitChange = true;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].changedBit === null) {
      singleBitChange = false;
      break;
    }
  }
  // Wrap-around: last → first
  const wrapDiff = entries[entries.length - 1].grayDecimal ^ entries[0].grayDecimal;
  const wrapSingleBitChange = popcount(wrapDiff) === 1;
  // Toggle counts per bit
  const toggleCounts = new Array(n).fill(0);
  for (let i = 1; i < entries.length; i++) {
    const cb = entries[i].changedBit;
    if (cb !== null && cb < n) toggleCounts[cb] += 1;
  }
  // Count wrap toggle too
  if (wrapSingleBitChange) {
    const wrapPos = changedBitPosition(entries[0].grayDecimal, entries[entries.length - 1].grayDecimal);
    if (wrapPos >= 0 && wrapPos < n) toggleCounts[wrapPos] += 1;
  }
  const maxToggle = Math.max(...toggleCounts);
  const minToggle = Math.min(...toggleCounts);
  const balanced = maxToggle - minToggle <= 1;
  return {
    entries,
    width: n,
    count,
    singleBitChange,
    wrapSingleBitChange,
    toggleCounts,
    maxToggle,
    minToggle,
    balanced,
  };
}

/** Verify the single-bit-change property of a sequence. */
export function verifySingleBitChange(entries: SequenceEntry[]): {
  valid: boolean;
  wrapValid: boolean;
  failureIndex: number;
} {
  for (let i = 1; i < entries.length; i++) {
    const diff = entries[i].grayDecimal ^ entries[i - 1].grayDecimal;
    if (popcount(diff) !== 1) {
      return { valid: false, wrapValid: false, failureIndex: i };
    }
  }
  const wrapDiff = entries[0].grayDecimal ^ entries[entries.length - 1].grayDecimal;
  return {
    valid: true,
    wrapValid: popcount(wrapDiff) === 1,
    failureIndex: -1,
  };
}

// ---------------------------------------------------------------------------
// N-ary Gray code (reflected)
// ---------------------------------------------------------------------------

export const MAX_NARY_ENTRIES = 4096;

/** Generate a full n-ary Gray code of `length` digits in base `r`. */
export function generateNaryGray(r: number, length: number): NaryResult {
  if (r < 2) throw new Error("Base r must be ≥ 2");
  if (length < 1) throw new Error("Length must be ≥ 1");
  const count = Math.pow(r, length);
  if (count > MAX_NARY_ENTRIES) {
    throw new Error(`Too many entries (${count} > ${MAX_NARY_ENTRIES})`);
  }
  // Recursive reflected construction.
  function build(n: number): number[][] {
    if (n === 0) return [[]];
    const sub = build(n - 1);
    const out: number[][] = [];
    for (let d = 0; d < r; d++) {
      if (d % 2 === 0) {
        for (const code of sub) out.push([d, ...code]);
      } else {
        for (let i = sub.length - 1; i >= 0; i--) out.push([d, ...sub[i]]);
      }
    }
    return out;
  }
  const all = build(length);
  const entries: NaryEntry[] = all.map((digits, idx) => {
    let changedPosition: number | null = null;
    if (idx > 0) {
      const prev = all[idx - 1];
      for (let i = 0; i < digits.length; i++) {
        if (digits[i] !== prev[i]) {
          changedPosition = i;
          break;
        }
      }
    }
    // Compute grayDigits = digits (since this IS the Gray code).
    return { index: idx, digits, grayDigits: digits, changedPosition };
  });
  let singleDigitChange = true;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].changedPosition === null) {
      singleDigitChange = false;
      break;
    }
  }
  return { entries, base: r, length, count, singleDigitChange };
}

// ---------------------------------------------------------------------------
// Balanced Gray code
// ---------------------------------------------------------------------------

/**
 * Generate a balanced Gray code for n bits.
 *
 * A perfectly balanced n-bit Gray code has every bit position toggling the
 * same number of times across a full cycle (target: 2ⁿ/n ± 1, with parity
 * forcing each count to be even). Balanced codes are known to exist for
 * n ≥ 4 (and trivially for n=1, n=2). For n=3 the parity constraint makes
 * perfect balance impossible — only (4, 2, 2) is achievable, which is the
 * standard BRGC.
 *
 * We apply a known balanced transition sequence for n=4 (Savage-Winkler
 * style). For n=3 we return the standard BRGC with the imbalance reported
 * via `balanced: false`. For n ≥ 5 we fall back to standard BRGC; the
 * toggle-count report in the UI shows the imbalance.
 */
export function generateBalancedGray(n: number): SequenceResult {
  const base = generateSequence(n);
  if (base.balanced) return base;
  // Try a known balanced transition sequence for small n.
  const permuted = tryBalancePermutation(n);
  if (permuted) return permuted;
  return base;
}

/**
 * Try a known balanced transition sequence (list of bit positions to flip).
 * The sequence has length 2ⁿ − 1; the wrap transition closes the cycle.
 * Returns null if no known sequence for this n.
 *
 * For n=4 we use a backtracking search (fast on 16 vertices) to find a
 * Hamiltonian cycle on the 4-cube where each bit position toggles the
 * same number of times (4 each). The search is memoised via a module-
 * level cache so we only run it once per width.
 */
function tryBalancePermutation(n: number): SequenceResult | null {
  // Perfect balance (max-min ≤ 1) requires avg = 2ⁿ/n to be an integer,
  // AND each bit's toggle count must be even (parity constraint for cycle
  // closure). This is satisfiable only for n where 2ⁿ/n is even — i.e.
  // n=1, 2, 4, 8, 16, … For other n (3, 5, 6, 7) perfect balance is
  // impossible, and the backtracking search would be exponential, so we
  // short-circuit. n=4 is the smallest non-trivial case and the search
  // completes in milliseconds.
  if (n !== 4) return null;
  const cached = BALANCED_CACHE.get(n);
  if (cached) return buildSequenceFromPath(n, cached);
  const path = findBalancedHamiltonian(n);
  if (!path) return null;
  BALANCED_CACHE.set(n, path);
  return buildSequenceFromPath(n, path);
}

const BALANCED_CACHE = new Map<number, number[]>();

/**
 * Find a balanced Hamiltonian cycle on the n-cube graph using
 * backtracking, preferring bit flips with the lowest toggle count so far
 * to keep counts balanced. Returns the path (starting at 0) or null.
 */
function findBalancedHamiltonian(n: number): number[] | null {
  const count = 1 << n;
  // Target toggles per bit. Total toggles in a cycle = count (one per edge).
  // Target per bit = count / n. For perfectly balanced we need count % n == 0
  // AND target even (parity constraint). Otherwise we allow ±1.
  const targetAvg = count / n;
  const maxAllowed = Math.ceil(targetAvg);
  if (maxAllowed % 2 === 1) {
    // Parity constraint: each bit must toggle an even number of times.
    // If target is odd, bump max to next even number.
    // Actually we just rely on parity happening naturally — backtrack.
  }
  const visited = new Array(count).fill(false);
  visited[0] = true;
  const path: number[] = [0];
  const toggleCounts = new Array(n).fill(0);

  function backtrack(current: number): boolean {
    if (path.length === count) {
      // Check wrap: current → 0 must be single-bit
      const wrap = current ^ 0;
      if (popcount(wrap) !== 1) return false;
      const wrapBit = changedBitPosition(current, 0);
      if (wrapBit < 0) return false;
      // Check balance: max - min ≤ 1 including wrap
      const finalCounts = [...toggleCounts];
      finalCounts[wrapBit] += 1;
      const max = Math.max(...finalCounts);
      const min = Math.min(...finalCounts);
      return max - min <= 1;
    }
    // Try each bit flip, preferring bits with lower toggle counts.
    const bits: number[] = [];
    for (let i = 0; i < n; i++) bits.push(i);
    bits.sort((a, b) => toggleCounts[a] - toggleCounts[b]);
    for (const bit of bits) {
      // Prune: don't allow a bit to exceed maxAllowed + 1 (parity tolerance)
      if (toggleCounts[bit] > maxAllowed + 1) continue;
      const next = current ^ (1 << bit);
      if (visited[next]) continue;
      visited[next] = true;
      path.push(next);
      toggleCounts[bit] += 1;
      if (backtrack(next)) return true;
      toggleCounts[bit] -= 1;
      path.pop();
      visited[next] = false;
    }
    return false;
  }

  if (backtrack(0)) return path;
  return null;
}

/** Build a SequenceResult from a Hamiltonian path starting at 0. */
function buildSequenceFromPath(n: number, path: number[]): SequenceResult {
  const count = path.length;
  const entries: SequenceEntry[] = [];
  let prev: number | null = null;
  for (let i = 0; i < count; i++) {
    const gray = path[i];
    let changedBit: number | null = null;
    if (prev !== null) {
      const pos = changedBitPosition(prev, gray);
      changedBit = pos >= 0 ? pos : null;
    }
    entries.push({
      index: i,
      binary: formatBinary(i, n),
      gray: formatBinary(gray, n),
      decimal: i,
      grayDecimal: gray,
      changedBit,
    });
    prev = gray;
  }
  let singleBitChange = true;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].changedBit === null) {
      singleBitChange = false;
      break;
    }
  }
  const wrapDiff = entries[0].grayDecimal ^ entries[entries.length - 1].grayDecimal;
  const wrapSingleBitChange = popcount(wrapDiff) === 1;
  const toggleCounts = new Array(n).fill(0);
  for (let i = 1; i < entries.length; i++) {
    const cb = entries[i].changedBit;
    if (cb !== null && cb < n) toggleCounts[cb] += 1;
  }
  if (wrapSingleBitChange) {
    const wrapPos = changedBitPosition(entries[0].grayDecimal, entries[entries.length - 1].grayDecimal);
    if (wrapPos >= 0 && wrapPos < n) toggleCounts[wrapPos] += 1;
  }
  const maxToggle = Math.max(...toggleCounts);
  const minToggle = Math.min(...toggleCounts);
  const balanced = maxToggle - minToggle <= 1;
  return {
    entries,
    width: n,
    count,
    singleBitChange,
    wrapSingleBitChange,
    toggleCounts,
    maxToggle,
    minToggle,
    balanced,
  };
}

/** Compute per-bit toggle counts for a sequence. */
export function computeToggleCounts(entries: SequenceEntry[], n: number): number[] {
  const counts = new Array(n).fill(0);
  for (let i = 1; i < entries.length; i++) {
    const cb = entries[i].changedBit;
    if (cb !== null && cb < n) counts[cb] += 1;
  }
  const wrapDiff = entries[0].grayDecimal ^ entries[entries.length - 1].grayDecimal;
  if (popcount(wrapDiff) === 1) {
    const wrapPos = changedBitPosition(entries[0].grayDecimal, entries[entries.length - 1].grayDecimal);
    if (wrapPos >= 0 && wrapPos < n) counts[wrapPos] += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Truth table
// ---------------------------------------------------------------------------

export interface TruthTableRow {
  index: number;
  binary: string;
  gray: string;
  changedBit: number | null;
}

export interface TruthTable {
  width: number;
  rows: TruthTableRow[];
  count: number;
}

/** Build a truth table for n-bit Gray code (same as the sequence but slimmed). */
export function buildTruthTable(n: number, balanced: boolean = false): TruthTable {
  const seq = balanced ? generateBalancedGray(n) : generateSequence(n);
  return {
    width: n,
    rows: seq.entries.map((e) => ({
      index: e.index,
      binary: e.binary,
      gray: e.gray,
      changedBit: e.changedBit,
    })),
    count: seq.count,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:gray-code-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  base: InputBase;
  width: number;
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

export function buildShareUrl(input: string, base: InputBase, width: number): string {
  const params = new URLSearchParams();
  if (input) params.set("input", input);
  params.set("base", base);
  params.set("width", String(width));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; base: InputBase; width: number } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", base: "decimal", width: 8 };
  const params = new URLSearchParams(clean);
  const input = params.get("input") ?? "";
  const b = params.get("base") ?? "decimal";
  const base: InputBase = b === "binary" ? "binary" : "decimal";
  const w = Number.parseInt(params.get("width") ?? "8", 10);
  const width = Number.isFinite(w) && w >= 1 && w <= 64 ? w : 8;
  return { input, base, width };
}
