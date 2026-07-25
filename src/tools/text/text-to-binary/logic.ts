/**
 * Text To Binary — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - 7-bit ASCII, 8-bit (UTF-8 bytes or Latin-1), 16-bit (UTF-16 code units)
 *  - Space / none / custom separator between groups
 *  - Optional prefix per group (e.g. "0b")
 *  - UTF-8 byte-level encoding for multi-byte characters
 *  - Batch mode (one input per line) with CSV export
 *  - Reverse mode (binary → text)
 *  - History export to CSV
 *  - Stats (mean bits/group, density, char count)
 */

export type BitMode = 7 | 8 | 16;
export type Encoding = "codepoint" | "utf8";
export type PrefixMode = "none" | "0b" | "custom";

export interface TextToBinaryOptions {
  /** Bits per group (7 = ASCII, 8 = UTF-8 byte, 16 = UTF-16 code unit). */
  bits: BitMode;
  /** Separator between binary groups. */
  separator: string;
  /** Uppercase 0/1 vs lowercase o/l — kept as 0/1 either way. */
  uppercase: boolean;
  /** Prefix prepended to each binary group. */
  prefixMode?: PrefixMode;
  /** Custom prefix string when prefixMode === "custom". */
  customPrefix?: string;
  /** How multi-byte characters are encoded. Default "codepoint". */
  encoding?: Encoding;
}

export interface TextToBinaryResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  bitsPerGroup: number;
  totalBits: number;
  density: number;
  warnings: string[];
}

/** Convert a single non-negative integer to a fixed-width binary string. */
export function charToBinary(code: number, bits: number): string {
  if (bits <= 0) return "";
  const safeBits = Math.min(32, Math.max(1, bits));
  if (!Number.isFinite(code) || code < 0) return "0".repeat(safeBits);
  return code.toString(2).padStart(safeBits, "0").slice(-safeBits);
}

/** Resolve the active prefix string for a group. */
export function resolvePrefix(opts: TextToBinaryOptions): string {
  if (opts.prefixMode === "0b") return "0b";
  if (opts.prefixMode === "custom") return opts.customPrefix ?? "";
  return "";
}

/** Encode a single character into one or more 8-bit groups (UTF-8 bytes). */
function charToUtf8Bytes(ch: string): number[] {
  const cp = ch.codePointAt(0) ?? 0;
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
  if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
  return [
    0xf0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3f),
    0x80 | ((cp >> 6) & 0x3f),
    0x80 | (cp & 0x3f),
  ];
}

/** Build the list of integer code-units/bytes for an input string. */
export function encodeToCodes(input: string, opts: TextToBinaryOptions): number[] {
  const encoding = opts.encoding ?? "codepoint";
  const chars = Array.from(input);
  const codes: number[] = [];
  for (const ch of chars) {
    if (opts.bits === 8 && encoding === "utf8") {
      for (const b of charToUtf8Bytes(ch)) codes.push(b);
    } else {
      const cp = ch.codePointAt(0) ?? 0;
      // For 7-bit ASCII, mask down to 7 bits.
      codes.push(opts.bits === 7 ? cp & 0x7f : cp);
    }
  }
  return codes;
}

/** Convert a string to a sequence of binary groups. */
export function textToBinary(input: string, opts: TextToBinaryOptions): TextToBinaryResult {
  const warnings: string[] = [];
  if (!input) {
    return { output: "", inputLength: 0, outputLength: 0, groupCount: 0, bitsPerGroup: opts.bits, totalBits: 0, density: 0, warnings };
  }
  const codes = encodeToCodes(input, opts);
  const prefix = resolvePrefix(opts);
  const groups = codes.map((c) => prefix + charToBinary(c, opts.bits));
  let output = groups.join(opts.separator);
  if (opts.uppercase) output = output.toUpperCase();

  if (opts.bits === 7) {
    const hasHigh = Array.from(input).some((c) => (c.codePointAt(0) ?? 0) > 0x7f);
    if (hasHigh) warnings.push("Non-ASCII characters were masked to 7 bits — use 8-bit/UTF-8 mode to preserve them.");
  }

  const totalBits = codes.length * opts.bits;
  const density = output.length > 0 ? totalBits / output.length : 0;

  return {
    output,
    inputLength: Array.from(input).length,
    outputLength: output.length,
    groupCount: groups.length,
    bitsPerGroup: opts.bits,
    totalBits,
    density: Math.round(density * 100) / 100,
    warnings,
  };
}

