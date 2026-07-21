/**
 * Fixed-Point Q-Format Converter (Qm.n) — pure logic.
 *
 * Convert between real decimal numbers and fixed-point Qm.n representations
 * used in DSP, embedded, and FPGA work. Pure functions only — no DOM, no
 * network. BigInt-correct for all sizes.
 *
 * Conventions:
 *   - Qm.n: m integer bits (including sign bit for signed), n fractional bits.
 *     Total word length = m + n.
 *   - Signed (Qm.n): two's-complement encoding. Range = [-2^(m-1), 2^(m-1) - 2^-n].
 *   - Unsigned (UQm.n): no sign bit, m magnitude integer bits.
 *     Range = [0, 2^m - 2^-n].
 *   - Resolution (quantum, LSB weight) = 2^-n.
 */

export type RoundingMode = "round-half-up" | "round-to-even" | "truncate";
export type OverflowMode = "saturate" | "wrap";

export interface QConfig {
  m: number; // integer bits (including sign for signed)
  n: number; // fractional bits
  signed: boolean;
}

export interface QFormatInfo {
  totalBits: number;
  minRaw: bigint; // smallest representable raw integer (signed)
  maxRaw: bigint; // largest representable raw integer (signed)
  minValue: string; // exact decimal of min
  maxValue: string; // exact decimal of max
  resolution: string; // exact decimal of 2^-n
}

export interface ConversionResult {
  config: QConfig;
  rounding: RoundingMode;
  overflow: OverflowMode;
  rawInt: bigint; // stored raw integer (always non-negative bit pattern, totalBits wide)
  rawSigned: bigint; // raw integer interpreted as signed (for display)
  dec: string; // rawInt in decimal (signed)
  hex: string; // rawInt in hex
  bin: string; // rawInt in binary, totalBits wide
  reconstructed: string; // exact decimal of the reconstructed real value
  quantError: string; // exact decimal of (input - reconstructed)
  overflowed: boolean; // true if saturate clamped or wrap wrapped
  inputParsed: string; // canonical decimal form of input
}

// ---- presets ----

export interface PresetEntry {
  label: string;
  config: QConfig;
  description: string;
}

export const PRESETS: PresetEntry[] = [
  { label: "Q7 (Q1.7)",  config: { m: 1, n: 7,  signed: true },  description: "8-bit signed, common in audio" },
  { label: "Q15 (Q1.15)", config: { m: 1, n: 15, signed: true },  description: "16-bit signed, classic DSP" },
  { label: "Q31 (Q1.31)", config: { m: 1, n: 31, signed: true },  description: "32-bit signed, high-precision DSP" },
  { label: "Q1.7 (alt)",  config: { m: 1, n: 7,  signed: true },  description: "8-bit signed, alternate naming" },
  { label: "UQ8.8",       config: { m: 8, n: 8,  signed: false }, description: "16-bit unsigned, video color" },
  { label: "UQ16.16",     config: { m: 16, n: 16, signed: false }, description: "32-bit unsigned, fixed-point math" },
  { label: "Q4.4",        config: { m: 4, n: 4,  signed: true },  description: "8-bit signed, small range" },
  { label: "UQ4.4",       config: { m: 4, n: 4,  signed: false }, description: "8-bit unsigned, small range" },
];

export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  "round-half-up": "Round half up (ties away from zero)",
  "round-to-even": "Round to nearest even (IEEE 754 default)",
  "truncate": "Truncate / floor (drop fractional bits)",
};

export const OVERFLOW_LABELS: Record<OverflowMode, string> = {
  "saturate": "Saturate (clamp to range)",
  "wrap": "Wrap (two's-complement wraparound)",
};

// ---- validation ----

export const MAX_TOTAL_BITS = 256;
export const MIN_M = 1;
export const MIN_N = 0;

export function isValidConfig(config: QConfig): boolean {
  const { m, n, signed } = config;
  if (!Number.isInteger(m) || !Number.isInteger(n)) return false;
  if (m < MIN_M) return false;
  if (n < MIN_N) return false;
  if (signed && m < 1) return false;
  const total = m + n;
  if (total > MAX_TOTAL_BITS) return false;
  return true;
}

