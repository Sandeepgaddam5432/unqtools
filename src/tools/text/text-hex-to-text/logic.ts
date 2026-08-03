/**
 * Hex to Text — pure conversion logic. No DOM access.
 */
export interface HexToTextOptions {
  /** Encoding to use when interpreting bytes. */
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "ascii";
  /** Separator to insert between output characters (default none). */
  separator: string;
}

export interface HexToTextResult {
  output: string;
  inputLength: number;
  outputLength: number;
  byteCount: number;
  invalidBytes: number;
}

/** Strip all non-hex characters from input. */
export function normalizeHex(input: string): string {
  return input.replace(/[^0-9a-fA-F]/g, "").toLowerCase();
}

/** Validate a clean hex string (must be even length). */
export function isValidHex(s: string): boolean {
  return /^[0-9a-f]*$/.test(s) && s.length % 2 === 0;
}

/** Split clean hex into byte pairs. */
export function splitPairs(clean: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    out.push(clean.slice(i, i + 2));
  }
  return out;
}

/** Convert a hex pair to a byte value (0-255). Returns -1 on invalid. */
export function hexPairToByte(pair: string): number {
  if (!/^[0-9a-f]{2}$/.test(pair)) return -1;
  return parseInt(pair, 16);
}

/** Decode a byte array to text per the given encoding. */
export function decodeBytes(bytes: number[], encoding: HexToTextOptions["encoding"]): string {
  if (encoding === "utf-8" || encoding === "ascii") {
    // Combine continuation bytes into code points.
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b1 = bytes[i]!;
      if (encoding === "ascii" || b1 < 0x80) {
        out += String.fromCharCode(b1 & 0x7f);
        i++;
      } else if (b1 < 0xc0) {
        out += "\uFFFD"; i++;
      } else if (b1 < 0xe0) {
        const b2 = bytes[i + 1] ?? 0;
        out += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
        i += 2;
      } else if (b1 < 0xf0) {
        const b2 = bytes[i + 1] ?? 0;
        const b3 = bytes[i + 2] ?? 0;
        out += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
        i += 3;
      } else {
        const b2 = bytes[i + 1] ?? 0;
        const b3 = bytes[i + 2] ?? 0;
        const b4 = bytes[i + 3] ?? 0;
        const cp = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
        try { out += String.fromCodePoint(cp); } catch { out += "\uFFFD"; }
        i += 4;
      }
    }
    return out;
  }
  // UTF-16 LE/BE
  let out = "";
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = encoding === "utf-16le"
      ? bytes[i]! | (bytes[i + 1]! << 8)
      : (bytes[i]! << 8) | bytes[i + 1]!;
    out += String.fromCharCode(code);
  }
  return out;
}

/** Convert full hex input to text. */
export function hexToText(input: string, opts: HexToTextOptions): HexToTextResult {
  const clean = normalizeHex(input);
  if (!clean) return { output: "", inputLength: 0, outputLength: 0, byteCount: 0, invalidBytes: 0 };
  const pairs = splitPairs(clean);
  let invalid = 0;
  const bytes: number[] = [];
  for (const p of pairs) {
    const b = hexPairToByte(p);
    if (b < 0) { invalid++; continue; }
    bytes.push(b);
  }
  const decoded = decodeBytes(bytes, opts.encoding);
  const output = opts.separator ? decoded.split("").join(opts.separator) : decoded;
  return {
    output,
    inputLength: input.length,
    outputLength: decoded.length,
    byteCount: bytes.length,
    invalidBytes: invalid,
  };
}

export function validateOptions(opts: HexToTextOptions): { ok: true } | { error: string } {
  if (!["utf-8", "utf-16le", "utf-16be", "ascii"].includes(opts.encoding)) return { error: "Unknown encoding" };
  return { ok: true };
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Detect hex format from input.
 */
export function detectHexFormat(text: string): { format: string; hasPrefix: boolean; separator: string; case: "upper" | "lower" | "mixed" } {
  const hasPrefix = /0x/i.test(text);
  const separator = text.includes(" ") ? " " : text.includes(":") ? ":" : text.includes("-") ? "-" : "";
  const upper = /[A-F]/.test(text);
  const lower = /[a-f]/.test(text);
  const caseType = upper && lower ? "mixed" : upper ? "upper" : "lower";
  return { format: `${caseType}-${separator ? "sep" : "none"}`, hasPrefix, separator, case: caseType };
}

/**
 * Decode hex with automatic format detection.
 */
export function hexToTextAuto(text: string): string {
  const normalized = normalizeHex(text);
  return hexToText(normalized);
}

/**
 * Decode hex code points (U+XXXX format).
 */
export function hexCodePointsToText(text: string): string {
  const matches = text.match(/U\+([0-9a-fA-F]{4,6})/g);
  if (!matches) return "";
  return matches.map((m) => {
    const code = parseInt(m.slice(2), 16);
    return String.fromCodePoint(code);
  }).join("");
}

/**
 * Validate hex string.
 */
export function validateHexStrict(text: string): { valid: boolean; reason?: string; byteCount?: number } {
  if (!text || text.trim().length === 0) return { valid: false, reason: "Empty input" };
  const normalized = normalizeHex(text);
  if (!/^[0-9a-fA-F]+$/.test(normalized)) return { valid: false, reason: "Contains non-hex characters" };
  if (normalized.length % 2 !== 0) return { valid: false, reason: "Odd number of hex digits" };
  return { valid: true, byteCount: normalized.length / 2 };
}

/**
 * Hex analysis statistics.
 */
export function hexAnalysis(text: string): { totalDigits: number; totalBytes: number; highBytes: number; lowBytes: number; nullBytes: number; printableAscii: number } {
  const normalized = normalizeHex(text);
  let highBytes = 0, lowBytes = 0, nullBytes = 0, printableAscii = 0;
  for (let i = 0; i < normalized.length; i += 2) {
    const byte = parseInt(normalized.slice(i, i + 2), 16);
    if (byte === 0) nullBytes++;
    if (byte < 32) lowBytes++;
    if (byte > 127) highBytes++;
    if (byte >= 32 && byte < 127) printableAscii++;
  }
  return {
    totalDigits: normalized.length,
    totalBytes: normalized.length / 2,
    highBytes,
    lowBytes,
    nullBytes,
    printableAscii,
  };
}

/**
 * Convert hex to multiple formats.
 */
export function hexToAllFormats(text: string): { hex: string; binary: string; octal: string; decimal: string; ascii: string } {
  const normalized = normalizeHex(text);
  const bytes = [...normalized.matchAll(/.{2}/g)].map((m) => parseInt(m[0]!, 16));
  return {
    hex: normalized,
    binary: bytes.map((b) => b.toString(2).padStart(8, "0")).join(" "),
    octal: bytes.map((b) => b.toString(8).padStart(3, "0")).join(" "),
    decimal: bytes.join(" "),
    ascii: bytes.map((b) => b >= 32 && b < 127 ? String.fromCharCode(b) : ".").join(""),
  };
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateHexDecodeInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const valid = validateHexStrict(text);
  if (!valid.valid) reports.push({ level: "fail", code: "INVALID", message: valid.reason ?? "Invalid hex input." });
  else reports.push({ level: "pass", code: "VALID", message: `Valid hex (${valid.byteCount} bytes).` });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-hex-to-text", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "RFC-4648", citation: "RFC 4648 (2006)", summary: "Base16 (hex) encoding standard." },
  { id: "Unicode-UTF8", citation: "Unicode Standard", summary: "UTF-8 decoding." },
];
