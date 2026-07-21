/**
 * Hamming Code Error-Correction Calculator — pure logic.
 *
 * Encode data bits into Hamming codes (Hamming(7,4), Hamming(15,11),
 * Hamming(31,26)) with parity bits placed at powers of two, decode
 * received codewords by computing the syndrome, correct single-bit
 * errors, and detect (not correct) double-bit errors via SECDED
 * (extended Hamming with an extra overall parity bit). Pure functions
 * only — no DOM, no network.
 *
 *   positions are 1-indexed (1..n); codeword[i] = position i+1
 *   parity bit at position 2^(i-1) covers all positions whose binary
 *   address has bit (i-1) set (including the parity position itself).
 *   syndrome bit i = XOR of all covered bits (with odd-parity flip).
 *   syndrome == 0 ⇒ no error; syndrome == p ⇒ single-bit error at p.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type ParityMode = "even" | "odd";
export type HammingVariant = "hamming-7-4" | "hamming-15-11" | "hamming-31-26";

export interface HammingParams {
  /** total codeword bits (data + parity) = 2^p − 1 */
  n: number;
  /** data bits */
  k: number;
  /** parity bits */
  p: number;
}

export interface BitCell {
  /** 1-indexed position in the codeword (1..n) */
  position: number;
  /** 0-indexed array index */
  index: number;
  type: "parity" | "data";
  /** 1-indexed parity number (1..p) for parity bits */
  parityIndex?: number;
  value: 0 | 1;
}

export interface ParityCoverage {
  /** 1..p */
  parityIndex: number;
  /** 1-indexed position = 2^(parityIndex−1) */
  parityPosition: number;
  /** 1-indexed covered positions (excludes the parity bit itself) */
  coveredPositions: number[];
  /** values at covered positions */
  coveredValues: (0 | 1)[];
  /** computed parity bit value */
  computed: 0 | 1;
  mode: ParityMode;
}

export interface EncodeResult {
  params: HammingParams;
  dataBits: (0 | 1)[];
  codeword: (0 | 1)[];
  layout: BitCell[];
  coverage: ParityCoverage[];
  mode: ParityMode;
}

export interface SecdedEncodeResult extends EncodeResult {
  /** overall parity bit value (appended at position n+1) */
  overallParity: 0 | 1;
  /** codeword with the overall parity bit appended (length n+1) */
  codewordWithParity: (0 | 1)[];
}

export interface DecodeResult {
  params: HammingParams;
  received: (0 | 1)[];
  /** 0 = no error; else 1-indexed error position */
  syndrome: number;
  /** p bits, index 0 = parity 1 (LSB of syndrome) */
  syndromeBits: (0 | 1)[];
  /** 1-indexed error position, or null if none / uncorrectable */
  errorPosition: number | null;
  corrected: (0 | 1)[];
  recoveredData: (0 | 1)[];
  singleErrorCorrected: boolean;
  /** true only when SECDED detects an uncorrectable double-bit error */
  doubleErrorDetected: boolean;
  mode: ParityMode;
  isSecded: boolean;
  /** present when isSecded */
  overallParityBit?: 0 | 1;
  /** present when isSecded */
  overallParityOk?: boolean;
}

export interface InjectResult {
  original: (0 | 1)[];
  corrupted: (0 | 1)[];
  /** 1-indexed flipped position (first if multiple) */
  flippedPosition: number;
  flippedPositions: number[];
}

// ---------------------------------------------------------------------------
// Variant tables
// ---------------------------------------------------------------------------

export const VARIANTS: Record<HammingVariant, HammingParams> = {
  "hamming-7-4": { n: 7, k: 4, p: 3 },
  "hamming-15-11": { n: 15, k: 11, p: 4 },
  "hamming-31-26": { n: 31, k: 26, p: 5 },
};

export const VARIANT_LABELS: Record<HammingVariant, string> = {
  "hamming-7-4": "Hamming(7,4) — 4 data bits, 3 parity",
  "hamming-15-11": "Hamming(15,11) — 11 data bits, 4 parity",
  "hamming-31-26": "Hamming(31,26) — 26 data bits, 5 parity",
};