// ---- format info ----

/** Compute format info (total bits, range, resolution) for a Q config. */
export function getFormatInfo(config: QConfig): QFormatInfo {
  const { m, n, signed } = config;
  const totalBits = m + n;
  let minRaw: bigint;
  let maxRaw: bigint;
  if (signed) {
    minRaw = -(1n << BigInt(totalBits - 1));
    maxRaw = (1n << BigInt(totalBits - 1)) - 1n;
  } else {
    minRaw = 0n;
    maxRaw = (1n << BigInt(totalBits)) - 1n;
  }
  const minValue = bigIntTimesPowerOfTwo(minRaw, -BigInt(n));
  const maxValue = bigIntTimesPowerOfTwo(maxRaw, -BigInt(n));
  const resolution = bigIntTimesPowerOfTwo(1n, -BigInt(n));
  return { totalBits, minRaw, maxRaw, minValue, maxValue, resolution };
}

// ---- BigInt power-of-two decimal rendering (exact) ----

/**
 * Compute the exact decimal representation of `m * 2^exp2`, where m is a
 * signed BigInt and exp2 is a (possibly negative) BigInt. Returns the value
 * as a decimal string (no scientific notation), correct to the last digit.
 */
export function bigIntTimesPowerOfTwo(m: bigint, exp2: bigint): string {
  if (m === 0n) return "0";
  const sign = m < 0n;
  const mag = sign ? -m : m;
  let s: string;
  if (exp2 >= 0n) {
    s = (mag << exp2).toString(10);
  } else {
    const k = -exp2;
    let fivePow = 1n;
    for (let i = 0n; i < k; i++) fivePow *= 5n;
    const numerator = mag * fivePow;
    const str = numerator.toString(10).padStart(Number(k) + 1, "0");
    const cut = str.length - Number(k);
    const intPart = str.slice(0, cut);
    const fracPart = str.slice(cut).replace(/0+$/, "");
    s = fracPart ? `${intPart}.${fracPart}` : intPart;
  }
  return sign ? `-${s}` : s;
}

// ---- decimal-string parsing (exact rational) ----

export interface ParsedDecimal {
  num: bigint;
  den: bigint;
  isZero: boolean;
  sign: 0 | 1;
}

/** Parse a decimal string into a (numerator, denominator) BigInt pair. */
export function parseDecimalString(input: string): ParsedDecimal {
  const s = (input || "").trim();
  if (!s) throw new Error("Empty input");
  let sign: 0 | 1 = 0;
  let body = s;
  if (body.startsWith("-")) { sign = 1; body = body.slice(1); }
  else if (body.startsWith("+")) { body = body.slice(1); }
  let expPart = 0;
  const eIdx = body.search(/[eE]/);
  if (eIdx >= 0) {
    expPart = parseInt(body.slice(eIdx + 1), 10);
    body = body.slice(0, eIdx);
  }
  if (!/^\d*(\.\d*)?$|^\d+\.$/.test(body) || body === "." || body === "") {
    throw new Error(`Invalid decimal: ${input}`);
  }
  const dotIdx = body.indexOf(".");
  let intPart: string;
  let fracPart: string;
  if (dotIdx < 0) { intPart = body; fracPart = ""; }
  else { intPart = body.slice(0, dotIdx); fracPart = body.slice(dotIdx + 1); }
  const digits = (intPart + fracPart).replace(/^0+/, "") || "0";
  const num = BigInt(digits);
  const fracLen = fracPart.length;
  const effExp = expPart - fracLen;
  let den: bigint;
  if (effExp >= 0) {
    den = 1n;
    let n = num;
    for (let i = 0; i < effExp; i++) n *= 10n;
    return { num: n, den, isZero: num === 0n, sign };
  } else {
    den = 1n;
    for (let i = 0; i < -effExp; i++) den *= 10n;
    return { num, den, isZero: num === 0n, sign };
  }
}

// ---- bit helpers ----

