/**
 * Number Base Converter — pure logic.
 *
 * Convert a number between any two bases from 2 to 36 — binary, octal,
 * decimal, hexadecimal, and arbitrary radices — with BigInt precision,
 * place-value expansion, fractional radix-point support, signed two's-
 * complement mode, plus base58/base64 byte-encoding shortcuts and batch
 * conversion. Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

export interface BasePreset {
  base: number;
  label: string;
  prefix?: string;
}

export const BASE_PRESETS: BasePreset[] = [
  { base: 2, label: "Binary", prefix: "0b" },
  { base: 8, label: "Octal", prefix: "0o" },
  { base: 10, label: "Decimal" },
  { base: 16, label: "Hex", prefix: "0x" },
  { base: 32, label: "Base32" },
  { base: 36, label: "Base36" },
];

export const BASE_LABELS: Record<number, string> = {
  2: "Binary",
  8: "Octal",
  10: "Decimal",
  16: "Hexadecimal",
  32: "Base32",
  36: "Base36",
};

export const COMMON_BASES: number[] = [2, 8, 10, 16, 32, 36];

export const BIT_WIDTHS: number[] = [8, 16, 32, 64];

export const MAX_FRACTION_DIGITS = 24;

export const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export type SignedBitWidth = 8 | 16 | 32 | 64;

export interface ConvertOptions {
  /** Treat input as signed two's-complement at the given bit width. */
  signed?: boolean;
  /** Bit width used for two's-complement reinterpretation. */
  bitWidth?: SignedBitWidth;
  /** Max fractional digits in target base (default 24). */
  maxFractionDigits?: number;
  /** Group size for output (e.g. 4 for binary nibbles). 0 = no grouping. */
  groupSize?: number;
  /** Separator between groups. */
  groupSeparator?: string;
  /** Uppercase output for bases > 10 (default true). */
  uppercase?: boolean;
}

export interface ParsedNumber {
  sign: -1 | 1;
  intPart: bigint;
  /** Fractional value numerator over fromBase^fracLen. */
  fracPart: bigint;
  fracLen: number;
}

export interface ConversionResult {
  /** Formatted output in target base. */
  value: string;
  /** True if the fractional part could not be represented exactly. */
  repeating: boolean;
  /** True if the original input was negative. */
  negative: boolean;
  /** Place-value expansion of the integer part. */
  expansion: string;
  /** Original base. */
  fromBase: number;
  /** Target base. */
  toBase: number;
  /** Error message if conversion failed. */
  error?: string;
}

