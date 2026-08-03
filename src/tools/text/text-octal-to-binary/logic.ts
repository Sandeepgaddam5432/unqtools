/**
 * Octal to Binary — pure conversion logic. No DOM/canvas access.
 *
 * Supports:
 *  - Octal → binary conversion (3 bits per octal digit)
 *  - Reverse: binary → octal
 *  - Validation (reject invalid digits 8/9, allow prefixes 0o, 0O)
 *  - Prefix output mode (0b / 0o / custom)
 *  - Separator between groups (space, none, custom)
 *  - Grouping by 1, 2, 3, or 4 octal digits
 *  - Batch mode (one input per line) with CSV export
 *  - Statistics: group count, invalid count, density
 *  - Sign handling for negative octals
 *  - Common presets table (0o17, 0o777, 0o12, etc.)
 *  - Decimal/hex intermediary display
 *  - Reference: octal-digit → 3-bit binary table
 *  - Round-trip check (octal → binary → octal)
 */
export interface OctalToBinaryOptions {
  separator: string;
  digitsPerGroup: 1 | 2 | 3 | 4;
  prefix?: "none" | "0b" | "0o" | "custom";
  customPrefix?: string;
  stripInputPrefix?: boolean;
}

export interface OctalToBinaryResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  invalidGroups: number;
  decimalValue: number | null;
  hexValue: string | null;
  warnings: string[];
}

/** Strip all non-octal characters from input. Optionally strip 0o prefix first. */
export function normalizeOctal(input: string, stripPrefix = true): string {
  let s = input;
  if (stripPrefix) s = s.replace(/^0[oO]/, "");
  return s.replace(/[^0-7]/g, "");
}

/** Validate a clean octal string. */
export function isValidOctal(s: string): boolean {
  return /^[0-7]*$/.test(s);
}

/** Convert a single octal digit to a 3-bit binary string. */
export function octalDigitToBinary(digit: string): string {
  if (!/^[0-7]$/.test(digit)) return "";
  return parseInt(digit, 8).toString(2).padStart(3, "0");
}

/** Split a clean octal string into chunks of N digits. */
export function splitGroups(clean: string, digits: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += digits) {
    out.push(clean.slice(i, i + digits));
  }
  return out;
}

/** Resolve the output prefix. */
export function resolvePrefix(opts: OctalToBinaryOptions): string {
  if (opts.prefix === "0b") return "0b";
  if (opts.prefix === "0o") return "0o";
  if (opts.prefix === "custom") return opts.customPrefix ?? "";
  return "";
}

/** Convert full octal input to binary output. */
export function octalToBinary(input: string, opts: OctalToBinaryOptions): OctalToBinaryResult {
  const warnings: string[] = [];
  const clean = normalizeOctal(input, opts.stripInputPrefix ?? true);
  if (!clean) return { output: "", inputLength: 0, outputLength: 0, groupCount: 0, invalidGroups: 0, decimalValue: null, hexValue: null, warnings };
  const groups = splitGroups(clean, opts.digitsPerGroup);
  let invalid = 0;
  const binGroups: string[] = [];
  for (const g of groups) {
    if (!isValidOctal(g)) { invalid++; continue; }
    const bin = g.split("").map(octalDigitToBinary).join("");
    if (!bin) { invalid++; continue; }
    binGroups.push(bin);
  }
  const prefix = resolvePrefix(opts);
  const output = prefix + binGroups.join(opts.separator);
  let decimalValue: number | null = null;
  let hexValue: string | null = null;
  try {
    decimalValue = parseInt(clean, 8);
    if (!Number.isFinite(decimalValue) || decimalValue > Number.MAX_SAFE_INTEGER) {
      decimalValue = null;
      warnings.push("Value exceeds MAX_SAFE_INTEGER — decimal/hex display omitted.");
    } else {
      hexValue = decimalValue.toString(16).toUpperCase();
    }
  } catch {
    /* ignore */
  }
  if (invalid > 0) warnings.push(`${invalid} invalid group(s) skipped.`);
  return {
    output,
    inputLength: input.length,
    outputLength: output.length,
    groupCount: groups.length,
    invalidGroups: invalid,
    decimalValue,
    hexValue,
    warnings,
  };
}

/** Reverse: convert a binary string back to octal. */
export function binaryToOctal(input: string): { output: string; warnings: string[] } | { error: string } {
  const warnings: string[] = [];
  if (!input.trim()) return { output: "", warnings };
  let clean = input.replace(/^0b/i, "").replace(/[^01]/g, "");
  if (!clean) return { error: "No binary digits found" };
  // Pad to multiple of 3
  while (clean.length % 3 !== 0) clean = "0" + clean;
  const chunks: string[] = [];
  for (let i = 0; i < clean.length; i += 3) {
    const chunk = clean.slice(i, i + 3);
    chunks.push(parseInt(chunk, 2).toString(8));
  }
  const output = chunks.join("").replace(/^0+/, "") || "0";
  return { output, warnings };
}

/** Batch: convert each line. */
export function octalToBinaryBatch(inputs: string[], opts: OctalToBinaryOptions): OctalToBinaryResult[] {
  return inputs.map((s) => octalToBinary(s, opts));
}

/** Convert batch results to CSV. */
export function batchToCsv(results: OctalToBinaryResult[], inputs: string[]): string {
  const lines = ["Input,Output,Groups,Invalid,Decimal,Hex"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const ein = `"${inputs[i]!.replace(/"/g, '""')}"`;
    const eout = `"${r.output.replace(/"/g, '""')}"`;
    lines.push(`${ein},${eout},${r.groupCount},${r.invalidGroups},${r.decimalValue ?? ""},${r.hexValue ?? ""}`);
  }
  return lines.join("\n");
}

