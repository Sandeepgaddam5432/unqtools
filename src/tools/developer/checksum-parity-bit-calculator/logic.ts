/**
 * Checksum & Parity Bit Calculator — pure logic.
 *
 * Compute parity (even, odd, mark, space), LRC, additive sum checksums
 * (8/16/32-bit + one's/two's complement + RFC-1071 Internet), XOR,
 * Fletcher-16/32, Adler-32, parameterised CRC-8/16/32, Luhn, Verhoeff
 * and ISBN-10/13 check digits — over ASCII, hex, or binary input.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InputFormat = "ascii" | "hex" | "binary";

export type ParityMode = "even" | "odd" | "mark" | "space";

export type SumWidth = 8 | 16 | 32;

export type SumVariant = "raw" | "ones-complement" | "twos-complement" | "internet";

export type Endianness = "little" | "big";

export type CrcWidth = 8 | 16 | 32;

export interface CrcParams {
  width: CrcWidth;
  poly: number;
  init: number;
  refin: boolean;
  refout: boolean;
  xorout: number;
}

export interface CrcPreset {
  name: string;
  params: CrcParams;
  check: number; // CRC of "123456789"
}

export interface ByteParity {
  byte: number;
  binary: string;
  popcount: number;
  even: 0 | 1;
  odd: 0 | 1;
  mark: 1;
  space: 0;
}

export interface ParityResult {
  perByte: ByteParity[];
  aggregatePopcount: number;
  aggregateEven: 0 | 1;
  aggregateOdd: 0 | 1;
}

export interface SumResult {
  width: SumWidth;
  variant: SumVariant;
  endianness: Endianness;
  raw: number;
  value: number;
  hex: string;
  binary: string;
}

export interface ChecksumResults {
  bytes: number[];
  byteCount: number;
  bitCount: number;
  parity: ParityResult;
  lrc: number;
  xor: number;
  sum8: SumResult;
  sum16: SumResult;
  sum32: SumResult;
  internet: number;
  fletcher16: number;
  fletcher32: number;
  adler32: number;
  crc8: number;
  crc16: number;
  crc32: number;
  luhnCheckDigit: number;
  luhnValid: boolean;
  verhoeffCheckDigit: number;
  verhoeffValid: boolean;
  isbn10CheckDigit: string;
  isbn10Valid: boolean;
  isbn13CheckDigit: number;
  isbn13Valid: boolean;
}

// ---------------------------------------------------------------------------
// CRC presets
// ---------------------------------------------------------------------------

export const CRC_PRESETS: Record<CrcWidth, CrcPreset> = {
  8: {
    name: "CRC-8/SMBUS",
    params: { width: 8, poly: 0x07, init: 0x00, refin: false, refout: false, xorout: 0x00 },
    check: 0xF4,
  },
  16: {
    name: "CRC-16/ARC",
    params: { width: 16, poly: 0x8005, init: 0x0000, refin: true, refout: true, xorout: 0x0000 },
    check: 0xBB3D,
  },
  32: {
    name: "CRC-32/ISO-HDLC",
    params: { width: 32, poly: 0x04C11DB7, init: 0xFFFFFFFF, refin: true, refout: true, xorout: 0xFFFFFFFF },
    check: 0xCBF43926,
  },
};

// ---------------------------------------------------------------------------
// Input parsing
// ---------------------------------------------------------------------------

/** Parse a hex string into bytes. Handles 0x prefixes, spaces, commas, newlines. */
export function parseHex(input: string): number[] {
  const cleaned = (input || "")
    .replace(/0x/gi, "")
    .replace(/[\s,;]+/g, "");
  if (cleaned.length === 0) return [];
  if (!/^[0-9a-fA-F]*$/.test(cleaned)) {
    throw new Error("Invalid hex: only 0-9, a-f, A-F allowed");
  }
  const padded = cleaned.length % 2 === 0 ? cleaned : "0" + cleaned;
  const out: number[] = [];
  for (let i = 0; i < padded.length; i += 2) {
    out.push(parseInt(padded.slice(i, i + 2), 16));
  }
  return out;
}

