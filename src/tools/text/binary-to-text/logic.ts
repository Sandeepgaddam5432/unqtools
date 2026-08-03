/**
 * Binary To Text — pure conversion logic. No DOM access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. 7-bit ASCII groups
 *   2. 8-bit byte groups (default)
 *   3. 16-bit UCS-2 groups
 *   4. Auto-detect best bit width
 *   5. UTF-8 decoding from byte stream
 *   6. Strict validation mode
 *   7. Group normalization (strip whitespace, separators)
 *   8. Reverse text-to-binary encoder
 *   9. Batch processing
 *  10. CSV / TSV export
 *  11. Detailed per-group error reporting
 *  12. Hex / decimal code point display
 */
export interface BinaryToTextOptions {
  /** Bits per group (7, 8, or 16). */
  bits: 7 | 8 | 16;
  /** Use UTF-8 decoding (8-bit only). */
  utf8?: boolean;
  /** Strict: fail on any invalid group instead of skipping. */
  strict?: boolean;
}

export interface BinaryToTextResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  invalidGroups: number;
  errors: { index: number; group: string; reason: string }[];
  codePoints: number[];
}

/** Normalize a binary string: strip whitespace, dots, separators, keep only 0s and 1s. */
export function normalizeBinary(input: string): string {
  return input.replace(/[^01]/g, "");
}

/** Split a clean binary stream into groups of N bits (last group padded if needed). */
export function splitGroups(clean: string, bits: number): string[] {
  if (bits <= 0) return [];
  const groups: string[] = [];
  for (let i = 0; i < clean.length; i += bits) {
    let g = clean.slice(i, i + bits);
    if (g.length < bits) g = g.padEnd(bits, "0");
    groups.push(g);
  }
  return groups;
}

/** Convert a binary group string to a character code. Returns NaN on invalid. */
export function binaryToCode(group: string): number {
  if (!/^[01]+$/.test(group)) return Number.NaN;
  return parseInt(group, 2);
}

/** Convert a binary string to text. */
export function binaryToText(input: string, opts: BinaryToTextOptions): BinaryToTextResult {
  const clean = normalizeBinary(input);
  if (!clean) {
    return { output: "", inputLength: input.length, outputLength: 0, groupCount: 0, invalidGroups: 0, errors: [], codePoints: [] };
  }
  const groups = splitGroups(clean, opts.bits);
  let output = "";
  let invalid = 0;
  const errors: { index: number; group: string; reason: string }[] = [];
  const codePoints: number[] = [];
  const bytes: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!;
    const code = binaryToCode(g);
    if (Number.isNaN(code)) {
      invalid++;
      errors.push({ index: i, group: g, reason: "Non-binary characters" });
      if (opts.strict) break;
      continue;
    }
    if (opts.bits === 16) {
      if (code > 0x10ffff) {
        invalid++;
        errors.push({ index: i, group: g, reason: "Out of Unicode range" });
        if (opts.strict) break;
        continue;
      }
      try {
        output += String.fromCodePoint(code);
        codePoints.push(code);
      } catch {
        invalid++;
        errors.push({ index: i, group: g, reason: "Invalid code point" });
      }
    } else if (opts.bits === 8) {
      bytes.push(code);
    } else {
      // 7-bit ASCII
      if (code > 0x7f) {
        invalid++;
        errors.push({ index: i, group: g, reason: "Out of 7-bit ASCII range" });
        if (opts.strict) break;
        continue;
      }
      output += String.fromCharCode(code);
      codePoints.push(code);
    }
  }
  if (opts.bits === 8) {
    if (opts.utf8) {
      try {
        output = new TextDecoder("utf-8", { fatal: !!opts.strict }).decode(new Uint8Array(bytes));
      } catch (e) {
        if (opts.strict) {
          return {
            output: "", inputLength: input.length, outputLength: 0,
            groupCount: groups.length, invalidGroups: invalid + 1,
            errors: [{ index: 0, group: "", reason: (e as Error).message }],
            codePoints: [],
          };
        }
        // Fallback: latin-1
        output = bytes.map((b) => String.fromCharCode(b)).join("");
      }
    } else {
      output = bytes.map((b) => String.fromCharCode(b)).join("");
    }
    for (const b of bytes) codePoints.push(b);
  }
  return {
    output,
    inputLength: input.length,
    outputLength: Array.from(output).length,
    groupCount: groups.length,
    invalidGroups: invalid,
    errors,
    codePoints,
  };
}

/** Auto-detect best bit width based on the clean stream length. */
export function autoDetectBits(clean: string): 7 | 8 | 16 {
  if (clean.length === 0) return 8;
  if (clean.length % 16 === 0) return 16;
  if (clean.length % 8 === 0) return 8;
  if (clean.length % 7 === 0) return 7;
  return 8;
}

/** Encode text back to a binary string. */
export function textToBinary(text: string, bits: 7 | 8 | 16 = 8, separator = ""): string {
  const groups: string[] = [];
  if (bits === 16) {
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0;
      groups.push(cp.toString(2).padStart(16, "0"));
    }
  } else if (bits === 8) {
    for (let i = 0; i < text.length; i++) {
      const cp = text.charCodeAt(i);
      if (cp <= 0xff) groups.push(cp.toString(2).padStart(8, "0"));
      else {
        // Encode full Unicode via UTF-8 bytes
        const bytes = new TextEncoder().encode(ch.codePointAt(0) ? ch : text[i]!);
        for (const b of bytes) groups.push(b.toString(2).padStart(8, "0"));
      }
    }
  } else {
    for (let i = 0; i < text.length; i++) {
      const cp = text.charCodeAt(i);
      groups.push((cp & 0x7f).toString(2).padStart(7, "0"));
    }
  }
  return groups.join(separator);
}

