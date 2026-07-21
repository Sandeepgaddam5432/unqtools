/**
 * Two's Complement / Signed Integer Calculator — pure logic.
 *
 * Convert between signed decimal and two's-complement (and one's-complement /
 * sign-magnitude) binary at any width from 4 to 256 bits. Includes step-by-step
 * negation, a clickable bit grid, hex/octal views, range/overflow detection,
 * and sign-extension / truncation visualization. Pure functions only — no DOM,
 * no network. BigInt-correct at every width.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type WidthPreset = 4 | 8 | 16 | 32 | 64;

export const WIDTH_PRESETS: WidthPreset[] = [4, 8, 16, 32, 64];

export const MIN_CUSTOM_WIDTH = 4;
export const MAX_CUSTOM_WIDTH = 256;

export interface Representation {
  /** Binary string of length `width`, MSB-first. */
  bin: string;
  /** Hex string (no 0x prefix), upper-case, padded to whole nibbles. */
  hex: string;
  /** Octal string, no prefix. */
  oct: string;
  /** Decimal value as a signed integer string. */
  dec: string;
}

export interface NegationSteps {
  /** Original value (signed decimal). */
  original: bigint;
  /** Two's-complement bit pattern of the original (length = width). */
  originalBin: string;
  /** One's-complement (inverted) bit pattern. */
  invertedBin: string;
  /** Bit pattern after adding 1. */
  plusOneBin: string;
  /** Final negated value (signed decimal). */
  result: bigint;
  /** Step descriptions for UI. */
  steps: string[];
  /** True if the original value is the most-negative (no positive counterpart). */
  isMostNegative: boolean;
}

export interface BitCell {
  /** Bit position from LSB (0 .. width-1). */
  position: number;
  /** 2^position weight as a bigint. */
  weight: bigint;
  /** Bit value 0 or 1. */
  value: 0 | 1;
  /** True if this is the sign bit (MSB). */
  isSign: boolean;
}

export interface BitGrid {
  width: number;
  cells: BitCell[];
}

export interface RangeInfo {
  width: number;
  min: bigint;
  max: bigint;
  minBin: string;
  maxBin: string;
}

export interface ConversionResult {
  width: number;
  /** The signed decimal input value (already clamped if overflow). */
  input: bigint;
  /** The two's-complement bit pattern as a non-negative bigint (masked). */
  masked: bigint;
  /** Two's-complement representation (canonical). */
  twos: Representation;
  /** One's-complement representation of the magnitude (sign-magnitude style). */
  ones: Representation;
  /** Sign-magnitude representation. */
  signMag: Representation;
  /** Bit grid (MSB first) for the two's-complement form. */
  bitGrid: BitGrid;
  /** Range info for the chosen width. */
  range: RangeInfo;
  /** True if `input` is outside [min, max]. */
  overflow: boolean;
  /** Step-by-step negation (invert → +1). */
  negation: NegationSteps;
  /** Error message if the input is invalid. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Width helpers
// ---------------------------------------------------------------------------

export function isValidWidth(width: number): boolean {
  return Number.isInteger(width) && width >= MIN_CUSTOM_WIDTH && width <= MAX_CUSTOM_WIDTH;
}

export function normalizeWidth(width: number): number {
  if (!isValidWidth(width)) return 32;
  return width;
}

export function getRange(width: number): RangeInfo {
  const w = normalizeWidth(width);
  const min = -(1n << BigInt(w - 1));
  const max = (1n << BigInt(w - 1)) - 1n;
  return {
    width: w,
    min,
    max,
    minBin: toBinaryString(min, w),
    maxBin: toBinaryString(max, w),
  };
}

// ---------------------------------------------------------------------------
// Bit-width helpers
// ---------------------------------------------------------------------------

export function maskWidth(value: bigint, width: number): bigint {
  const w = normalizeWidth(width);
  const mask = (1n << BigInt(w)) - 1n;
  return value & mask;
}

export function signExtend(value: bigint, width: number): bigint {
  const w = normalizeWidth(width);
  const signBit = 1n << BigInt(w - 1);
  const masked = maskWidth(value, w);
  if (masked & signBit) {
    return masked - (1n << BigInt(w));
  }
  return masked;
}

export function toBinaryString(value: bigint, width: number): string {
  const w = normalizeWidth(width);
  const masked = maskWidth(value, w);
  let s = "";
  for (let i = w - 1; i >= 0; i--) {
    s += masked & (1n << BigInt(i)) ? "1" : "0";
  }
  return s;
}

export function groupNibbles(bin: string): string {
  const cleaned = bin.replace(/[^01]/g, "");
  if (!cleaned) return "";
  const pad = (4 - (cleaned.length % 4)) % 4;
  const padded = "0".repeat(pad) + cleaned;
  const out: string[] = [];
  for (let i = 0; i < padded.length; i += 4) {
    out.push(padded.slice(i, i + 4));
  }
  return out.join(" ");
}

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

function charDigitValue(ch: string): number {
  if (ch >= "0" && ch <= "9") return ch.charCodeAt(0) - "0".charCodeAt(0);
  if (ch >= "a" && ch <= "z") return ch.charCodeAt(0) - "a".charCodeAt(0) + 10;
  if (ch >= "A" && ch <= "Z") return ch.charCodeAt(0) - "A".charCodeAt(0) + 10;
  return -1;
}

function parseBigIntFromBase(digits: string, base: number): bigint {
  let result = 0n;
  const b = BigInt(base);
  for (const ch of digits) {
    if (ch === "_") continue;
    const d = charDigitValue(ch);
    if (d < 0) throw new Error(`Invalid digit '${ch}'`);
    result = result * b + BigInt(d);
  }
  return result;
}

export interface ParsedInput {
  value: bigint;
  base: number;
  raw: string;
  /** True if the input was already given as a bit pattern (binary / hex / octal). */
  isBitPattern: boolean;
}