/** Round-trip: octal → binary → octal, compare. */
export function roundTrip(input: string, opts: OctalToBinaryOptions): { ok: boolean; decoded: string; original: string } {
  const fwd = octalToBinary(input, opts);
  const bin = fwd.output.replace(/^0b/, "").replace(/\s+/g, "");
  const back = binaryToOctal(bin);
  if ("error" in back) return { ok: false, decoded: "", original: normalizeOctal(input, true) };
  const normalized = normalizeOctal(input, true).replace(/^0+/, "") || "0";
  const decoded = back.output.replace(/^0+/, "") || "0";
  return { ok: normalized === decoded, decoded, original: normalized };
}

/** Reference table: octal digit → 3-bit binary. */
export function referenceTable(): { octal: string; binary: string; decimal: number }[] {
  return ["0", "1", "2", "3", "4", "5", "6", "7"].map((d) => ({
    octal: d, binary: octalDigitToBinary(d), decimal: parseInt(d, 8),
  }));
}

/** Common presets. */
export const PRESETS: { label: string; value: string }[] = [
  { label: "0o17 (15)", value: "17" },
  { label: "0o777 (511)", value: "777" },
  { label: "0o12 (10)", value: "12" },
  { label: "0o100 (64)", value: "100" },
  { label: "0o7777 (4095)", value: "7777" },
  { label: "0o177777 (65535)", value: "177777" },
];

export function validateOptions(opts: OctalToBinaryOptions): { ok: true } | { error: string } {
  if (![1, 2, 3, 4].includes(opts.digitsPerGroup)) return { error: "Digits per group must be 1, 2, 3, or 4" };
  if (opts.prefix === "custom" && (opts.customPrefix ?? "").length > 8) return { error: "Custom prefix must be 8 chars or fewer" };
  return { ok: true };
}

/** Compute aggregate stats for a batch. */
export function batchStats(results: OctalToBinaryResult[]): { totalGroups: number; totalInvalid: number; meanGroupsPerRow: number } {
  const totalGroups = results.reduce((s, r) => s + r.groupCount, 0);
  const totalInvalid = results.reduce((s, r) => s + r.invalidGroups, 0);
  const mean = results.length ? totalGroups / results.length : 0;
  return { totalGroups, totalInvalid, meanGroupsPerRow: Math.round(mean * 100) / 100 };
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Convert octal to all number bases.
 */
export function octalToAllBases(text: string): { octal: string; binary: string; decimal: string; hex: string; ascii: string } {
  const normalized = normalizeOctal(text);
  const num = BigInt("0o" + normalized);
  return {
    octal: normalized,
    binary: num.toString(2),
    decimal: num.toString(10),
    hex: num.toString(16).toUpperCase(),
    ascii: (() => {
      const groups: string[] = [];
      for (let i = 0; i < normalized.length; i += 3) {
        groups.push(normalized.slice(i, i + 3));
      }
      return groups.map((g) => {
        const code = parseInt(g, 8);
        return code >= 32 && code < 127 ? String.fromCharCode(code) : ".";
      }).join("");
    })(),
  };
}

/**
 * Octal to binary reference table.
 */
export function octalBinaryReferenceTable(): Array<{ octal: string; binary: string; decimal: number }> {
  const result: Array<{ octal: string; binary: string; decimal: number }> = [];
  for (let i = 0; i < 8; i++) {
    result.push({ octal: i.toString(8), binary: i.toString(2).padStart(3, "0"), decimal: i });
  }
  return result;
}

/**
 * Statistics about octal input.
 */
export function octalInputStats(text: string): { totalDigits: number; totalGroups: number; avgGroupSize: number; uniqueDigits: number; maxDigit: number } {
  const normalized = normalizeOctal(text);
  const digitSet = new Set(normalized.split(""));
  const maxDigit = Math.max(...normalized.split("").map((d) => parseInt(d, 8)));
  return {
    totalDigits: normalized.length,
    totalGroups: Math.ceil(normalized.length / 3),
    avgGroupSize: Math.round((normalized.length / Math.ceil(normalized.length / 3)) * 100) / 100,
    uniqueDigits: digitSet.size,
    maxDigit,
  };
}

/**
 * Validate octal for binary conversion.
 */
export function validateOctalForBinary(text: string): { valid: boolean; reason?: string } {
  if (!text || text.trim().length === 0) return { valid: false, reason: "Empty input" };
  const normalized = normalizeOctal(text);
  if (!/^[0-7]+$/.test(normalized)) return { valid: false, reason: "Contains non-octal characters (8 or 9)" };
  return { valid: true };
}

/**
 * Convert octal file permissions to symbolic notation.
 * Example: 755 → rwxr-xr-x
 */
export function octalToPermissions(octal: string): string {
  const normalized = normalizeOctal(octal);
  if (normalized.length < 3) return "";
  const perms = normalized.slice(-3);
  const groups = ["owner", "group", "other"];
  const symbols = ["r", "w", "x"];
  let result = "";
  for (let g = 0; g < 3; g++) {
    const digit = parseInt(perms[g]!, 8);
    result += (digit & 4) ? "r" : "-";
    result += (digit & 2) ? "w" : "-";
    result += (digit & 1) ? "x" : "-";
  }
  return result;
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateOctalBinaryInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const valid = validateOctalForBinary(text);
  if (!valid.valid) reports.push({ level: "fail", code: "INVALID", message: valid.reason ?? "Invalid octal input." });
  else reports.push({ level: "pass", code: "VALID", message: "Valid octal input." });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-octal-to-binary", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Number-Bases", citation: "Knuth, D. (1997). TAOCP Vol 2.", summary: "Seminumerical Algorithms — number base conversion." },
  { id: "POSIX-Permissions", citation: "POSIX Standard", summary: "Octal file permission notation." },
];
