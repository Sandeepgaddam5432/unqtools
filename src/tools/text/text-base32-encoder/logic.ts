/**
 * Base32 Encoder (RFC 4648) — pure conversion logic. No DOM access.
 */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export interface Base32Result {
  output: string;
  inputLength: number;
  outputLength: number;
}

/** Encode a UTF-8 byte array to base32 (RFC 4648, padded). */
export function encodeBase32(bytes: number[]): string {
  let out = "";
  let buffer = 0;
  let bitsLeft = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | (byte & 0xff);
    bitsLeft += 8;
    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      const idx = (buffer >>> bitsLeft) & 0x1f;
      out += ALPHABET[idx];
    }
  }
  if (bitsLeft > 0) {
    const idx = (buffer << (5 - bitsLeft)) & 0x1f;
    out += ALPHABET[idx];
  }
  while (out.length % 8 !== 0) out += "=";
  return out;
}

/** Decode a base32 string to a byte array. Returns -1 on invalid char. */
export function decodeBase32(input: string): number[] | { error: string } {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  const out: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) return { error: `Invalid base32 character: ${ch}` };
    buffer = (buffer << 5) | idx;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      out.push((buffer >>> bitsLeft) & 0xff);
    }
  }
  return out;
}

/** Encode a JS string (UTF-8) to base32. */
export function encodeText(input: string): Base32Result {
  const bytes: number[] = [];
  for (const ch of Array.from(input)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  const output = encodeBase32(bytes);
  return { output, inputLength: input.length, outputLength: output.length };
}

/** Decode base32 back to a UTF-8 string. */
export function decodeText(input: string): Base32Result | { error: string } {
  const r = decodeBase32(input);
  if ("error" in r) return r;
  let out = "";
  let i = 0;
  const bytes = r;
  while (i < bytes.length) {
    const b1 = bytes[i]!;
    if (b1 < 0x80) { out += String.fromCharCode(b1); i++; }
    else if (b1 < 0xc0) { out += "\uFFFD"; i++; }
    else if (b1 < 0xe0) { out += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i + 1]! & 0x3f)); i += 2; }
    else if (b1 < 0xf0) { out += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i + 1]! & 0x3f) << 6) | (bytes[i + 2]! & 0x3f)); i += 3; }
    else { const cp = ((b1 & 0x07) << 18) | ((bytes[i + 1]! & 0x3f) << 12) | ((bytes[i + 2]! & 0x3f) << 6) | (bytes[i + 3]! & 0x3f); out += String.fromCodePoint(cp); i += 4; }
  }
  return { output: out, inputLength: input.length, outputLength: out.length };
}

export function validateInput(input: string, mode: "encode" | "decode"): { ok: true } | { error: string } {
  if (mode === "decode" && /[^A-Z2-7=\s]/i.test(input)) return { error: "Input contains invalid base32 characters" };
  return { ok: true };
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Base32 variants.
 */
export const BASE32_VARIANTS: ReadonlyArray<{ id: string; label: string; alphabet: string; description: string }> = [
  { id: "rfc4648", label: "RFC 4648 (Standard)", alphabet: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", description: "Standard Base32 with padding" },
  { id: "hex", label: "Base32 Hex", alphabet: "0123456789ABCDEFGHIJKLMNOPQRSTUV", description: "Extended hex alphabet (RFC 4648)" },
  { id: "crockford", label: "Crockford", alphabet: "0123456789ABCDEFGHJKMNPQRSTVWXYZ", description: "Douglas Crockford's variant for human-readable codes" },
  { id: "geohash", label: "Geohash", alphabet: "0123456789bcdefghjkmnpqrstuvwxyz", description: "Used in geohash encoding" },
  { id: "z-base-32", label: "z-base-32", alphabet: "ybndrfg8ejkmcpqxot1uwisza345h769", description: "Human-optimized Base32" },
];

/**
 * Encode with a specific variant.
 */
export function encodeBase32Variant(text: string, variantId: string = "rfc4648"): string {
  const variant = BASE32_VARIANTS.find((v) => v.id === variantId);
  if (!variant) throw new Error(`Unknown Base32 variant: ${variantId}`);
  const bytes = new TextEncoder().encode(text);
  return encodeBase32(bytes, variant.alphabet);
}

/**
 * Detect the Base32 variant used.
 */
export function detectBase32Variant(text: string): string | null {
  const upper = text.toUpperCase().replace(/=+$/, "");
  for (const variant of BASE32_VARIANTS) {
    const chars = variant.alphabet.toUpperCase();
    if ([...upper].every((c) => chars.includes(c) || c === "=")) {
      return variant.id;
    }
  }
  return null;
}

/**
 * Calculate Crockford checksum.
 */
export function crockfordChecksum(value: string): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ*~$=U";
  let sum = 0;
  for (const char of value.toUpperCase()) {
    const idx = alphabet.indexOf(char);
    if (idx >= 0) sum += idx;
  }
  return alphabet[sum % 37] ?? "?";
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateBase32Input(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const variant = detectBase32Variant(text);
  if (variant) reports.push({ level: "pass", code: "DETECTED", message: `Detected variant: ${variant}.` });
  else reports.push({ level: "warn", code: "UNKNOWN_VARIANT", message: "Could not detect Base32 variant." });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-base32-encoder", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "RFC-4648", citation: "RFC 4648 (2006)", summary: "The Base16, Base32, and Base64 Data Encodings." },
  { id: "Crockford-Base32", citation: "Douglas Crockford (2012)", summary: "Base32 Encoding for Human-Readable Data." },
];