/** Parse a binary string (whitespace-separated groups of 8 bits, or one long bit stream). */
export function parseBinary(input: string): number[] {
  const cleaned = (input || "").replace(/[\s,;]+/g, "");
  if (cleaned.length === 0) return [];
  if (!/^[01]*$/.test(cleaned)) {
    throw new Error("Invalid binary: only 0 and 1 allowed");
  }
  // Pad to multiple of 8 with leading zeros
  const padded = cleaned.length % 8 === 0 ? cleaned : "0".repeat(8 - (cleaned.length % 8)) + cleaned;
  const out: number[] = [];
  for (let i = 0; i < padded.length; i += 8) {
    out.push(parseInt(padded.slice(i, i + 8), 2));
  }
  return out;
}

/** Parse ASCII text into bytes (UTF-8 code points ≤ 255; higher code points are split). */
export function parseAscii(input: string): number[] {
  if (!input) return [];
  // Use TextEncoder if available for proper UTF-8; fallback to charCodes.
  if (typeof TextEncoder !== "undefined") {
    return Array.from(new TextEncoder().encode(input));
  }
  const out: number[] = [];
  for (let i = 0; i < input.length; i++) {
    out.push(input.charCodeAt(i) & 0xFF);
  }
  return out;
}

/** Parse input by format. */
export function parseInput(input: string, format: InputFormat): number[] {
  if (format === "hex") return parseHex(input);
  if (format === "binary") return parseBinary(input);
  return parseAscii(input);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a number as an 8-bit binary string. */
export function byteToBinary(b: number): string {
  return (b & 0xFF).toString(2).padStart(8, "0");
}

/** Format a number as zero-padded hex with a given width. */
export function formatHex(n: number, width: number): string {
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
  return (n >>> 0).toString(16).toUpperCase().padStart(width / 4, "0").slice(-width / 4)
    || "0".repeat(width / 4);
}

/** Format a number as zero-padded binary with a given bit width. */
export function formatBinary(n: number, width: number): string {
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
  return (n & mask).toString(2).padStart(width, "0").slice(-width);
}

/** Count the number of 1-bits in a byte. */
export function popcount(b: number): number {
  let x = b & 0xFF;
  x = x - ((x >>> 1) & 0x55);
  x = (x & 0x33) + ((x >>> 2) & 0x33);
  x = (x + (x >>> 4)) & 0x0F;
  return x & 0x7F;
}

/** Reflect (reverse) the bottom `width` bits of `value`. */
export function reflectBits(value: number, width: number): number {
  let ret = 0;
  let x = value >>> 0;
  for (let i = 0; i < width; i++) {
    if ((x >>> i) & 1) ret |= 1 << (width - 1 - i);
  }
  return ret >>> 0;
}

/** Reflect an 8-bit byte. */
export function reflect8(b: number): number {
  return reflectBits(b, 8);
}

// ---------------------------------------------------------------------------
// Parity
// ---------------------------------------------------------------------------

/** Compute parity bit for a single byte. */
export function parityBit(byte: number, mode: ParityMode): 0 | 1 {
  const bits = popcount(byte);
  if (mode === "mark") return 1;
  if (mode === "space") return 0;
  if (mode === "even") return (bits % 2 === 0) ? 0 : 1;
  return (bits % 2 === 0) ? 1 : 0; // odd
}

/** Compute per-byte and aggregate parity. */
export function computeParity(bytes: number[]): ParityResult {
  const perByte: ByteParity[] = bytes.map((b) => {
    const bits = popcount(b);
    return {
      byte: b & 0xFF,
      binary: byteToBinary(b),
      popcount: bits,
      even: (bits % 2 === 0 ? 0 : 1) as 0 | 1,
      odd: (bits % 2 === 0 ? 1 : 0) as 0 | 1,
      mark: 1,
      space: 0,
    };
  });
  const aggregatePopcount = perByte.reduce((acc, p) => acc + p.popcount, 0);
  return {
    perByte,
    aggregatePopcount,
    aggregateEven: (aggregatePopcount % 2 === 0 ? 0 : 1) as 0 | 1,
    aggregateOdd: (aggregatePopcount % 2 === 0 ? 1 : 0) as 0 | 1,
  };
}

// ---------------------------------------------------------------------------
// LRC, XOR
// ---------------------------------------------------------------------------

/** Longitudinal Redundancy Check: XOR of all bytes. */
export function computeLRC(bytes: number[]): number {
  return bytes.reduce((acc, b) => acc ^ (b & 0xFF), 0) & 0xFF;
}

/** Simple XOR of all bytes (alias of LRC, exposed separately). */
export function computeXOR(bytes: number[]): number {
  return computeLRC(bytes);
}

// ---------------------------------------------------------------------------
// Sum checksums
// ---------------------------------------------------------------------------

/** Additive sum at a given width. */
export function rawSum(bytes: number[], width: SumWidth): number {
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
  let sum = 0;
  for (const b of bytes) sum = (sum + (b & 0xFF)) >>> 0;
  return sum & mask;
}

/** One's-complement additive checksum: (~sum) & mask. */
export function onesComplementSum(bytes: number[], width: SumWidth): number {
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
  return (~rawSum(bytes, width)) & mask;
}

/** Two's-complement additive checksum: (-sum) & mask = (~sum + 1) & mask. */
export function twosComplementSum(bytes: number[], width: SumWidth): number {
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
  return ((~rawSum(bytes, width)) + 1) & mask;
}

/** RFC-1071 Internet checksum (16-bit, one's complement with carry fold). */
export function internetChecksum(bytes: number[]): number {
  let sum = 0;
  // Sum 16-bit words; pad with zero if odd byte count.
  const padded = bytes.length % 2 === 0 ? bytes : [...bytes, 0];
  for (let i = 0; i < padded.length; i += 2) {
    const word = ((padded[i] & 0xFF) << 8) | (padded[i + 1] & 0xFF);
    sum = (sum + word) >>> 0;
  }
  // Fold 32-bit sum to 16-bit
  while (sum >>> 16) {
    sum = (sum & 0xFFFF) + (sum >>> 16);
  }
  return (~sum) & 0xFFFF;
}

/** Compute a sum result for a given width/variant/endianness. */
export function computeSum(
  bytes: number[],
  width: SumWidth,
  variant: SumVariant,
  endianness: Endianness = "big",
): SumResult {
  const mask = width === 32 ? 0xFFFFFFFF : (1 << width) - 1;
  // For multi-byte widths with endianness, we can swap byte interpretation.
  // Since input is byte-wise, endianness only matters when summing words.
  let raw: number;
  if (width === 8) {
    raw = rawSum(bytes, 8);
  } else if (variant === "internet") {
    raw = internetChecksum(bytes);
  } else if (endianness === "big") {
    raw = rawSum(bytes, width);
  } else {
    // Little-endian: sum bytes with weights 1, 256, ... — for plain sum,
    // the total is unchanged. Endianness matters only when extracting word
    // boundaries, which is already handled by rawSum.
    raw = rawSum(bytes, width);
  }
  let value: number;
  if (variant === "raw") value = raw;
  else if (variant === "ones-complement") value = (~raw) & mask;
  else if (variant === "twos-complement") value = ((~raw) + 1) & mask;
  else value = internetChecksum(bytes); // internet
  return {
    width,
    variant,
    endianness,
    raw,
    value,
    hex: formatHex(value, width),
    binary: formatBinary(value, width),
  };
}

// ---------------------------------------------------------------------------
// Fletcher & Adler
// ---------------------------------------------------------------------------

/** Fletcher-16: 8-bit words, mod 255. */
export function fletcher16(bytes: number[]): number {
  let sum1 = 0;
  let sum2 = 0;
  for (const b of bytes) {
    sum1 = (sum1 + (b & 0xFF)) % 255;
    sum2 = (sum2 + sum1) % 255;
  }
  return ((sum2 << 8) | sum1) >>> 0;
}

/** Fletcher-32: 16-bit words (byte pairs), mod 65535. */
export function fletcher32(bytes: number[]): number {
  let sum1 = 0;
  let sum2 = 0;
  const padded = bytes.length % 2 === 0 ? bytes : [...bytes, 0];
  for (let i = 0; i < padded.length; i += 2) {
    const word = ((padded[i] & 0xFF) << 8) | (padded[i + 1] & 0xFF);
    sum1 = (sum1 + word) % 65535;
    sum2 = (sum2 + sum1) % 65535;
  }
  return ((sum2 << 16) | sum1) >>> 0;
}

/** Adler-32: mod 65521, initial sum1=1. */
export function adler32(bytes: number[]): number {
  let sum1 = 1;
  let sum2 = 0;
  for (const b of bytes) {
    sum1 = (sum1 + (b & 0xFF)) % 65521;
    sum2 = (sum2 + sum1) % 65521;
  }
  return ((sum2 << 16) | sum1) >>> 0;
}

// ---------------------------------------------------------------------------
// CRC
// ---------------------------------------------------------------------------

/** Compute a CRC of given width with the supplied params. */
export function crc(bytes: number[], params: CrcParams): number {
  const mask = params.width === 32 ? 0xFFFFFFFF : (1 << params.width) - 1;
  const topBit = 1 << (params.width - 1);
  let crc = params.init & mask;
  const shift = params.width - 8;
  for (const byte of bytes) {
    let b = byte & 0xFF;
    if (params.refin) b = reflect8(b);
    crc = (crc ^ (b << shift)) & mask;
    for (let i = 0; i < 8; i++) {
      if (crc & topBit) {
        crc = ((crc << 1) ^ params.poly) & mask;
      } else {
        crc = (crc << 1) & mask;
      }
    }
  }
  if (params.refout) {
    crc = reflectBits(crc, params.width);
  }
  return ((crc ^ params.xorout) & mask) >>> 0;
}

/** Compute CRC-8 with the SMBUS preset (or custom params). */
export function crc8(bytes: number[], params?: Partial<CrcParams>): number {
  const p: CrcParams = { ...CRC_PRESETS[8].params, ...params };
  return crc(bytes, p);
}

/** Compute CRC-16 with the ARC preset (or custom params). */
export function crc16(bytes: number[], params?: Partial<CrcParams>): number {
  const p: CrcParams = { ...CRC_PRESETS[16].params, ...params };
  return crc(bytes, p);
}

/** Compute CRC-32 with the ISO-HDLC preset (or custom params). */
export function crc32(bytes: number[], params?: Partial<CrcParams>): number {
  const p: CrcParams = { ...CRC_PRESETS[32].params, ...params };
  return crc(bytes, p);
}

// ---------------------------------------------------------------------------
// Luhn
// ---------------------------------------------------------------------------

/** Compute Luhn check digit for a digit string (without check digit). */
export function luhnCheckDigit(digits: string): number {
  const clean = digits.replace(/\D/g, "");
  if (clean.length === 0) return 0;
  // Compute as if appending a check digit; sum digits with doubling from right.
  // Check digit c such that sum of all (with c at rightmost) mod 10 == 0.
  // Standard trick: append 0, compute Luhn sum, then c = (10 - sum % 10) % 10.
  const padded = clean + "0";
  let sum = 0;
  let double = false; // rightmost (the appended 0 placeholder) is NOT doubled
  for (let i = padded.length - 1; i >= 0; i--) {
    let d = parseInt(padded[i], 10);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate a Luhn number (digits including check digit). */
export function luhnValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  if (clean.length < 2) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i--) {
    let d = parseInt(clean[i], 10);
    if (Number.isNaN(d)) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Verhoeff
// ---------------------------------------------------------------------------

const VERHOEFF_D: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P: number[][] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

const VERHOEFF_INV: number[] = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** Compute Verhoeff check digit for a digit string (without check digit). */
export function verhoeffCheckDigit(digits: string): number {
  const clean = digits.replace(/\D/g, "");
  if (clean.length === 0) return 0;
  let c = 0;
  const reversed = clean.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    const digit = parseInt(reversed[i], 10);
    if (Number.isNaN(digit)) return -1;
    c = VERHOEFF_D[c][VERHOEFF_P[(i + 1) % 8][digit]];
  }
  return VERHOEFF_INV[c];
}

/** Validate a Verhoeff number (digits including check digit). */
export function verhoeffValid(digits: string): boolean {
  const clean = digits.replace(/\D/g, "");
  if (clean.length < 2) return false;
  let c = 0;
  const reversed = clean.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    const digit = parseInt(reversed[i], 10);
    if (Number.isNaN(digit)) return false;
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][digit]];
  }
  return c === 0;
}