/** Mask of `n` low bits set. */
export function mask(n: number): bigint {
  return (1n << BigInt(n)) - 1n;
}

/** Get bit `i` (0 = LSB) of a bigint. */
export function getBit(value: bigint, i: number): 0 | 1 {
  return ((value >> BigInt(i)) & 1n) === 1n ? 1 : 0;
}

/** Toggle bit `i` (0 = LSB) of a bigint. */
export function toggleBit(value: bigint, i: number): bigint {
  return value ^ (1n << BigInt(i));
}

/** Convert a non-negative bigint to a fixed-width binary string (MSB first). */
export function toBinaryString(value: bigint, width: number): string {
  let s = "";
  const v = value & mask(width);
  for (let i = width - 1; i >= 0; i--) {
    s += getBit(v, i).toString();
  }
  return s;
}

/** Convert a non-negative bigint to an uppercase hex string of the right width. */
export function toHexString(value: bigint, width: number): string {
  const hexChars = Math.ceil(width / 4);
  const v = value & mask(width);
  return v.toString(16).toUpperCase().padStart(hexChars, "0");
}

/** Convert a (possibly negative) signed bigint to its two's-complement bit pattern. */
export function signedToRaw(signed: bigint, totalBits: number): bigint {
  const m = mask(totalBits);
  if (signed >= 0n) return signed & m;
  // two's-complement: 2^totalBits + signed
  return ((1n << BigInt(totalBits)) + signed) & m;
}

/** Convert a two's-complement bit pattern to a signed bigint. */
export function rawToSigned(raw: bigint, totalBits: number, isSigned: boolean): bigint {
  const m = mask(totalBits);
  const v = raw & m;
  if (!isSigned) return v;
  const signBit = 1n << BigInt(totalBits - 1);
  if (v & signBit) {
    return v - (1n << BigInt(totalBits));
  }
  return v;
}

/** Parse a hex / binary / decimal string into a (raw, non-negative) bigint bit pattern. */
export function parseRawInt(input: string, totalBits: number): bigint {
  const s = (input || "").trim().toLowerCase();
  if (!s) return 0n;
  let v: bigint;
  if (s.startsWith("0x")) v = BigInt(s);
  else if (s.startsWith("0b")) v = BigInt("0b" + s.slice(2));
  else if (/^[01]+$/.test(s) && s.length === totalBits) v = BigInt("0b" + s);
  else if (/^-?\d+$/.test(s)) {
    // decimal — may be negative (signed)
    const n = BigInt(s);
    if (n < 0n) return signedToRaw(n, totalBits);
    v = n;
  }
  else throw new Error(`Cannot parse raw integer: ${input}`);
  return v & mask(totalBits);
}

// ---- rounding ----

/**
 * Round a fraction `num / den` to an integer using the specified rounding
 * mode. `num` and `den` are BigInts (den > 0); `num` may be negative.
 */
export function roundFraction(num: bigint, den: bigint, mode: RoundingMode): bigint {
  if (den === 0n) throw new Error("Division by zero");
  // BigInt division truncates toward zero.
  const q = num / den;
  const r = num - q * den;
  if (r === 0n) return q;
  if (mode === "truncate") {
    // floor (toward -inf)
    if (r < 0n) return q - 1n;
    return q;
  }
  // For positive r (num > 0 case after truncation): r > 0
  // For negative r (num < 0 case after truncation): r < 0
  const absR = r < 0n ? -r : r;
  const twiceAbsR = absR * 2n;
  if (twiceAbsR > den) {
    // round away from zero
    return r > 0n ? q + 1n : q - 1n;
  }
  if (twiceAbsR === den) {
    // tie
    if (mode === "round-half-up") {
      // away from zero
      return r > 0n ? q + 1n : q - 1n;
    }
    // round-to-even
    if (q % 2n === 0n) return q;
    // q is odd — round to nearest even
    // The "even neighbor" of q is either q-1 or q+1; pick the one closer to zero
    // since we're on a tie. For positive r, the tie is between q and q+1; if q is odd,
    // q-1 is even... wait no, the tie is between q (odd) and q+1 (even), so pick q+1.
    // For negative r, the tie is between q (odd) and q-1 (even), so pick q-1.
    return r > 0n ? q + 1n : q - 1n;
  }
  // twiceAbsR < den — round toward zero (keep q)
  return q;
}

