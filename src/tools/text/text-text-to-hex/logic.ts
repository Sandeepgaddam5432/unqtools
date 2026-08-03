/**
 * Text to Hex — pure conversion logic. No DOM access.
 */
export interface TextToHexOptions {
  /** Encoding to use when emitting bytes. */
  encoding: "utf-8" | "utf-16le" | "utf-16be" | "ascii";
  /** Separator between hex bytes. */
  separator: string;
  /** Use uppercase hex letters. */
  uppercase: boolean;
}

export interface TextToHexResult {
  output: string;
  inputLength: number;
  outputLength: number;
  byteCount: number;
}

/** Encode a single UTF-16 code unit to UTF-8 byte sequence. */
export function utf8Encode(codePoint: number): number[] {
  if (codePoint < 0x80) return [codePoint];
  if (codePoint < 0x800) return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)];
  if (codePoint < 0x10000) return [0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f)];
  return [
    0xf0 | (codePoint >> 18),
    0x80 | ((codePoint >> 12) & 0x3f),
    0x80 | ((codePoint >> 6) & 0x3f),
    0x80 | (codePoint & 0x3f),
  ];
}

/** Convert a string to a byte array per the given encoding. */
export function encodeToBytes(text: string, encoding: TextToHexOptions["encoding"]): number[] {
  const bytes: number[] = [];
  if (encoding === "utf-8") {
    for (const ch of Array.from(text)) {
      const cp = ch.codePointAt(0) ?? 0;
      for (const b of utf8Encode(cp)) bytes.push(b);
    }
  } else if (encoding === "ascii") {
    for (const ch of Array.from(text)) {
      const cp = ch.codePointAt(0) ?? 0;
      bytes.push(cp & 0x7f);
    }
  } else {
    // UTF-16 LE/BE — use code units (charCodeAt), not code points.
    for (let i = 0; i < text.length; i++) {
      const cu = text.charCodeAt(i);
      if (encoding === "utf-16le") {
        bytes.push(cu & 0xff, (cu >> 8) & 0xff);
      } else {
        bytes.push((cu >> 8) & 0xff, cu & 0xff);
      }
    }
  }
  return bytes;
}

/** Convert a byte to a 2-char hex string. */
export function byteToHex(b: number, uppercase: boolean): string {
  const h = (b & 0xff).toString(16).padStart(2, "0");
  return uppercase ? h.toUpperCase() : h;
}

/** Convert full text input to hex output. */
export function textToHex(input: string, opts: TextToHexOptions): TextToHexResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, byteCount: 0 };
  const bytes = encodeToBytes(input, opts.encoding);
  const hexes = bytes.map((b) => byteToHex(b, opts.uppercase));
  const output = hexes.join(opts.separator);
  return {
    output,
    inputLength: Array.from(input).length,
    outputLength: output.length,
    byteCount: bytes.length,
  };
}

export function validateOptions(opts: TextToHexOptions): { ok: true } | { error: string } {
  if (!["utf-8", "utf-16le", "utf-16be", "ascii"].includes(opts.encoding)) return { error: "Unknown encoding" };
  return { ok: true };
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Hex output formats.
 */
export const HEX_FORMATS: ReadonlyArray<{ id: string; label: string; prefix: string; separator: string; case: "upper" | "lower" }> = [
  { id: "lower-space", label: "Lowercase, space-separated", prefix: "", separator: " ", case: "lower" },
  { id: "upper-space", label: "Uppercase, space-separated", prefix: "", separator: " ", case: "upper" },
  { id: "lower-none", label: "Lowercase, no separator", prefix: "", separator: "", case: "lower" },
  { id: "upper-none", label: "Uppercase, no separator", prefix: "", separator: "", case: "upper" },
  { id: "0x-space", label: "0x prefix, space-separated", prefix: "0x", separator: " ", case: "lower" },
  { id: "lower-colon", label: "Lowercase, colon-separated", prefix: "", separator: ":", case: "lower" },
  { id: "upper-dash", label: "Uppercase, dash-separated", prefix: "", separator: "-", case: "upper" },
];

/**
 * Encode text to hex with format options.
 */
export function textToHexFormatted(text: string, formatId: string = "lower-space"): string {
  const format = HEX_FORMATS.find((f) => f.id === formatId);
  if (!format) throw new Error(`Unknown format: ${formatId}`);
  const bytes = new TextEncoder().encode(text);
  const hexStrings = [...bytes].map((b) => {
    const hex = b.toString(16);
    return format.case === "upper" ? hex.toUpperCase() : hex;
  });
  return hexStrings.map((h) => format.prefix + h).join(format.separator);
}

/**
 * Encode to hex with code points (for Unicode).
 */
export function textToHexCodePoints(text: string): string {
  return [...text].map((c) => "U+" + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")).join(" ");
}

/**
 * Generate hex dump (like xxd output).
 */
export function hexDump(text: string, bytesPerLine: number = 16): string {
  const bytes = new TextEncoder().encode(text);
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const offset = i.toString(16).padStart(8, "0");
    const chunk = bytes.slice(i, i + bytesPerLine);
    const hexPart = [...chunk].map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(bytesPerLine * 3 - 1, " ");
    const asciiPart = [...chunk].map((b) => b >= 32 && b < 127 ? String.fromCharCode(b) : ".").join("");
    lines.push(`${offset}  ${hexPart}  |${asciiPart}|`);
  }
  return lines.join("\n");
}

/**
 * Statistics about hex output.
 */
export function hexStats(text: string): { chars: number; bytes: number; hexDigits: number; hexOutputLength: number } {
  const bytes = new TextEncoder().encode(text);
  return {
    chars: [...text].length,
    bytes: bytes.length,
    hexDigits: bytes.length * 2,
    hexOutputLength: bytes.length * 3 - 1, // with spaces
  };
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateHexEncodeInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const hasNonAscii = [...text].some((c) => (c.codePointAt(0) ?? 0) > 127);
  if (hasNonAscii) reports.push({ level: "warn", code: "NON_ASCII", message: "Text contains non-ASCII characters — multi-byte UTF-8 will be used." });
  else reports.push({ level: "pass", code: "ASCII", message: "All characters are ASCII (single-byte)." });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-text-to-hex", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "RFC-4648", citation: "RFC 4648 (2006)", summary: "Base16 (hex) encoding standard." },
  { id: "Unicode-UTF8", citation: "Unicode Standard", summary: "UTF-8 encoding form." },
];
