/**
 * Binary To Text — pure conversion logic. No DOM access.
 */

export interface BinaryToTextOptions {
  /** Bits per group (7, 8, or 16). */
  bits: 7 | 8 | 16;
}

export interface BinaryToTextResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  invalidGroups: number;
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
  if (!clean) return { output: "", inputLength: 0, outputLength: 0, groupCount: 0, invalidGroups: 0 };
  const groups = splitGroups(clean, opts.bits);
  let output = "";
  let invalid = 0;
  for (const g of groups) {
    const code = binaryToCode(g);
    if (Number.isNaN(code) || code < 0 || code > 0x10ffff) {
      invalid++;
      continue;
    }
    try {
      output += String.fromCodePoint(code);
    } catch {
      invalid++;
    }
  }
  return {
    output,
    inputLength: input.length,
    outputLength: Array.from(output).length,
    groupCount: groups.length,
    invalidGroups: invalid,
  };
}

export function validateOptions(opts: BinaryToTextOptions): { ok: true } | { error: string } {
  if (![7, 8, 16].includes(opts.bits)) return { error: "Bits must be 7, 8, or 16" };
  return { ok: true };
}