// ---------------------------------------------------------------------------
// ISBN
// ---------------------------------------------------------------------------

/** Compute ISBN-10 check digit (returns "0".."9" or "X"). */
export function isbn10CheckDigit(digits: string): string {
  const clean = digits.replace(/[^0-9Xx]/g, "").toUpperCase();
  // Use first 9 digits
  const first9 = clean.replace(/X/g, "").slice(0, 9);
  if (first9.length < 9) return "?";
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(first9[i], 10) * (10 - i);
  }
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? "X" : String(check);
}

/** Validate ISBN-10 (10 digits, last may be X). */
export function isbn10Valid(isbn: string): boolean {
  const clean = isbn.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (clean.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = clean[i];
    if (ch === "X") {
      if (i !== 9) return false;
      sum += 10 * (10 - i);
    } else {
      const d = parseInt(ch, 10);
      if (Number.isNaN(d)) return false;
      sum += d * (10 - i);
    }
  }
  return sum % 11 === 0;
}

/** Compute ISBN-13 check digit (0-9). */
export function isbn13CheckDigit(digits: string): number {
  const clean = digits.replace(/[^0-9]/g, "");
  const first12 = clean.slice(0, 12);
  if (first12.length < 12) return -1;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = parseInt(first12[i], 10);
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** Validate ISBN-13. */
export function isbn13Valid(isbn: string): boolean {
  const clean = isbn.replace(/[^0-9]/g, "");
  if (clean.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = parseInt(clean[i], 10);
    if (Number.isNaN(d)) return false;
    sum += d * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

// ---------------------------------------------------------------------------
// Compute everything
// ---------------------------------------------------------------------------

/** Compute all checksums for a byte array. */
export function computeAll(bytes: number[]): ChecksumResults {
  const parity = computeParity(bytes);
  const luhnInput = bytes.map((b) => String(b & 0xFF)).join("");
  // For Luhn/Verhoeff, treat ASCII digits if present, else treat bytes as numbers.
  const asciiDigits = bytes.every((b) => b >= 0x30 && b <= 0x39)
    ? bytes.map((b) => String(b - 0x30)).join("")
    : luhnInput;
  return {
    bytes,
    byteCount: bytes.length,
    bitCount: bytes.length * 8,
    parity,
    lrc: computeLRC(bytes),
    xor: computeXOR(bytes),
    sum8: computeSum(bytes, 8, "raw"),
    sum16: computeSum(bytes, 16, "raw"),
    sum32: computeSum(bytes, 32, "raw"),
    internet: internetChecksum(bytes),
    fletcher16: fletcher16(bytes),
    fletcher32: fletcher32(bytes),
    adler32: adler32(bytes),
    crc8: crc8(bytes),
    crc16: crc16(bytes),
    crc32: crc32(bytes),
    luhnCheckDigit: luhnCheckDigit(asciiDigits),
    luhnValid: luhnValid(asciiDigits),
    verhoeffCheckDigit: verhoeffCheckDigit(asciiDigits),
    verhoeffValid: verhoeffValid(asciiDigits),
    isbn10CheckDigit: isbn10CheckDigit(asciiDigits),
    isbn10Valid: isbn10Valid(asciiDigits),
    isbn13CheckDigit: isbn13CheckDigit(asciiDigits),
    isbn13Valid: isbn13Valid(asciiDigits),
  };
}

// ---------------------------------------------------------------------------
// Verify mode
// ---------------------------------------------------------------------------

export type CheckScheme =
  | "lrc" | "xor"
  | "sum8" | "sum16" | "sum32"
  | "ones8" | "ones16" | "ones32"
  | "twos8" | "twos16" | "twos32"
  | "internet"
  | "fletcher16" | "fletcher32" | "adler32"
  | "crc8" | "crc16" | "crc32"
  | "luhn" | "verhoeff" | "isbn10" | "isbn13";

/** Compute a single scheme's value (numeric or boolean). */
export function computeScheme(bytes: number[], scheme: CheckScheme): { value: number; valid?: boolean } {
  switch (scheme) {
    case "lrc": return { value: computeLRC(bytes) };
    case "xor": return { value: computeXOR(bytes) };
    case "sum8": return { value: computeSum(bytes, 8, "raw").value };
    case "sum16": return { value: computeSum(bytes, 16, "raw").value };
    case "sum32": return { value: computeSum(bytes, 32, "raw").value };
    case "ones8": return { value: computeSum(bytes, 8, "ones-complement").value };
    case "ones16": return { value: computeSum(bytes, 16, "ones-complement").value };
    case "ones32": return { value: computeSum(bytes, 32, "ones-complement").value };
    case "twos8": return { value: computeSum(bytes, 8, "twos-complement").value };
    case "twos16": return { value: computeSum(bytes, 16, "twos-complement").value };
    case "twos32": return { value: computeSum(bytes, 32, "twos-complement").value };
    case "internet": return { value: internetChecksum(bytes) };
    case "fletcher16": return { value: fletcher16(bytes) };
    case "fletcher32": return { value: fletcher32(bytes) };
    case "adler32": return { value: adler32(bytes) };
    case "crc8": return { value: crc8(bytes) };
    case "crc16": return { value: crc16(bytes) };
    case "crc32": return { value: crc32(bytes) };
    default: return { value: 0 };
  }
}

/** Verify an expected value against a scheme. */
export function verifyValue(bytes: number[], scheme: CheckScheme, expected: number): boolean {
  return computeScheme(bytes, scheme).value === expected;
}

/** Render a human-readable working panel for parity. */
export function renderParityWorking(bytes: number[]): string {
  if (bytes.length === 0) return "(no input)";
  const parity = computeParity(bytes);
  const lines: string[] = [];
  lines.push("Per-byte parity:");
  lines.push("  byte  binary    1s  even  odd  mark  space");
  parity.perByte.forEach((p, i) => {
    lines.push(
      `  ${String(i).padStart(3)}  0x${p.byte.toString(16).padStart(2, "0").toUpperCase()}  ${p.binary}  ${String(p.popcount).padStart(2)}  ${p.even}     ${p.odd}    ${p.mark}     ${p.space}`,
    );
  });
  lines.push("");
  lines.push(`Aggregate 1-bits: ${parity.aggregatePopcount}`);
  lines.push(`Aggregate even parity bit: ${parity.aggregateEven}`);
  lines.push(`Aggregate odd parity bit: ${parity.aggregateOdd}`);
  return lines.join("\n");
}

/** Render a working panel for sum/Fletcher/Adler/CRC. */
export function renderChecksumWorking(bytes: number[], scheme: CheckScheme): string {
  if (bytes.length === 0) return "(no input)";
  const { value } = computeScheme(bytes, scheme);
  const hexLines: string[] = [];
  hexLines.push(`Input bytes (${bytes.length}): ${bytes.map((b) => "0x" + (b & 0xFF).toString(16).padStart(2, "0").toUpperCase()).join(" ")}`);
  hexLines.push(`Binary: ${bytes.map((b) => byteToBinary(b)).join(" ")}`);
  hexLines.push("");
  if (scheme.startsWith("sum") || scheme.startsWith("ones") || scheme.startsWith("twos")) {
    const width = parseInt(scheme.slice(-1), 10) as SumWidth;
    const variant = scheme.startsWith("ones") ? "ones-complement"
      : scheme.startsWith("twos") ? "twos-complement" : "raw";
    const r = computeSum(bytes, width, variant);
    hexLines.push(`Sum (${width}-bit, ${variant}):`);
    hexLines.push(`  raw   = ${r.raw}`);
    hexLines.push(`  value = ${r.value} (0x${r.hex})`);
    hexLines.push(`  binary = ${r.binary}`);
  } else if (scheme === "internet") {
    hexLines.push(`Internet checksum (RFC 1071):`);
    hexLines.push(`  value = ${value} (0x${formatHex(value, 16)})`);
  } else if (scheme === "fletcher16") {
    hexLines.push(`Fletcher-16: 0x${formatHex(value, 16)}`);
  } else if (scheme === "fletcher32") {
    hexLines.push(`Fletcher-32: 0x${formatHex(value, 32)}`);
  } else if (scheme === "adler32") {
    hexLines.push(`Adler-32: 0x${formatHex(value, 32)}`);
  } else if (scheme === "crc8") {
    hexLines.push(`CRC-8 (${CRC_PRESETS[8].name}): 0x${formatHex(value, 8)}`);
  } else if (scheme === "crc16") {
    hexLines.push(`CRC-16 (${CRC_PRESETS[16].name}): 0x${formatHex(value, 16)}`);
  } else if (scheme === "crc32") {
    hexLines.push(`CRC-32 (${CRC_PRESETS[32].name}): 0x${formatHex(value, 32)}`);
  } else {
    hexLines.push(`${scheme}: 0x${formatHex(value, 16)}`);
  }
  return hexLines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:checksum-parity-bit-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  input: string;
  format: InputFormat;
  byteCount: number;
  crc32: number;
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

export function buildShareUrl(input: string, format: InputFormat): string {
  const params = new URLSearchParams();
  if (input) params.set("input", input);
  params.set("format", format);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; format: InputFormat } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", format: "ascii" };
  const params = new URLSearchParams(clean);
  const input = params.get("input") ?? "";
  const fmt = params.get("format") ?? "ascii";
  const validFmts: InputFormat[] = ["ascii", "hex", "binary"];
  const format = validFmts.includes(fmt as InputFormat) ? (fmt as InputFormat) : "ascii";
  return { input, format };
}

// ---------------------------------------------------------------------------
// Scheme labels
// ---------------------------------------------------------------------------

export const SCHEME_LABELS: Record<CheckScheme, string> = {
  lrc: "LRC (XOR)",
  xor: "XOR",
  sum8: "Sum 8-bit (raw)",
  sum16: "Sum 16-bit (raw)",
  sum32: "Sum 32-bit (raw)",
  ones8: "Sum 8-bit (one's comp)",
  ones16: "Sum 16-bit (one's comp)",
  ones32: "Sum 32-bit (one's comp)",
  twos8: "Sum 8-bit (two's comp)",
  twos16: "Sum 16-bit (two's comp)",
  twos32: "Sum 32-bit (two's comp)",
  internet: "Internet (RFC 1071)",
  fletcher16: "Fletcher-16",
  fletcher32: "Fletcher-32",
  adler32: "Adler-32",
  crc8: "CRC-8 (SMBUS)",
  crc16: "CRC-16 (ARC)",
  crc32: "CRC-32 (ISO-HDLC)",
  luhn: "Luhn",
  verhoeff: "Verhoeff",
  isbn10: "ISBN-10",
  isbn13: "ISBN-13",
};