// ---- overflow handling ----

export interface OverflowResult {
  raw: bigint; // two's-complement bit pattern (non-negative)
  overflowed: boolean;
}

/** Apply the overflow mode to a signed scaled integer. */
export function applyOverflow(scaled: bigint, config: QConfig, mode: OverflowMode): OverflowResult {
  const info = getFormatInfo(config);
  if (mode === "saturate") {
    if (scaled < info.minRaw) return { raw: signedToRaw(info.minRaw, info.totalBits), overflowed: true };
    if (scaled > info.maxRaw) return { raw: signedToRaw(info.maxRaw, info.totalBits), overflowed: true };
    return { raw: signedToRaw(scaled, info.totalBits), overflowed: false };
  }
  // wrap
  const m = mask(info.totalBits);
  const range = 1n << BigInt(info.totalBits);
  // ((scaled % range) + range) % range gives a non-negative bit pattern
  const wrapped = ((scaled % range) + range) % range;
  const overflowed = scaled < info.minRaw || scaled > info.maxRaw;
  return { raw: wrapped & m, overflowed };
}

// ---- top-level conversion ----

/** Convert a real decimal value to its Qm.n raw integer. */
export function realToQ(input: string, config: QConfig, rounding: RoundingMode, overflow: OverflowMode): ConversionResult {
  if (!isValidConfig(config)) throw new Error(`Invalid Q config: m=${config.m}, n=${config.n}, signed=${config.signed}`);
  const info = getFormatInfo(config);
  const parsed = parseDecimalString(input);
  // value = num / den (signed)
  // scaled = value * 2^n = (num * 2^n) / den
  const scaledNum = parsed.sign === 1 ? -parsed.num : parsed.num;
  const scaledNumShifted = scaledNum << BigInt(config.n);
  const rounded = roundFraction(scaledNumShifted, parsed.den, rounding);
  const { raw, overflowed } = applyOverflow(rounded, config, overflow);
  const rawSigned = rawToSigned(raw, info.totalBits, config.signed);
  const reconstructed = bigIntTimesPowerOfTwo(rawSigned, -BigInt(config.n));
  // quantError = input - reconstructed (exact)
  const quantError = subtractDecimalStrings(input, reconstructed);
  return {
    config,
    rounding,
    overflow,
    rawInt: raw,
    rawSigned,
    dec: rawSigned.toString(10),
    hex: toHexString(raw, info.totalBits),
    bin: toBinaryString(raw, info.totalBits),
    reconstructed,
    quantError,
    overflowed,
    inputParsed: input,
  };
}

/** Convert a raw integer (bit pattern) to its reconstructed real value. */
export function qToReal(raw: bigint, config: QConfig): string {
  if (!isValidConfig(config)) throw new Error(`Invalid Q config`);
  const info = getFormatInfo(config);
  const rawSigned = rawToSigned(raw, info.totalBits, config.signed);
  return bigIntTimesPowerOfTwo(rawSigned, -BigInt(config.n));
}

// ---- decimal-string arithmetic ----

/** a - b as an exact decimal string (a, b are decimal strings or "num/den" fractions). */
export function subtractDecimalStrings(a: string, b: string): string {
  const fa = parseFractionOrDecimal(a);
  const fb = parseFractionOrDecimal(b);
  // a - b = (fa.num * fb.den - fb.num * fa.den) / (fa.den * fb.den)
  const num = fa.num * fb.den - fb.num * fa.den;
  const den = fa.den * fb.den;
  return fractionToDecimalString(num, den);
}

interface Fraction { num: bigint; den: bigint; }

function parseFractionOrDecimal(s: string): Fraction {
  const trimmed = s.trim();
  if (trimmed.includes("/")) {
    const [numStr, denStr] = trimmed.split("/");
    return { num: BigInt(numStr.trim()), den: BigInt(denStr.trim()) };
  }
  const parsed = parseDecimalString(trimmed);
  return { num: parsed.sign === 1 ? -parsed.num : parsed.num, den: parsed.den };
}

