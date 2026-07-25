/**
 * Binary to Octal — pure conversion logic. No DOM access.
 */
export interface BinaryToOctalOptions {
  /** Separator between octal groups. */
  separator: string;
  /** Group binary input into N-bit chunks before converting. */
  bits: 3 | 6 | 9 | 12;
}

export interface BinaryToOctalResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  invalidGroups: number;
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
  if (!isValidBinary(group)) return "";
  const octalDigits = Math.max(1, Math.ceil(group.length / 3));
  return parseInt(group, 2).toString(8).padStart(octalDigits, "0");
}

/** Convert full binary input to octal output. */
export function binaryToOctal(input: string, opts: BinaryToOctalOptions): BinaryToOctalResult {
  const clean = normalizeBinary(input);
  if (!clean) return { output: "", inputLength: 0, outputLength: 0, groupCount: 0, invalidGroups: 0 };
  const groups = splitGroups(clean, opts.bits);
  let invalid = 0;
  const octals: string[] = [];
  for (const g of groups) {
    const oct = binaryGroupToOctal(g);
    if (!oct) { invalid++; continue; }
    octals.push(oct);
  }
  const output = octals.join(opts.separator);
  return {
    output,
    inputLength: input.length,
    outputLength: output.length,
    groupCount: groups.length,
    invalidGroups: invalid,
  };
}

export function validateOptions(opts: BinaryToOctalOptions): { ok: true } | { error: string } {
  if (![3, 6, 9, 12].includes(opts.bits)) return { error: "Bits must be 3, 6, 9, or 12" };
  return { ok: true };
}