// ---------------------------------------------------------------------------
// Position helpers
// ---------------------------------------------------------------------------

/** Compute Hamming params {n, k, p} for an arbitrary data length k. */
export function computeParams(k: number): HammingParams {
  if (k < 1) throw new Error("k must be ≥ 1");
  let p = 1;
  while (Math.pow(2, p) < k + p + 1) p++;
  return { n: k + p, k, p };
}

/** Pick the smallest standard variant that fits k data bits. */
export function autoVariant(k: number): HammingVariant {
  if (k <= 4) return "hamming-7-4";
  if (k <= 11) return "hamming-15-11";
  return "hamming-31-26";
}

/** True if a 1-indexed position is a power of two (i.e. a parity position). */
export function isParityPosition(position: number): boolean {
  return position >= 1 && (position & (position - 1)) === 0;
}

/** Get the 1-indexed parity number (1..p) for a parity position, or null. */
export function getParityIndex(position: number): number | null {
  if (!isParityPosition(position)) return null;
  return Math.log2(position) + 1;
}

/** Get the 1-indexed positions covered by a parity bit (excluding itself). */
export function getCoveredPositions(parityPosition: number, n: number): number[] {
  const out: number[] = [];
  for (let pos = 1; pos <= n; pos++) {
    if (pos === parityPosition) continue;
    if ((pos & parityPosition) !== 0) out.push(pos);
  }
  return out;
}

/** Get the 1-indexed data (non-parity) positions for a codeword of length n. */
export function getDataPositions(n: number): number[] {
  const out: number[] = [];
  for (let pos = 1; pos <= n; pos++) {
    if (!isParityPosition(pos)) out.push(pos);
  }
  return out;
}