export function validateOptions(opts: BinaryToTextOptions): { ok: true } | { error: string } {
  if (![7, 8, 16].includes(opts.bits)) return { error: "Bits must be 7, 8, or 16" };
  if (opts.utf8 && opts.bits !== 8) return { error: "UTF-8 decoding requires 8-bit groups" };
  return { ok: true };
}

/** Batch-convert multiple binary inputs. */
export function batchConvert(
  inputs: string[], opts: BinaryToTextOptions,
): { i: number; result: BinaryToTextResult }[] {
  return inputs.map((input, i) => ({ i, result: binaryToText(input, opts) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: BinaryToTextResult }[],
): string {
  const lines = ["index,groupCount,outputLength,invalidGroups,output"];
  for (const r of results) {
    const x = r.result;
    lines.push(`${r.i},${x.groupCount},${x.outputLength},${x.invalidGroups},"${x.output.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Format code points as a hex string for inspection. */
export function codePointsToHex(codePoints: number[]): string {
  return codePoints.map((cp) => "U+" + cp.toString(16).toUpperCase().padStart(4, "0")).join(" ");
}

/** Format code points as decimal. */
export function codePointsToDec(codePoints: number[]): string {
  return codePoints.join(" ");
}

/** Validate a clean binary string (only 0s and 1s). */
export function isValidBinary(input: string): boolean {
  return /^[01]*$/.test(input);
}

/** Pretty-print helper. */
export function fmt(n: number, p = 4): string {
  if (!Number.isFinite(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Decode binary with automatic bit-width detection.
 */
export function decodeBinaryAuto(text: string): string {
  const normalized = normalizeBinary(text);
  // Try 8-bit first
  if (normalized.length % 8 === 0) {
    try { return binaryToText(normalized); } catch { /* try next */ }
  }
  // Try 16-bit
  if (normalized.length % 16 === 0) {
    const groups: string[] = [];
    for (let i = 0; i < normalized.length; i += 16) {
      groups.push(normalized.slice(i, i + 16));
    }
    return groups.map((g) => String.fromCharCode(parseInt(g, 2))).join("");
  }
  // Try 7-bit (ASCII subset)
  if (normalized.length % 7 === 0) {
    const groups: string[] = [];
    for (let i = 0; i < normalized.length; i += 7) {
      groups.push(normalized.slice(i, i + 7));
    }
    return groups.map((g) => String.fromCharCode(parseInt(g, 2))).join("");
  }
  return binaryToText(normalized);
}

/**
 * Detect the bit width of binary input.
 */
export function detectBitWidth(text: string): number {
  const normalized = normalizeBinary(text);
  const len = normalized.length;
  if (len % 8 === 0) return 8;
  if (len % 7 === 0) return 7;
  if (len % 16 === 0) return 16;
  if (len % 32 === 0) return 32;
  return 8; // default
}

/**
 * Validate binary string.
 */
export function validateBinary(text: string): { valid: boolean; reason?: string; bitWidth?: number } {
  if (!text || text.trim().length === 0) return { valid: false, reason: "Empty input" };
  const normalized = normalizeBinary(text);
  if (!/^[01]+$/.test(normalized)) return { valid: false, reason: "Contains non-binary characters" };
  const bitWidth = detectBitWidth(text);
  return { valid: true, bitWidth };
}

/**
 * Statistics about binary input.
 */
export function analyzeBinary(text: string): { totalBits: number; totalBytes: number; zeros: number; ones: number; zeroPercent: number; onePercent: number; bitWidth: number } {
  const normalized = normalizeBinary(text);
  const zeros = (normalized.match(/0/g) ?? []).length;
  const ones = (normalized.match(/1/g) ?? []).length;
  const total = normalized.length;
  const bitWidth = detectBitWidth(text);
  return {
    totalBits: total,
    totalBytes: Math.ceil(total / 8),
    zeros,
    ones,
    zeroPercent: total > 0 ? Math.round((zeros / total) * 10000) / 100 : 0,
    onePercent: total > 0 ? Math.round((ones / total) * 10000) / 100 : 0,
    bitWidth,
  };
}

/**
 * Convert binary to multiple number bases.
 */
export function binaryToAllBases(text: string): { binary: string; octal: string; decimal: string; hex: string } {
  const normalized = normalizeBinary(text);
  const num = BigInt("0b" + normalized);
  return {
    binary: normalized,
    octal: num.toString(8),
    decimal: num.toString(10),
    hex: num.toString(16).toUpperCase(),
  };
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateBinaryDecodeInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const valid = validateBinary(text);
  if (!valid.valid) reports.push({ level: "fail", code: "INVALID", message: valid.reason ?? "Invalid binary input." });
  else reports.push({ level: "pass", code: "VALID", message: `Valid binary (${valid.bitWidth}-bit groups).` });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "binary-to-text", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "ASCII-Standard", citation: "ANSI X3.4 (1986)", summary: "American Standard Code for Information Interchange." },
  { id: "Boolean-Algebra", citation: "Boole, G. (1854)", summary: "An Investigation of the Laws of Thought — binary logic." },
];
