/**
 * Endianness (Byte Order) Converter — pure logic.
 *
 * Convert between big-endian, little-endian and middle-endian (PDP-11) byte
 * orders across 16/32/64-bit words. Decode each ordering as signed/unsigned
 * int and IEEE 754 float32 / float64. Pure functions only — no DOM, no
 * network. Uses DataView for float decoding, BigInt for 64-bit ints.
 */

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type WordSize = 16 | 32 | 64;
export type Endianness = "be" | "le" | "pdp";
export type IntSign = "signed" | "unsigned";

export interface DecodeResult {
  bytes: number[];                 // bytes in this endianness's order
  hex: string;                     // bytes joined as hex string (no separator)
  groupedHex: string;              // bytes joined with spaces
  asIntUnsigned: string;           // decimal string of unsigned bigint
  asIntSigned: string;             // decimal string of signed bigint (two's complement)
  asFloat32: number | null;        // float32 interpretation, or null if not 4 bytes
  asFloat64: number | null;        // float64 interpretation, or null if not 8 bytes
  float32Hex: string | null;       // raw IEEE 754 bits as hex
  float64Hex: string | null;
  warning?: string;
}

export interface ConversionResult {
  input: number[];                 // original bytes (as parsed from hex)
  wordSize: WordSize;
  bigEndian: DecodeResult;
  littleEndian: DecodeResult;
  pdpMiddle: DecodeResult;
  warnings: string[];
  error?: string;
}

export interface BatchResult {
  words: ConversionResult[];
  warnings: string[];
  error?: string;
}

export const WORD_SIZES: WordSize[] = [16, 32, 64];

export const ENDIANNESS_LABELS: Record<Endianness, string> = {
  be: "Big-endian (BE)",
  le: "Little-endian (LE)",
  pdp: "Middle-endian (PDP-11)",
};

export const ENDIANNESS_SHORT: Record<Endianness, string> = {
  be: "BE",
  le: "LE",
  pdp: "PDP",
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Parse a hex string into an array of bytes. Accepts optional 0x prefix,
 *  whitespace, colons, dashes, underscores as separators. Throws on invalid
 *  hex or odd-length input (after stripping separators). */
export function parseHexInput(input: string): number[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty hex input");
  // Strip 0x prefix if present
  let s = trimmed;
  if (s.toLowerCase().startsWith("0x")) s = s.slice(2);
  // Strip separators: space, colon, dash, underscore, comma, newline
  s = s.replace(/[\s:_\-,]+/g, "");
  if (s.length === 0) throw new Error("No hex digits");
  if (s.length % 2 !== 0) throw new Error(`Odd number of hex digits (${s.length})`);
  if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error("Invalid hex characters");
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i += 2) {
    bytes.push(parseInt(s.slice(i, i + 2), 16));
  }
  return bytes;
}

/** Parse an integer literal (decimal, 0x hex, 0b binary, 0o octal). Returns
 *  a non-negative bigint. */
export function parseInteger(input: string): bigint {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty input");
  let negative = false;
  let rest = trimmed;
  if (rest.startsWith("-")) { negative = true; rest = rest.slice(1); }
  else if (rest.startsWith("+")) rest = rest.slice(1);
  let base = 10;
  const lower = rest.toLowerCase();
  if (lower.startsWith("0x")) { base = 16; rest = rest.slice(2); }
  else if (lower.startsWith("0b")) { base = 2; rest = rest.slice(2); }
  else if (lower.startsWith("0o")) { base = 8; rest = rest.slice(2); }
  if (!rest) throw new Error("No digits");
  let result = 0n;
  const b = BigInt(base);
  for (const ch of rest) {
    if (ch === "_") continue;
    let d: number;
    if (ch >= "0" && ch <= "9") d = ch.charCodeAt(0) - "0".charCodeAt(0);
    else if (ch >= "a" && ch <= "z") d = ch.charCodeAt(0) - "a".charCodeAt(0) + 10;
    else if (ch >= "A" && ch <= "Z") d = ch.charCodeAt(0) - "A".charCodeAt(0) + 10;
    else throw new Error(`Invalid character '${ch}'`);
    if (d >= base) throw new Error(`Invalid digit '${ch}' for base ${base}`);
    result = result * b + BigInt(d);
  }
  return negative ? -result : result;
}

// ---------------------------------------------------------------------------
// Byte-array <-> BigInt conversions (big-endian)
// ---------------------------------------------------------------------------