/** Get the 1-indexed parity positions (powers of two) for length n. */
export function getParityPositions(n: number): number[] {
  const out: number[] = [];
  for (let pos = 1; pos <= n; pos++) {
    if (isParityPosition(pos)) out.push(pos);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Parity & syndrome
// ---------------------------------------------------------------------------

/** Compute the parity bit for a given parity position over a codeword. */
export function computeParity(
  codeword: (0 | 1)[],
  parityPosition: number,
  mode: ParityMode,
): 0 | 1 {
  const n = codeword.length;
  const covered = getCoveredPositions(parityPosition, n);
  let xor = 0;
  for (const pos of covered) xor ^= codeword[pos - 1];
  // Even parity: parity bit = XOR of others (so total incl. self is even).
  // Odd parity: parity bit = NOT XOR of others (so total incl. self is odd).
  return mode === "even" ? (xor as 0 | 1) : ((1 - xor) as 0 | 1);
}

/** Compute one syndrome bit (includes the parity bit position itself). */
export function computeSyndromeBit(
  codeword: (0 | 1)[],
  parityPosition: number,
  mode: ParityMode,
): 0 | 1 {
  const n = codeword.length;
  let xor = 0;
  for (let pos = 1; pos <= n; pos++) {
    if ((pos & parityPosition) !== 0) xor ^= codeword[pos - 1];
  }
  // Even parity: no-error XOR = 0, syndrome bit = XOR.
  // Odd parity: no-error XOR = 1, syndrome bit = 1 − XOR.
  return mode === "even" ? (xor as 0 | 1) : ((1 - xor) as 0 | 1);
}

// ---------------------------------------------------------------------------
// Encode
// ---------------------------------------------------------------------------

/** Encode data bits into a Hamming codeword of the chosen variant. */
export function encode(
  dataBits: (0 | 1)[],
  variant: HammingVariant,
  mode: ParityMode,
): EncodeResult {
  const params = VARIANTS[variant];
  if (dataBits.length > params.k) {
    throw new Error(`Too many data bits: ${dataBits.length} > ${params.k}`);
  }
  const padded: (0 | 1)[] = [...dataBits];
  while (padded.length < params.k) padded.push(0);
  const codeword: (0 | 1)[] = new Array(params.n).fill(0) as (0 | 1)[];
  const dataPositions = getDataPositions(params.n);
  for (let i = 0; i < params.k; i++) {
    codeword[dataPositions[i] - 1] = padded[i];
  }
  const parityPositions = getParityPositions(params.n);
  for (const pp of parityPositions) {
    codeword[pp - 1] = computeParity(codeword, pp, mode);
  }
  return {
    params,
    dataBits: padded,
    codeword,
    layout: buildLayout(codeword, params.n),
    coverage: buildCoverage(codeword, params.n, mode),
    mode,
  };
}

/** Encode with an extra overall parity bit for SECDED (extended Hamming). */
export function encodeSecded(
  dataBits: (0 | 1)[],
  variant: HammingVariant,
  mode: ParityMode,
): SecdedEncodeResult {
  const base = encode(dataBits, variant, mode);
  let xor = 0;
  for (const b of base.codeword) xor ^= b;
  const overallParity: 0 | 1 = mode === "even" ? (xor as 0 | 1) : ((1 - xor) as 0 | 1);
  const codewordWithParity: (0 | 1)[] = [...base.codeword, overallParity];
  return { ...base, overallParity, codewordWithParity };
}

// ---------------------------------------------------------------------------
// Decode (no SECDED)
// ---------------------------------------------------------------------------

/** Decode a received codeword and correct a single-bit error if present. */
export function decode(
  received: (0 | 1)[],
  variant: HammingVariant,
  mode: ParityMode,
): DecodeResult {
  const params = VARIANTS[variant];
  if (received.length !== params.n) {
    throw new Error(`Expected ${params.n} bits, got ${received.length}`);
  }
  const parityPositions = getParityPositions(params.n);
  let syndrome = 0;
  const syndromeBits: (0 | 1)[] = new Array(params.p).fill(0) as (0 | 1)[];
  for (const pp of parityPositions) {
    const pIdx = getParityIndex(pp)!;
    const bit = computeSyndromeBit(received, pp, mode);
    syndromeBits[pIdx - 1] = bit;
    if (bit) syndrome |= 1 << (pIdx - 1);
  }
  const corrected: (0 | 1)[] = [...received] as (0 | 1)[];
  let errorPosition: number | null = null;
  let singleErrorCorrected = false;
  if (syndrome !== 0 && syndrome <= params.n) {
    errorPosition = syndrome;
    corrected[syndrome - 1] = (corrected[syndrome - 1] ^ 1) as 0 | 1;
    singleErrorCorrected = true;
  }
  const dataPositions = getDataPositions(params.n);
  const recoveredData: (0 | 1)[] = dataPositions.map((p) => corrected[p - 1]);
  return {
    params,
    received,
    syndrome,
    syndromeBits,
    errorPosition,
    corrected,
    recoveredData,
    singleErrorCorrected,
    doubleErrorDetected: false,
    mode,
    isSecded: false,
  };
}

// ---------------------------------------------------------------------------
// Decode with SECDED
// ---------------------------------------------------------------------------

/** Decode a SECDED (extended Hamming) codeword; detect double-bit errors. */
export function decodeSecded(
  received: (0 | 1)[],
  variant: HammingVariant,
  mode: ParityMode,
): DecodeResult {
  const params = VARIANTS[variant];
  const totalLen = params.n + 1;
  if (received.length !== totalLen) {
    throw new Error(`Expected ${totalLen} bits (incl. overall parity), got ${received.length}`);
  }
  const inner: (0 | 1)[] = received.slice(0, params.n) as (0 | 1)[];
  const overallParityBit = received[params.n];
  const parityPositions = getParityPositions(params.n);
  let syndrome = 0;
  const syndromeBits: (0 | 1)[] = new Array(params.p).fill(0) as (0 | 1)[];
  for (const pp of parityPositions) {
    const pIdx = getParityIndex(pp)!;
    const bit = computeSyndromeBit(inner, pp, mode);
    syndromeBits[pIdx - 1] = bit;
    if (bit) syndrome |= 1 << (pIdx - 1);
  }
  // Overall parity check over all n+1 bits.
  let overallXor = 0;
  for (const b of received) overallXor ^= b;
  const overallParityOk = mode === "even" ? overallXor === 0 : overallXor === 1;

  const corrected: (0 | 1)[] = [...received] as (0 | 1)[];
  let errorPosition: number | null = null;
  let singleErrorCorrected = false;
  let doubleErrorDetected = false;

  if (syndrome === 0 && overallParityOk) {
    // No error.
  } else if (syndrome !== 0 && !overallParityOk) {
    // Single error at position `syndrome` (within the inner codeword).
    if (syndrome <= params.n) {
      errorPosition = syndrome;
      corrected[syndrome - 1] = (corrected[syndrome - 1] ^ 1) as 0 | 1;
      singleErrorCorrected = true;
    }
  } else if (syndrome !== 0 && overallParityOk) {
    // Even number of errors but syndrome nonzero → double-bit error.
    doubleErrorDetected = true;
  } else {
    // syndrome === 0 and !overallParityOk → error in the overall parity bit.
    errorPosition = totalLen;
    corrected[params.n] = (corrected[params.n] ^ 1) as 0 | 1;
    singleErrorCorrected = true;
  }

  const dataPositions = getDataPositions(params.n);
  const recoveredData: (0 | 1)[] = dataPositions.map((p) => corrected[p - 1]);
  return {
    params,
    received,
    syndrome,
    syndromeBits,
    errorPosition,
    corrected,
    recoveredData,
    singleErrorCorrected,
    doubleErrorDetected,
    mode,
    isSecded: true,
    overallParityBit,
    overallParityOk,
  };
}

// ---------------------------------------------------------------------------
// Error injection
// ---------------------------------------------------------------------------

/** Flip a single bit at `position` (1-indexed) to inject an error. */
export function injectError(codeword: (0 | 1)[], position: number): InjectResult {
  if (position < 1 || position > codeword.length) {
    throw new Error(`Position ${position} out of range (1..${codeword.length})`);
  }
  const corrupted: (0 | 1)[] = [...codeword] as (0 | 1)[];
  corrupted[position - 1] = (corrupted[position - 1] ^ 1) as 0 | 1;
  return {
    original: codeword,
    corrupted,
    flippedPosition: position,
    flippedPositions: [position],
  };
}

/** Flip multiple bits (1-indexed positions) — useful to test double-bit errors. */
export function injectErrors(codeword: (0 | 1)[], positions: number[]): InjectResult {
  const corrupted: (0 | 1)[] = [...codeword] as (0 | 1)[];
  for (const pos of positions) {
    if (pos < 1 || pos > codeword.length) {
      throw new Error(`Position ${pos} out of range (1..${codeword.length})`);
    }
    corrupted[pos - 1] = (corrupted[pos - 1] ^ 1) as 0 | 1;
  }
  return {
    original: codeword,
    corrupted,
    flippedPosition: positions[0] ?? 0,
    flippedPositions: [...positions],
  };
}

// ---------------------------------------------------------------------------
// Layout, coverage, helpers
// ---------------------------------------------------------------------------

/** Build a per-position layout (parity vs data) for a codeword. */
export function buildLayout(codeword: (0 | 1)[], n: number): BitCell[] {
  const cells: BitCell[] = [];
  for (let pos = 1; pos <= n; pos++) {
    const parityIdx = getParityIndex(pos);
    cells.push({
      position: pos,
      index: pos - 1,
      type: parityIdx !== null ? "parity" : "data",
      parityIndex: parityIdx ?? undefined,
      value: codeword[pos - 1],
    });
  }
  return cells;
}

/** Build the per-parity-bit coverage report. */
export function buildCoverage(
  codeword: (0 | 1)[],
  n: number,
  mode: ParityMode,
): ParityCoverage[] {
  const parityPositions = getParityPositions(n);
  return parityPositions.map((pp) => {
    const pIdx = getParityIndex(pp)!;
    const covered = getCoveredPositions(pp, n);
    const coveredValues = covered.map((p) => codeword[p - 1]);
    return {
      parityIndex: pIdx,
      parityPosition: pp,
      coveredPositions: covered,
      coveredValues,
      computed: codeword[pp - 1],
      mode,
    };
  });
}

/** Extract just the data bits from a codeword (skip parity positions). */
export function extractData(codeword: (0 | 1)[], n: number): (0 | 1)[] {
  const dataPositions = getDataPositions(n);
  return dataPositions.map((p) => codeword[p - 1]);
}

/** Human-readable description of one parity bit's coverage. */
export function describeParity(cov: ParityCoverage): string {
  const pos = cov.coveredPositions.join(", ");
  const vals = cov.coveredValues.join(", ");
  const parityLabel = `P${cov.parityIndex}@pos${cov.parityPosition}`;
  return `${parityLabel} covers positions [${pos}] = [${vals}] → bit = ${cov.computed} (${cov.mode})`;
}

// ---------------------------------------------------------------------------
// Parsing & formatting
// ---------------------------------------------------------------------------

/** Parse a string of 0s and 1s into a data-bit array. */
export function parseDataBits(input: string): { bits: (0 | 1)[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { bits: [], error: "Empty input" };
  if (!/^[01]+$/.test(trimmed)) return { bits: [], error: "Only 0 and 1 characters allowed" };
  const bits = trimmed.split("").map((c) => (c === "1" ? 1 : 0) as 0 | 1);
  return { bits };
}

/** Parse a codeword of an expected length. */
export function parseCodeword(
  input: string,
  expectedLength: number,
): { bits: (0 | 1)[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { bits: [], error: "Empty input" };
  if (!/^[01]+$/.test(trimmed)) return { bits: [], error: "Only 0 and 1 characters allowed" };
  if (trimmed.length !== expectedLength) {
    return { bits: [], error: `Expected ${expectedLength} bits, got ${trimmed.length}` };
  }
  const bits = trimmed.split("").map((c) => (c === "1" ? 1 : 0) as 0 | 1);
  return { bits };
}

/** Format a bit array as a string. */
export function formatBits(bits: (0 | 1)[]): string {
  return bits.join("");
}

/** Format a syndrome as a binary string of width p (MSB = parity p). */
export function formatSyndrome(syndromeBits: (0 | 1)[], p: number): string {
  // syndromeBits[0] = parity 1 (LSB); display MSB-first.
  return syndromeBits
    .slice()
    .reverse()
    .map((b) => String(b))
    .join("")
    .padStart(p, "0");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:hamming-code-error-correction-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  variant: HammingVariant;
  mode: ParityMode;
  isSecded: boolean;
  dataBits: string;
  codeword: string;
  syndrome: number;
  errorPosition: number | null;
  doubleErrorDetected: boolean;
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

export function buildShareUrl(
  dataBits: string,
  variant: HammingVariant,
  mode: ParityMode,
  isSecded: boolean,
  injectPos: number,
): string {
  const params = new URLSearchParams();
  if (dataBits) params.set("data", dataBits);
  params.set("variant", variant);
  params.set("mode", mode);
  params.set("secded", isSecded ? "1" : "0");
  if (injectPos > 0) params.set("flip", String(injectPos));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  dataBits: string;
  variant: HammingVariant;
  mode: ParityMode;
  isSecded: boolean;
  injectPos: number;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) {
    return {
      dataBits: "",
      variant: "hamming-7-4",
      mode: "even",
      isSecded: false,
      injectPos: 0,
    };
  }
  const params = new URLSearchParams(clean);
  const dataBits = params.get("data") ?? "";
  const v = params.get("variant") ?? "hamming-7-4";
  const variant: HammingVariant =
    v === "hamming-15-11" || v === "hamming-31-26" ? v : "hamming-7-4";
  const m = params.get("mode") ?? "even";
  const mode: ParityMode = m === "odd" ? "odd" : "even";
  const isSecded = params.get("secded") === "1";
  const flipStr = params.get("flip") ?? "0";
  const injectPos = Number.parseInt(flipStr, 10);
  return {
    dataBits,
    variant,
    mode,
    isSecded,
    injectPos: Number.isFinite(injectPos) && injectPos > 0 ? injectPos : 0,
  };
}