export interface BatchResult {
  input: string;
  outputs: { base: number; value: string }[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Digit helpers
// ---------------------------------------------------------------------------

const DIGIT_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Convert 0–35 to a digit char (lowercase). */
export function digitToChar(d: number): string {
  if (d < 0 || d > 35) throw new Error(`Digit out of range: ${d}`);
  return DIGIT_CHARS[d];
}

/** Convert a digit char (case-insensitive) to 0–35. Returns -1 if invalid. */
export function charToDigit(ch: string): number {
  if (!ch || ch.length !== 1) return -1;
  const lower = ch.toLowerCase();
  const idx = DIGIT_CHARS.indexOf(lower);
  return idx;
}

/** Validate that all chars in `digits` are valid for the given base. */
export function validateDigits(
  digits: string,
  base: number,
): { valid: boolean; invalidChars: string[] } {
  const invalid: string[] = [];
  for (const ch of digits) {
    if (ch === ".") continue;
    const d = charToDigit(ch);
    if (d < 0 || d >= base) invalid.push(ch);
  }
  return { valid: invalid.length === 0, invalidChars: [...new Set(invalid)] };
}

/** Auto-detect base from a prefix (0x, 0b, 0o). Returns base + stripped value. */
export function detectBase(
  input: string,
): { base: number; cleaned: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const negative = trimmed.startsWith("-");
  const positive = trimmed.startsWith("+");
  let rest = trimmed;
  if (negative || positive) rest = trimmed.slice(1);
  const lower = rest.toLowerCase();
  if (lower.startsWith("0x")) return { base: 16, cleaned: (negative ? "-" : "") + rest.slice(2) };
  if (lower.startsWith("0b")) return { base: 2, cleaned: (negative ? "-" : "") + rest.slice(2) };
  if (lower.startsWith("0o")) return { base: 8, cleaned: (negative ? "-" : "") + rest.slice(2) };
  return null;
}

// ---------------------------------------------------------------------------
// Parsing & formatting (BigInt-backed)
// ---------------------------------------------------------------------------

/** Parse a string in the given base into a ParsedNumber. Throws on invalid. */
export function parseNumber(input: string, base: number): ParsedNumber {
  if (base < 2 || base > 36) throw new Error(`Base must be 2–36, got ${base}`);
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty input");
  let sign: -1 | 1 = 1;
  let rest = trimmed;
  if (rest.startsWith("-")) {
    sign = -1;
    rest = rest.slice(1);
  } else if (rest.startsWith("+")) {
    rest = rest.slice(1);
  }
  if (!rest) throw new Error("No digits");
  const parts = rest.split(".");
  if (parts.length > 2) throw new Error("Multiple radix points");
  const intStr = parts[0] ?? "";
  const fracStr = parts[1] ?? "";
  // Validate
  const allDigits = intStr + fracStr;
  if (allDigits.length === 0) throw new Error("No digits");
  const validation = validateDigits(allDigits, base);
  if (!validation.valid) {
    throw new Error(`Invalid digit(s) ${validation.invalidChars.join(", ")} for base ${base}`);
  }
  // Parse integer part
  let intPart = 0n;
  const b = BigInt(base);
  for (const ch of intStr) {
    intPart = intPart * b + BigInt(charToDigit(ch));
  }
  // Parse fractional part as numerator over base^fracLen
  let fracPart = 0n;
  for (const ch of fracStr) {
    fracPart = fracPart * b + BigInt(charToDigit(ch));
  }
  return { sign, intPart, fracPart, fracLen: fracStr.length };
}

/** Format a non-negative BigInt in the given base. */
export function formatBigIntInBase(value: bigint, base: number): string {
  if (value < 0n) throw new Error("formatBigIntInBase requires non-negative value");
  if (value === 0n) return "0";
  const b = BigInt(base);
  let result = "";
  let v = value;
  while (v > 0n) {
    const d = Number(v % b);
    result = digitToChar(d) + result;
    v = v / b;
  }
  return result;
}

/** Format the fractional part (numerator / fromBase^fracLen) in target base. */
export function convertFractionToBase(
  fracPart: bigint,
  fracLen: number,
  fromBase: number,
  toBase: number,
  maxDigits: number = MAX_FRACTION_DIGITS,
): { digits: string; repeating: boolean } {
  if (fracPart === 0n || fracLen === 0) return { digits: "", repeating: false };
  const denominator = BigInt(fromBase) ** BigInt(fracLen);
  const tb = BigInt(toBase);
  let digits = "";
  let f = fracPart;
  const seen = new Map<bigint, number>();
  for (let i = 0; i < maxDigits; i++) {
    if (f === 0n) return { digits, repeating: false };
    const prev = seen.get(f);
    if (prev !== undefined) {
      const cycle = digits.slice(prev);
      const prefix = digits.slice(0, prev);
      return { digits: `${prefix}(${cycle})`, repeating: true };
    }
    seen.set(f, i);
    f = f * tb;
    const digit = Number(f / denominator);
    digits += digitToChar(digit);
    f = f % denominator;
  }
  return { digits, repeating: true };
}

/** Group a digit string into chunks (e.g. 4-bit nibbles). */
export function groupDigits(
  s: string,
  groupSize: number,
  separator: string = " ",
): string {
  if (!s || groupSize <= 0) return s;
  // Handle negative sign
  const neg = s.startsWith("-");
  const body = neg ? s.slice(1) : s;
  // Handle fractional point
  const [intStr, fracStr] = body.split(".");
  let out = "";
  if (intStr) {
    // Group from right
    const padded = intStr;
    const chunks: string[] = [];
    for (let i = padded.length; i > 0; i -= groupSize) {
      chunks.unshift(padded.slice(Math.max(0, i - groupSize), i));
    }
    out += chunks.join(separator);
  }
  if (fracStr !== undefined) {
    // Group from left
    out += ".";
    const chunks: string[] = [];
    for (let i = 0; i < fracStr.length; i += groupSize) {
      chunks.push(fracStr.slice(i, i + groupSize));
    }
    out += chunks.join(separator);
  }
  return (neg ? "-" : "") + out;
}

// ---------------------------------------------------------------------------
// Two's complement
// ---------------------------------------------------------------------------

/** Convert a signed value to its two's-complement bit pattern at a width. */
export function toTwosComplement(value: bigint, bitWidth: number): bigint {
  const mask = (1n << BigInt(bitWidth)) - 1n;
  if (value >= 0n) return value & mask;
  // -x → (2^width + x) mod 2^width
  return ((1n << BigInt(bitWidth)) + value) & mask;
}

/** Reinterpret an unsigned bit pattern as signed at a width. */
export function fromTwosComplement(value: bigint, bitWidth: number): bigint {
  const signBit = 1n << BigInt(bitWidth - 1);
  const mask = (1n << BigInt(bitWidth)) - 1n;
  const masked = value & mask;
  if (masked & signBit) {
    return masked - (1n << BigInt(bitWidth));
  }
  return masked;
}

// ---------------------------------------------------------------------------
// Place-value expansion
// ---------------------------------------------------------------------------

export interface Expansion {
  terms: string[];
  sum: string;
  text: string;
}

/** Build the place-value expansion for the integer part of `input` in `base`. */
export function buildExpansion(input: string, base: number): Expansion {
  const trimmed = input.trim().replace(/^[+-]/, "");
  const intStr = trimmed.split(".")[0] ?? "";
  if (!intStr) return { terms: [], sum: "0", text: "0" };
  // Validate
  const validation = validateDigits(intStr, base);
  if (!validation.valid) return { terms: [], sum: "0", text: "0" };
  // Compute from right to left
  const digits = intStr.split("").map((c) => charToDigit(c));
  const terms: string[] = [];
  let sum = 0n;
  const b = BigInt(base);
  for (let i = 0; i < digits.length; i++) {
    const pos = digits.length - 1 - i;
    const d = digits[i];
    const value = BigInt(d) * b ** BigInt(pos);
    sum += value;
    const placeValue = b ** BigInt(pos);
    terms.push(`${d}×${placeValue.toString()}`);
  }
  return {
    terms,
    sum: sum.toString(),
    text: terms.join(" + ") + ` = ${sum.toString()}`,
  };
}

// ---------------------------------------------------------------------------
// Main conversion
// ---------------------------------------------------------------------------

/** Convert `input` (in `fromBase`) to `toBase`. */
export function convertBase(
  input: string,
  fromBase: number,
  toBase: number,
  options: ConvertOptions = {},
): ConversionResult {
  if (fromBase < 2 || fromBase > 36) {
    return { value: "", repeating: false, negative: false, expansion: "", fromBase, toBase, error: `From-base must be 2–36 (got ${fromBase})` };
  }
  if (toBase < 2 || toBase > 36) {
    return { value: "", repeating: false, negative: false, expansion: "", fromBase, toBase, error: `To-base must be 2–36 (got ${toBase})` };
  }
  let parsed: ParsedNumber;
  try {
    parsed = parseNumber(input, fromBase);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse error";
    return { value: "", repeating: false, negative: false, expansion: "", fromBase, toBase, error: msg };
  }
  const negative = parsed.sign < 0;
  // Build the expansion from the integer part of the original input
  const expansionObj = buildExpansion(input, fromBase);
  // Apply two's-complement reinterpretation for signed mode (integer part only)
  let intValue = parsed.intPart;
  if (options.signed && negative && options.bitWidth) {
    intValue = toTwosComplement(parsed.intPart * BigInt(parsed.sign), options.bitWidth);
  } else if (negative) {
    intValue = parsed.intPart; // keep magnitude
  }
  // Format integer part in target base
  let intStr = formatBigIntInBase(intValue, toBase);
  // Fractional part (sign ignored — fractions keep magnitude)
  let fracStr = "";
  let repeating = false;
  if (parsed.fracPart > 0n) {
    const frac = convertFractionToBase(
      parsed.fracPart,
      parsed.fracLen,
      fromBase,
      toBase,
      options.maxFractionDigits ?? MAX_FRACTION_DIGITS,
    );
    fracStr = frac.digits;
    repeating = frac.repeating;
  }
  let value = intStr;
  if (fracStr) value += "." + fracStr;
  // Apply digit grouping
  if (options.groupSize && options.groupSize > 0) {
    value = groupDigits(value, options.groupSize, options.groupSeparator ?? " ");
  }
  // Uppercase
  if (options.uppercase !== false && toBase > 10) {
    value = value.toUpperCase();
  }
  // Prepend sign for non-signed mode (negative magnitude shown)
  if (negative && !options.signed) {
    value = "-" + value;
  }
  return {
    value,
    repeating,
    negative,
    expansion: expansionObj.text,
    fromBase,
    toBase,
  };
}

/** Convert one input to all common bases. Returns base → value. */
export function convertAllBases(
  input: string,
  fromBase: number,
  options: ConvertOptions = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const b of COMMON_BASES) {
    const r = convertBase(input, fromBase, b, { ...options, uppercase: true });
    out[String(b)] = r.error ? "" : r.value;
  }
  // Also include base58 and base64 byte encodings (non-negative integers only)
  try {
    const parsed = parseNumber(input, fromBase);
    if (parsed.sign >= 0 && parsed.fracPart === 0n) {
      out["58"] = encodeBase58(parsed.intPart);
      out["64"] = encodeBase64(parsed.intPart);
    } else {
      out["58"] = "";
      out["64"] = "";
    }
  } catch {
    out["58"] = "";
    out["64"] = "";
  }
  return out;
}

// ---------------------------------------------------------------------------
// Base58 / Base64 byte-encoding shortcuts
// ---------------------------------------------------------------------------

/** Encode a non-negative BigInt as base58 (Bitcoin alphabet). */
export function encodeBase58(value: bigint): string {
  if (value < 0n) throw new Error("base58 only supports non-negative integers");
  if (value === 0n) return "";
  // Convert to bytes (big-endian, minimal) to count leading zero bytes.
  const bytes: number[] = [];
  let v = value;
  while (v > 0n) {
    bytes.unshift(Number(v & 0xffn));
    v = v >> 8n;
  }
  let zeros = 0;
  for (const b of bytes) {
    if (b === 0) zeros++;
    else break;
  }
  let num = value;
  let encoded = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    encoded = BASE58_ALPHABET[rem] + encoded;
  }
  return BASE58_ALPHABET[0].repeat(zeros) + encoded;
}