/** Convert a byte array (big-endian) to a bigint. */
export function bytesBEToBigInt(bytes: number[]): bigint {
  let v = 0n;
  for (const b of bytes) {
    v = (v << 8n) | BigInt(b & 0xff);
  }
  return v;
}

/** Convert a non-negative bigint to a big-endian byte array, zero-padded to
 *  the given length. */
export function bigIntToBytesBE(value: bigint, length: number): number[] {
  if (value < 0n) throw new Error("Value must be non-negative");
  const bytes: number[] = new Array(length).fill(0);
  let v = value;
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v = v >> 8n;
  }
  if (v > 0n) {
    // Overflow — keep only low `length` bytes (the truncation is documented)
    // but flag it via a thrown error so callers can handle.
    throw new Error(`Value 0x${value.toString(16)} exceeds ${length} bytes`);
  }
  return bytes;
}

/** Mask a bigint to a given bit width. */
export function maskToWidth(value: bigint, wordSize: WordSize): bigint {
  const mask = (1n << BigInt(wordSize)) - 1n;
  return value & mask;
}

/** Reinterpret a masked bigint as signed two's-complement at the given width. */
export function asSigned(value: bigint, wordSize: WordSize): bigint {
  const masked = maskToWidth(value, wordSize);
  const signBit = 1n << BigInt(wordSize - 1);
  if (masked & signBit) {
    return masked - (1n << BigInt(wordSize));
  }
  return masked;
}

// ---------------------------------------------------------------------------
// Endianness swaps
// ---------------------------------------------------------------------------

/** Reverse a byte array (BE ↔ LE swap). */
export function reverseBytes(bytes: number[]): number[] {
  return [...bytes].reverse();
}

/** Swap to PDP-11 middle-endian. For 16-bit, PDP = LE (reverse of BE input).
 *  For 32-bit: bytes [b0,b1,b2,b3] (BE) → [b1,b0,b3,b2] (PDP).
 *  For 64-bit: each 32-bit word is PDP-swapped, words in original order. */
export function toPdpBytes(bytes: number[]): number[] {
  if (bytes.length === 2) {
    // 16-bit PDP = LE
    return [...bytes].reverse();
  }
  if (bytes.length === 4) {
    // 32-bit PDP: swap halves of 16-bit words
    return [bytes[1], bytes[0], bytes[3], bytes[2]];
  }
  if (bytes.length === 8) {
    // 64-bit: each 32-bit word is PDP-swapped
    return [
      bytes[1], bytes[0], bytes[3], bytes[2],
      bytes[5], bytes[4], bytes[7], bytes[6],
    ];
  }
  // General fallback: PDP swap each 4-byte word
  if (bytes.length % 4 === 0) {
    const out: number[] = [];
    for (let i = 0; i < bytes.length; i += 4) {
      out.push(bytes[i + 1], bytes[i], bytes[i + 3], bytes[i + 2]);
    }
    return out;
  }
  // 2-byte aligned: swap pairs
  if (bytes.length % 2 === 0) {
    const out: number[] = [];
    for (let i = 0; i < bytes.length; i += 2) {
      out.push(bytes[i + 1], bytes[i]);
    }
    return out;
  }
  return [...bytes];
}

/** Convert bytes from one endianness to another. The input `bytes` are
 *  interpreted as already being in `from` endianness; the output is the
 *  same value's bytes in `to` endianness. */
export function convertEndiannessBytes(
  bytes: number[],
  from: Endianness,
  to: Endianness,
): number[] {
  if (from === to) return [...bytes];
  // Convert from → BE, then BE → to
  const be = fromBE(bytes, from);
  return fromBE(be, to); // fromBE is symmetric: BE → to == to → BE
}

/** Helper: convert bytes between BE and a target endianness. Since all of
 *  BE/LE/PDP are involutions (applying twice gives back the original), this
 *  function works in both directions: input BE → output `endian`, or input
 *  `endian` → output BE. */
function fromBE(bytes: number[], endian: Endianness): number[] {
  switch (endian) {
    case "be": return [...bytes];
    case "le": return [...bytes].reverse();
    case "pdp": return toPdpBytes(bytes);
  }
}

// ---------------------------------------------------------------------------
// Float decoding (uses DataView)
// ---------------------------------------------------------------------------

/** Decode 4 bytes as IEEE 754 float32 in the given endianness. Returns null
 *  if not exactly 4 bytes. */
export function decodeAsFloat32(bytes: number[], endian: Endianness): number | null {
  if (bytes.length !== 4) return null;
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  const ordered = fromBE(bytes, endian);
  for (let i = 0; i < 4; i++) view.setUint8(i, ordered[i]);
  return view.getFloat32(0, false); // false = big-endian within the reordered bytes
}