/**
 * Parse a signed decimal or a bit-pattern literal (0x hex, 0b binary, 0o octal).
 * Bit-pattern literals are interpreted as the raw two's-complement pattern at
 * the chosen width — so 0xFF at 8-bit means -1, not +255.
 */
export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty input");
  let negative = false;
  let rest = trimmed;
  if (rest.startsWith("-")) { negative = true; rest = rest.slice(1); }
  else if (rest.startsWith("+")) rest = rest.slice(1);
  let base = 10;
  let isBitPattern = false;
  const lower = rest.toLowerCase();
  if (lower.startsWith("0x")) { base = 16; rest = rest.slice(2); isBitPattern = true; }
  else if (lower.startsWith("0b")) { base = 2; rest = rest.slice(2); isBitPattern = true; }
  else if (lower.startsWith("0o")) { base = 8; rest = rest.slice(2); isBitPattern = true; }
  if (!rest) throw new Error("No digits");
  for (const ch of rest) {
    if (ch === "_") continue;
    const d = charDigitValue(ch);
    if (d < 0 || d >= base) throw new Error(`Invalid digit '${ch}' for base ${base}`);
  }
  let value = parseBigIntFromBase(rest, base);
  if (negative) value = -value;
  return { value, base, raw: input, isBitPattern };
}

// ---------------------------------------------------------------------------
// Representation builders
// ---------------------------------------------------------------------------

function padHex(value: bigint, width: number): string {
  const nibbles = Math.ceil(width / 4);
  return value.toString(16).toUpperCase().padStart(nibbles, "0");
}

function padOct(value: bigint, width: number): string {
  const digits = Math.ceil(width / 3);
  return value.toString(8).padStart(digits, "0");
}

export function buildRepresentation(masked: bigint, width: number, signedValue: bigint): Representation {
  return {
    bin: toBinaryString(masked, width),
    hex: padHex(masked, width),
    oct: padOct(masked, width),
    dec: signedValue.toString(10),
  };
}

/**
 * One's-complement representation of a value at the given width.
 * For non-negative values, this is the same as two's complement.
 * For negative values, it's (2^width - 1 + value) — i.e. flip every bit of
 * the magnitude (sign-magnitude with sign bit set) and the magnitude bits inverted.
 */