/** Convert a BigInt fraction to a decimal string (100 significant digits). */
export function fractionToDecimalString(num: bigint, den: bigint): string {
  if (den === 0n) return num === 0n ? "0" : "Infinity";
  if (num === 0n) return "0";
  const sign = num < 0n;
  const nAbs = sign ? -num : num;
  const dAbs = den < 0n ? -den : den;
  const intPart = nAbs / dAbs;
  let rem = nAbs - intPart * dAbs;
  let fracStr = "";
  const MAX_FRAC_DIGITS = 100;
  for (let i = 0; i < MAX_FRAC_DIGITS && rem > 0n; i++) {
    rem *= 10n;
    const d = rem / dAbs;
    fracStr += d.toString();
    rem -= d * dAbs;
  }
  fracStr = fracStr.replace(/0+$/, "");
  const intStr = intPart.toString();
  const result = fracStr ? `${intStr}.${fracStr}` : intStr;
  return sign ? `-${result}` : result;
}

// ---- bit-grid field helpers ----

export interface FieldBits {
  integer: string; // integer bits (including sign for signed)
  fraction: string; // fractional bits
}

/** Split a bit pattern into integer and fractional bit substrings. */
export function splitFieldBits(raw: bigint, config: QConfig): FieldBits {
  const info = getFormatInfo(config);
  const intBits = config.m;
  const fracBits = config.n;
  const intPart = (raw >> BigInt(fracBits)) & mask(intBits);
  const fracPart = raw & mask(fracBits);
  return {
    integer: toBinaryString(intPart, intBits),
    fraction: fracBits > 0 ? toBinaryString(fracPart, fracBits) : "",
  };
}

/** Per-bit field label. */
export function bitFieldLabel(bitIndex: number, config: QConfig): "sign" | "integer" | "fraction" {
  const info = getFormatInfo(config);
  if (bitIndex < config.n) return "fraction";
  if (config.signed && bitIndex === info.totalBits - 1) return "sign";
  return "integer";
}

// ---- history (localStorage) ----

const HISTORY_KEY = "unqtools:fixed-point-q-format-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  config: QConfig;
  rounding: RoundingMode;
  overflow: OverflowMode;
  hex: string;
  reconstructed: string;
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

// ---- shareable URL ----

export function buildShareUrl(input: string, config: QConfig, rounding: RoundingMode, overflow: OverflowMode): string {
  const params = new URLSearchParams();
  if (input) params.set("v", input);
  params.set("m", String(config.m));
  params.set("n", String(config.n));
  params.set("signed", config.signed ? "1" : "0");
  params.set("r", rounding);
  params.set("o", overflow);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  input: string;
  config: QConfig;
  rounding: RoundingMode;
  overflow: OverflowMode;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const defaultConfig: QConfig = { m: 1, n: 15, signed: true };
  if (!clean) return { input: "", config: defaultConfig, rounding: "round-to-even", overflow: "saturate" };
  const params = new URLSearchParams(clean);
  const input = params.get("v") ?? "";
  const m = parseInt(params.get("m") ?? "1", 10);
  const n = parseInt(params.get("n") ?? "15", 10);
  const signed = params.get("signed") === "1";
  const r = (params.get("r") ?? "round-to-even") as RoundingMode;
  const o = (params.get("o") ?? "saturate") as OverflowMode;
  const validRoundings: RoundingMode[] = ["round-half-up", "round-to-even", "truncate"];
  const validOverflows: OverflowMode[] = ["saturate", "wrap"];
  const config: QConfig = {
    m: Number.isInteger(m) && m >= 1 ? m : 1,
    n: Number.isInteger(n) && n >= 0 ? n : 15,
    signed,
  };
  const rounding = validRoundings.includes(r) ? r : "round-to-even";
  const overflow = validOverflows.includes(o) ? o : "saturate";
  return { input, config, rounding, overflow };
}