/** Decode 8 bytes as IEEE 754 float64 in the given endianness. Returns null
 *  if not exactly 8 bytes. */
export function decodeAsFloat64(bytes: number[], endian: Endianness): number | null {
  if (bytes.length !== 8) return null;
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  const ordered = fromBE(bytes, endian);
  for (let i = 0; i < 8; i++) view.setUint8(i, ordered[i]);
  return view.getFloat64(0, false);
}

/** Encode a JS number as IEEE 754 float32 bytes in the given endianness. */
export function encodeAsFloat32(value: number, endian: Endianness): number[] {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, value, false);
  const be: number[] = [];
  for (let i = 0; i < 4; i++) be.push(view.getUint8(i));
  return fromBE(be, endian);
}

/** Encode a JS number as IEEE 754 float64 bytes in the given endianness. */
export function encodeAsFloat64(value: number, endian: Endianness): number[] {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, value, false);
  const be: number[] = [];
  for (let i = 0; i < 8; i++) be.push(view.getUint8(i));
  return fromBE(be, endian);
}

// ---------------------------------------------------------------------------
// Main conversion: bytes → all three endian decodings
// ---------------------------------------------------------------------------

function buildDecodeResult(
  bytes: number[],
  wordSize: WordSize,
  endian: Endianness,
): DecodeResult {
  // For each endianness E, we report:
  //   - The original bytes (raw input — they don't change)
  //   - The integer / float value those bytes decode to when interpreted as E
  // The interpretation as E means: treat the bytes as E and read out the
  // integer/float. To compute that, we reorder the bytes from E to BE and
  // read as a normal BE integer.
  const beForm = fromBE(bytes, endian);
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  const groupedHex = bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
  const unsigned = bytesBEToBigInt(beForm);
  const unsignedMasked = maskToWidth(unsigned, wordSize);
  const signed = asSigned(unsigned, wordSize);
  const f32 = decodeAsFloat32(bytes, endian);
  const f64 = decodeAsFloat64(bytes, endian);
  return {
    bytes: [...bytes],
    hex,
    groupedHex,
    asIntUnsigned: unsignedMasked.toString(10),
    asIntSigned: signed.toString(10),
    asFloat32: f32,
    asFloat64: f64,
    float32Hex: f32 === null ? null : encodeAsFloat32(f32, "be").map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(),
    float64Hex: f64 === null ? null : encodeAsFloat64(f64, "be").map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(),
  };
}

/** Main conversion function. Given raw bytes and a word size, returns the
 *  byte sequence and decoded values for BE, LE and PDP orderings. */
export function convertEndianness(input: number[], wordSize: WordSize): ConversionResult {
  const expectedBytes = wordSize / 8;
  const warnings: string[] = [];
  let bytes = input;

  if (bytes.length === 0) {
    return {
      input: [],
      wordSize,
      bigEndian: emptyDecode(),
      littleEndian: emptyDecode(),
      pdpMiddle: emptyDecode(),
      warnings,
      error: "No bytes",
    };
  }

  if (bytes.length !== expectedBytes) {
    if (bytes.length < expectedBytes) {
      // Zero-pad on the left (high) side
      warnings.push(`Input has ${bytes.length} byte(s); padded to ${expectedBytes} bytes (left-padded with zeros)`);
      bytes = [...new Array(expectedBytes - bytes.length).fill(0), ...bytes];
    } else {
      // Truncate to low bytes
      warnings.push(`Input has ${bytes.length} bytes; truncated to ${expectedBytes} bytes (kept low-order bytes)`);
      bytes = bytes.slice(bytes.length - expectedBytes);
    }
  }

  return {
    input: bytes,
    wordSize,
    bigEndian: buildDecodeResult(bytes, wordSize, "be"),
    littleEndian: buildDecodeResult(bytes, wordSize, "le"),
    pdpMiddle: buildDecodeResult(bytes, wordSize, "pdp"),
    warnings,
  };
}

function emptyDecode(): DecodeResult {
  return {
    bytes: [],
    hex: "",
    groupedHex: "",
    asIntUnsigned: "0",
    asIntSigned: "0",
    asFloat32: null,
    asFloat64: null,
    float32Hex: null,
    float64Hex: null,
  };
}

// ---------------------------------------------------------------------------
// Batch conversion: split a byte array into words and convert each
// ---------------------------------------------------------------------------