export function onesComplement(value: bigint, width: number): Representation {
  const w = normalizeWidth(width);
  const range = getRange(w);
  let masked: bigint;
  let signed: bigint;
  if (value >= 0n) {
    if (value > range.max) value = range.max;
    masked = maskWidth(value, w);
    signed = masked; // positive
  } else {
    if (value < range.min) value = range.min;
    // One's complement: -x → (2^w - 1) - (|x| - 1) = (2^w - 1) + value
    masked = ((1n << BigInt(w)) - 1n) + value;
    signed = value;
  }
  return buildRepresentation(masked, w, signed);
}

/**
 * Sign-magnitude representation: MSB is the sign (1 for negative), remaining
 * bits hold the magnitude. Note: this gives two representations of zero
 * (+0 = 0000, −0 = 1000).
 */
export function signMagnitude(value: bigint, width: number): Representation {
  const w = normalizeWidth(width);
  const range = getRange(w);
  let v = value;
  if (v > range.max) v = range.max;
  if (v < range.min) v = range.min;
  const signBit = v < 0n ? 1n << BigInt(w - 1) : 0n;
  const mag = v < 0n ? -v : v;
  // Magnitude must fit in (w-1) bits.
  const magMask = (1n << BigInt(w - 1)) - 1n;
  const maskedMag = mag & magMask;
  const masked = signBit | maskedMag;
  return buildRepresentation(masked, w, v);
}

// ---------------------------------------------------------------------------
// Bit grid
// ---------------------------------------------------------------------------

export function buildBitGrid(value: bigint, width: number): BitGrid {
  const w = normalizeWidth(width);
  const masked = maskWidth(value, w);
  const cells: BitCell[] = [];
  for (let i = w - 1; i >= 0; i--) {
    const bit = masked & (1n << BigInt(i)) ? 1 : 0;
    cells.push({
      position: i,
      weight: 1n << BigInt(i),
      value: bit as 0 | 1,
      isSign: i === w - 1,
    });
  }
  return { width: w, cells };
}

/**
 * Toggle bit at `position` (0 = LSB). Returns the new signed decimal value.
 */
export function toggleBit(currentValue: bigint, position: number, width: number): bigint {
  const w = normalizeWidth(width);
  if (position < 0 || position >= w) return currentValue;
  const masked = maskWidth(currentValue, w);
  const newMasked = masked ^ (1n << BigInt(position));
  return signExtend(newMasked, w);
}

/**
 * Set bit at `position` to a specific value (0 or 1).
 */
export function setBit(currentValue: bigint, position: number, value: 0 | 1, width: number): bigint {
  const w = normalizeWidth(width);
  if (position < 0 || position >= w) return currentValue;
  const masked = maskWidth(currentValue, w);
  const bitMask = 1n << BigInt(position);
  const newMasked = value === 1 ? (masked | bitMask) : (masked & ~bitMask);
  return signExtend(newMasked, w);
}

// ---------------------------------------------------------------------------
// Negation steps
// ---------------------------------------------------------------------------

export function computeNegation(value: bigint, width: number): NegationSteps {
  const w = normalizeWidth(width);
  const range = getRange(w);
  const isMostNegative = value === range.min;
  const originalBin = toBinaryString(value, w);
  // Invert every bit.
  const inverted = maskWidth(~value, w);
  const invertedBin = toBinaryString(inverted, w);
  // Add 1.
  const plusOne = maskWidth(inverted + 1n, w);
  const plusOneBin = toBinaryString(plusOne, w);
  const result = signExtend(plusOne, w);
  const steps: string[] = [
    `Original: ${value} → ${originalBin}`,
    `Step 1 — invert every bit (one's complement): ${invertedBin}`,
    `Step 2 — add 1: ${invertedBin} + 1 = ${plusOneBin}`,
    `Result: ${result}`,
  ];
  if (isMostNegative) {
    steps.push(`Note: ${value} is the most-negative value (${range.min}); its negation overflows back to itself.`);
  }
  return {
    original: value,
    originalBin,
    invertedBin,
    plusOneBin,
    result,
    steps,
    isMostNegative,
  };
}

// ---------------------------------------------------------------------------
// Sign extension / truncation
// ---------------------------------------------------------------------------

export interface WidthChange {
  fromWidth: number;
  toWidth: number;
  fromBin: string;
  toBin: string;
  /** True if data was lost (truncation with non-sign-fitting high bits). */
  truncated: boolean;
  /** True if the value is preserved exactly. */
  preserved: boolean;
  /** Description for UI. */
  description: string;
}

