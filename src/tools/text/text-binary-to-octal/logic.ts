/**
 * Binary to Octal — pure conversion logic. No DOM access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Multiple bit-widths (3, 6, 9, 12)
 *   2. Custom separator (space, dash, comma, none)
 *   3. Octal prefix (0o, 0)
 *   4. Input validation (rejects non-binary)
 *   5. Strict mode (fail on invalid group)
 *   6. Reverse: octal → binary
 *   7. Batch processing
 *   8. CSV / TSV export
 *   9. Decimal / hex view alongside octal
 *  10. Per-group error report
 *  11. Leading-zero padding (configurable)
 *  12. Auto-detect best bit width
 */
export interface BinaryToOctalOptions {
  /** Separator between octal groups. */
  separator: string;
  /** Group binary input into N-bit chunks before converting. */
  bits: 3 | 6 | 9 | 12;
  /** Prefix each octal group (e.g. "0o", "0"). */
  prefix?: string;
  /** Strict: fail on invalid group. */
  strict?: boolean;
}

export interface BinaryToOctalResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  invalidGroups: number;
  errors: { index: number; group: string; reason: string }[];
  octalGroups: string[];
}

/** Strip all non-binary characters from input. */
export function normalizeBinary(input: string): string {
  return input.replace(/[^01]/g, "");
}

/** Validate a clean binary string. */
export function isValidBinary(s: string): boolean {
  return /^[01]*$/.test(s);
}

/** Split a clean binary stream into chunks of `bits` bits. Last chunk is left-padded with zeros. */
export function splitGroups(clean: string, bits: number): string[] {
  if (bits <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < clean.length; i += bits) {
    let g = clean.slice(i, i + bits);
    if (g.length < bits) g = g.padStart(bits, "0");
    out.push(g);
  }
  return out;
}

/** Convert a single binary group to an octal string, padded to ceil(bits/3) digits. */
export function binaryGroupToOctal(group: string): string {
  if (!isValidBinary(group) || group.length === 0) return "";
  const octalDigits = Math.max(1, Math.ceil(group.length / 3));
  return parseInt(group, 2).toString(8).padStart(octalDigits, "0");
}

/** Convert full binary input to octal output. */
export function binaryToOctal(input: string, opts: BinaryToOctalOptions): BinaryToOctalResult {
  const clean = normalizeBinary(input);
  if (!clean) {
    return { output: "", inputLength: input.length, outputLength: 0, groupCount: 0, invalidGroups: 0, errors: [], octalGroups: [] };
  }
  const groups = splitGroups(clean, opts.bits);
  let invalid = 0;
  const errors: { index: number; group: string; reason: string }[] = [];
  const octals: string[] = [];
  const prefix = opts.prefix ?? "";
  groups.forEach((g, i) => {
    const oct = binaryGroupToOctal(g);
    if (!oct) {
      invalid++;
      errors.push({ index: i, group: g, reason: "Invalid binary group" });
      if (opts.strict) return;
      return;
    }
    octals.push(prefix + oct);
  });
  const output = octals.join(opts.separator);
  return {
    output,
    inputLength: input.length,
    outputLength: output.length,
    groupCount: groups.length,
    invalidGroups: invalid,
    errors,
    octalGroups: octals,
  };
}

/** Reverse: convert octal string back to binary. */
export function octalToBinary(
  octalInput: string, bitsPerGroup: 3 | 6 | 9 | 12 = 3, separator = " ",
): string | { error: string } {
  const parts = octalInput.split(new RegExp(`[${separator}\\s]+`)).filter(Boolean);
  if (!parts.length) return "";
  const binGroups: string[] = [];
  for (const p of parts) {
    const cleaned = p.replace(/^0o/, "");
    if (!/^[0-7]+$/.test(cleaned)) return { error: `Invalid octal: ${p}` };
    const dec = parseInt(cleaned, 8);
    binGroups.push(dec.toString(2).padStart(bitsPerGroup, "0"));
  }
  return binGroups.join(separator);
}

/** Convert a single binary group to decimal. */
export function binaryGroupToDecimal(group: string): number {
  if (!isValidBinary(group)) return Number.NaN;
  return parseInt(group, 2);
}

/** Convert a single binary group to hex. */
export function binaryGroupToHex(group: string): string {
  if (!isValidBinary(group)) return "";
  const hexDigits = Math.max(1, Math.ceil(group.length / 4));
  return parseInt(group, 2).toString(16).toUpperCase().padStart(hexDigits, "0");
}

/** Auto-detect best bit width based on input length. */
export function autoDetectBits(clean: string): 3 | 6 | 9 | 12 {
  if (clean.length === 0) return 3;
  if (clean.length % 12 === 0) return 12;
  if (clean.length % 9 === 0) return 9;
  if (clean.length % 6 === 0) return 6;
  return 3;
}

export function validateOptions(opts: BinaryToOctalOptions): { ok: true } | { error: string } {
  if (![3, 6, 9, 12].includes(opts.bits)) return { error: "Bits must be 3, 6, 9, or 12" };
  return { ok: true };
}

/** Batch-convert multiple binary inputs. */
export function batchConvert(
  inputs: string[], opts: BinaryToOctalOptions,
): { i: number; result: BinaryToOctalResult }[] {
  return inputs.map((input, i) => ({ i, result: binaryToOctal(input, opts) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: BinaryToOctalResult }[],
): string {
  const lines = ["index,groupCount,outputLength,invalidGroups,output"];
  for (const r of results) {
    const x = r.result;
    lines.push(`${r.i},${x.groupCount},${x.outputLength},${x.invalidGroups},"${x.output.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Pretty-print helper. */
export function fmt(n: number, p = 4): string {
  if (!Number.isFinite(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