export function batchConvert(input: number[], wordSize: WordSize): BatchResult {
  const expectedBytes = wordSize / 8;
  if (input.length === 0) {
    return { words: [], warnings: [], error: "No bytes" };
  }
  const warnings: string[] = [];
  if (input.length % expectedBytes !== 0) {
    warnings.push(`Input length (${input.length} bytes) is not a multiple of word size (${expectedBytes} bytes); last partial word will be zero-padded`);
  }
  const words: ConversionResult[] = [];
  for (let i = 0; i < input.length; i += expectedBytes) {
    const chunk = input.slice(i, i + expectedBytes);
    while (chunk.length < expectedBytes) chunk.push(0);
    words.push(convertEndianness(chunk, wordSize));
  }
  return { words, warnings };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/** Group bytes into space-separated uppercase hex pairs. */
export function groupBytes(bytes: number[], groupSize: number = 1): string {
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase());
  if (groupSize <= 1) return hex.join(" ");
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += groupSize) {
    out.push(hex.slice(i, i + groupSize).join(""));
  }
  return out.join(" ");
}

/** Format bytes as a C-style array literal. */
export function formatCArray(bytes: number[], name: string = "data"): string {
  const lines: string[] = [];
  lines.push(`uint8_t ${name}[${bytes.length}] = {`);
  for (let i = 0; i < bytes.length; i += 8) {
    const chunk = bytes.slice(i, i + 8);
    lines.push("    " + chunk.map((b) => "0x" + b.toString(16).padStart(2, "0").toUpperCase()).join(", ") + (i + 8 < bytes.length ? "," : ""));
  }
  lines.push("};");
  return lines.join("\n");
}

/** Describe a byte position with a colored CSS-friendly label for UI use. */
export interface ByteCell {
  index: number;       // position in the array (0-based)
  value: number;       // 0..255
  hex: string;         // "0A"
  wordIndex: number;   // which word this byte belongs to (0-based)
  positionInWord: number; // 0-based offset within the word
  endianRole: Record<Endianness, string>; // e.g. { be: "MSB", le: "LSB", pdp: "MSB" }
}

/** Build a per-byte cell array with endianness role labels for visualization. */
export function buildByteCells(bytes: number[], wordSize: WordSize): ByteCell[] {
  const bytesPerWord = wordSize / 8;
  return bytes.map((b, i) => {
    const wordIndex = Math.floor(i / bytesPerWord);
    const positionInWord = i % bytesPerWord;
    const endianRole: Record<Endianness, string> = {
      be: `B${bytesPerWord - 1 - positionInWord}`,  // BE: first byte = MSB
      le: `B${positionInWord}`,                     // LE: first byte = LSB
      pdp: pdpRole(positionInWord, bytesPerWord),
    };
    return {
      index: i,
      value: b,
      hex: b.toString(16).padStart(2, "0").toUpperCase(),
      wordIndex,
      positionInWord,
      endianRole,
    };
  });
}

function pdpRole(pos: number, bytesPerWord: number): string {
  // PDP: 32-bit → [b1,b0,b3,b2] from BE [b0,b1,b2,b3] (b0=MSB)
  // Role: position 0 → byte 1 of BE (b1), pos 1 → byte 0 (b0=MSB),
  //       pos 2 → byte 3, pos 3 → byte 2 (b2=LSB+1)
  if (bytesPerWord === 2) return `B${1 - pos}`; // PDP=LE for 16-bit
  if (bytesPerWord === 4) {
    const map = [1, 0, 3, 2];
    return `B${map[pos]}`;
  }
  if (bytesPerWord === 8) {
    const map = [1, 0, 3, 2, 5, 4, 7, 6];
    return `B${map[pos]}`;
  }
  return `B${pos}`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:endianness-byte-order-converter:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  inputHex: string;
  wordSize: WordSize;
  beUnsigned: string;
  leUnsigned: string;
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
// Shareable URL — encodes input hex + word size
// ---------------------------------------------------------------------------

export interface ShareState {
  inputHex: string; // hex string without 0x prefix, no separators
  wordSize: WordSize;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.inputHex) params.set("h", state.inputHex);
  params.set("w", String(state.wordSize));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const h = params.get("h");
  const wRaw = params.get("w");
  if (h === null && wRaw === null) return null;
  let wordSize: WordSize = 32;
  if (wRaw !== null) {
    const w = parseInt(wRaw, 10);
    if (w === 16 || w === 32 || w === 64) wordSize = w;
  }
  return { inputHex: h ?? "", wordSize };
}