export function changeWidth(value: bigint, fromWidth: number, toWidth: number): WidthChange {
  const fw = normalizeWidth(fromWidth);
  const tw = normalizeWidth(toWidth);
  const fromBin = toBinaryString(value, fw);
  if (tw >= fw) {
    // Sign-extend.
    const signed = signExtend(value, fw);
    const toBin = toBinaryString(signed, tw);
    return {
      fromWidth: fw,
      toWidth: tw,
      fromBin,
      toBin,
      truncated: false,
      preserved: true,
      description: `Sign-extended from ${fw} to ${tw} bits — sign bit (${fromBin[0]}) replicated into the new high-order positions.`,
    };
  }
  // Truncate.
  const signed = signExtend(value, fw);
  const toBin = toBinaryString(signed, tw);
  const droppedBits = fromBin.slice(0, fw - tw);
  const newSignBit = toBin[0];
  const allDroppedSame = droppedBits.length > 0 && droppedBits.split("").every((b) => b === newSignBit);
  const preserved = allDroppedSame;
  return {
    fromWidth: fw,
    toWidth: tw,
    fromBin,
    toBin,
    truncated: !preserved,
    preserved,
    description: preserved
      ? `Truncated from ${fw} to ${tw} bits — all dropped high-order bits matched the new sign bit, so the value is preserved.`
      : `Truncated from ${fw} to ${tw} bits — at least one dropped high-order bit differed from the new sign bit, so the value changed (overflow).`,
  };
}

// ---------------------------------------------------------------------------
// Top-level conversion
// ---------------------------------------------------------------------------

export function convert(inputStr: string, width: number): ConversionResult {
  const w = normalizeWidth(width);
  const range = getRange(w);
  const empty: ConversionResult = {
    width: w,
    input: 0n,
    masked: 0n,
    twos: buildRepresentation(0n, w, 0n),
    ones: onesComplement(0n, w),
    signMag: signMagnitude(0n, w),
    bitGrid: buildBitGrid(0n, w),
    range,
    overflow: false,
    negation: computeNegation(0n, w),
  };

  let parsed: ParsedInput;
  try {
    parsed = parseInput(inputStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Parse error";
    return { ...empty, error: msg };
  }

  let value = parsed.value;
  let overflow = false;
  if (parsed.isBitPattern) {
    // Bit-pattern input: mask to width, then sign-extend.
    const masked = maskWidth(value, w);
    value = signExtend(masked, w);
  } else {
    if (value < range.min || value > range.max) {
      overflow = true;
    }
  }

  const masked = maskWidth(value, w);
  const signed = signExtend(masked, w);

  return {
    width: w,
    input: signed,
    masked,
    twos: buildRepresentation(masked, w, signed),
    ones: onesComplement(signed, w),
    signMag: signMagnitude(signed, w),
    bitGrid: buildBitGrid(masked, w),
    range,
    overflow,
    negation: computeNegation(signed, w),
  };
}

/**
 * Convenience: convert a signed decimal bigint to a ConversionResult directly.
 */
export function convertValue(value: bigint, width: number): ConversionResult {
  const w = normalizeWidth(width);
  const range = getRange(w);
  const overflow = value < range.min || value > range.max;
  const masked = maskWidth(value, w);
  const signed = signExtend(masked, w);
  return {
    width: w,
    input: signed,
    masked,
    twos: buildRepresentation(masked, w, signed),
    ones: onesComplement(signed, w),
    signMag: signMagnitude(signed, w),
    bitGrid: buildBitGrid(masked, w),
    range,
    overflow,
    negation: computeNegation(signed, w),
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:twos-complement-signed-integer-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  width: number;
  dec: string;
  hex: string;
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
  width: number;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.input) params.set("v", state.input);
  params.set("w", String(state.width));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", width: 32 };
  const params = new URLSearchParams(clean);
  const input = params.get("v") ?? "";
  const wRaw = params.get("w");
  let width = 32;
  if (wRaw !== null) {
    const w = parseInt(wRaw, 10);
    if (isValidWidth(w)) width = w;
  }
  return { input, width };
}
