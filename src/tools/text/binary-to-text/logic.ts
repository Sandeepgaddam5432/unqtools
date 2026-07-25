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