/** Decode a base58 string (Bitcoin alphabet) to BigInt. */
export function decodeBase58(input: string): bigint {
  if (!input) return 0n;
  let result = 0n;
  for (const ch of input) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base58 character: ${ch}`);
    result = result * 58n + BigInt(idx);
  }
  return result;
}

/** Encode a non-negative BigInt as base64 (RFC 4648). */
export function encodeBase64(value: bigint): string {
  if (value < 0n) throw new Error("base64 only supports non-negative integers");
  if (value === 0n) return "";
  const bytes: number[] = [];
  let v = value;
  while (v > 0n) {
    bytes.unshift(Number(v & 0xffn));
    v = v >> 8n;
  }
  return bytesToBase64(bytes);
}

/** Decode a base64 string (RFC 4648) to BigInt. */
export function decodeBase64(input: string): bigint {
  const bytes = base64ToBytes(input);
  let result = 0n;
  for (const b of bytes) result = (result << 8n) | BigInt(b);
  return result;
}

function bytesToBase64(bytes: number[]): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const e1 = b1 >> 2;
    const e2 = ((b1 & 0x03) << 4) | (b2 >> 4);
    const e3 = ((b2 & 0x0f) << 2) | (b3 >> 6);
    const e4 = b3 & 0x3f;
    result += BASE64_ALPHABET[e1] + BASE64_ALPHABET[e2];
    result += i + 1 < bytes.length ? BASE64_ALPHABET[e3] : "=";
    result += i + 2 < bytes.length ? BASE64_ALPHABET[e4] : "=";
  }
  return result;
}

function base64ToBytes(input: string): number[] {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = BASE64_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid base64 character: ${ch}`);
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Batch conversion
// ---------------------------------------------------------------------------