/** Batch mode: one input per line. */
export function textToBinaryBatch(inputs: string[], opts: TextToBinaryOptions): TextToBinaryResult[] {
  return inputs.map((s) => textToBinary(s, opts));
}

/** Convert batch results to CSV. */
export function batchToCsv(results: TextToBinaryResult[], inputs: string[]): string {
  const lines = ["Input,Binary,Groups,Bits"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const escapedIn = `"${inputs[i]!.replace(/"/g, '""')}"`;
    const escapedOut = `"${r.output.replace(/"/g, '""')}"`;
    lines.push(`${escapedIn},${escapedOut},${r.groupCount},${r.totalBits}`);
  }
  return lines.join("\n");
}

/** Reverse: parse a binary string back into text. */
export function binaryToText(input: string, opts: TextToBinaryOptions): { output: string; groups: number; warnings: string[] } | { error: string } {
  const warnings: string[] = [];
  if (!input.trim()) return { output: "", groups: 0, warnings };
  const prefix = resolvePrefix(opts);
  let cleaned = input.trim();
  if (prefix) {
    // Strip prefix tokens anywhere in the input.
    cleaned = cleaned.split(prefix).join("");
  }
  // Tokenize: split on the separator if it is non-empty, otherwise chunk by bit width.
  let tokens: string[];
  if (opts.separator) {
    tokens = cleaned.split(opts.separator).map((t) => t.trim()).filter(Boolean);
  } else {
    const width = opts.bits;
    tokens = [];
    for (let i = 0; i < cleaned.length; i += width) {
      const t = cleaned.slice(i, i + width);
      if (t) tokens.push(t);
    }
  }
  const out: string[] = [];
  for (const t of tokens) {
    if (!/^[01]+$/.test(t)) return { error: `Invalid binary token: "${t}"` };
    const code = parseInt(t, 2);
    if (opts.bits === 7 && code > 0x7f) warnings.push(`Token "${t}" exceeds 7-bit range; masked.`);
    const safeCode = opts.bits === 7 ? code & 0x7f : code;
    out.push(String.fromCodePoint(safeCode));
  }
  return { output: out.join(""), groups: tokens.length, warnings };
}

/** Validate user-supplied options. */
export function validateOptions(opts: TextToBinaryOptions): { ok: true } | { error: string } {
  if (![7, 8, 16].includes(opts.bits)) return { error: "Bits must be 7, 8, or 16" };
  if (opts.prefixMode === "custom" && (opts.customPrefix ?? "").length > 8) {
    return { error: "Custom prefix must be 8 chars or fewer" };
  }
  if (opts.bits === 7 && opts.encoding === "utf8") {
    return { error: "UTF-8 byte encoding requires 8-bit mode" };
  }
  return { ok: true };
}

export interface HistoryEntry {
  ts: number;
  input: string;
  bits: BitMode;
  groupCount: number;
  outputLength: number;
}

/** Convert a history list to CSV. */
export function historyToCsv(history: HistoryEntry[]): string {
  const lines = ["Timestamp,Bits,Input,GroupCount,OutputLength"];
  for (const h of history) {
    const escaped = `"${h.input.replace(/"/g, '""')}"`;
    lines.push(`${new Date(h.ts).toISOString()},${h.bits},${escaped},${h.groupCount},${h.outputLength}`);
  }
  return lines.join("\n");
}

/** Compute aggregate statistics for a batch. */
export function batchStats(results: TextToBinaryResult[]): {
  totalGroups: number;
  totalBits: number;
  totalOutputChars: number;
  meanGroupsPerRow: number;
  meanDensity: number;
} {
  const totalGroups = results.reduce((s, r) => s + r.groupCount, 0);
  const totalBits = results.reduce((s, r) => s + r.totalBits, 0);
  const totalOutputChars = results.reduce((s, r) => s + r.outputLength, 0);
  const meanGroups = results.length ? totalGroups / results.length : 0;
  const meanDensity = totalOutputChars ? totalBits / totalOutputChars : 0;
  return {
    totalGroups,
    totalBits,
    totalOutputChars,
    meanGroupsPerRow: Math.round(meanGroups * 100) / 100,
    meanDensity: Math.round(meanDensity * 100) / 100,
  };
}

/** Common reference: ASCII letters → binary, for in-app lookup. */
export function asciiReferenceTable(): { char: string; code: number; bits7: string; bits8: string }[] {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(chars).map((c) => {
    const code = c.codePointAt(0)!;
    return { char: c, code, bits7: charToBinary(code, 7), bits8: charToBinary(code, 8) };
  });
}