/** Batch-convert a list of inputs (one per line) to the target base. */
export function batchConvert(
  inputs: string[],
  fromBase: number,
  toBase: number,
  options: ConvertOptions = {},
): BatchResult[] {
  return inputs.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { input: line, outputs: [], error: "Empty line" };
    }
    const r = convertBase(trimmed, fromBase, toBase, options);
    if (r.error) return { input: line, outputs: [], error: r.error };
    return { input: line, outputs: [{ base: toBase, value: r.value }] };
  });
}

/** Parse a multi-line input string into individual lines. */
export function parseBatchInput(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:number-base-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  fromBase: number;
  toBase: number;
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
  input: string;
  fromBase: number;
  toBase: number;
  signed?: boolean;
  bitWidth?: SignedBitWidth;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.input) params.set("input", state.input);
  if (state.fromBase) params.set("from", String(state.fromBase));
  if (state.toBase) params.set("to", String(state.toBase));
  if (state.signed) params.set("signed", "1");
  if (state.bitWidth) params.set("width", String(state.bitWidth));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", fromBase: 10, toBase: 16 };
  const params = new URLSearchParams(clean);
  const input = params.get("input") ?? "";
  const fromBase = parseIntSafe(params.get("from"), 10, 2, 36);
  const toBase = parseIntSafe(params.get("to"), 16, 2, 36);
  const signed = params.get("signed") === "1";
  const widthRaw = params.get("width");
  let bitWidth: SignedBitWidth | undefined;
  if (widthRaw) {
    const w = parseInt(widthRaw, 10);
    if (w === 8 || w === 16 || w === 32 || w === 64) bitWidth = w;
  }
  return { input, fromBase, toBase, signed, bitWidth };
}

function parseIntSafe(
  raw: string | null,
  def: number,
  min: number,
  max: number,
): number {
  if (raw === null) return def;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < min || n > max) return def;
  return n;
}
