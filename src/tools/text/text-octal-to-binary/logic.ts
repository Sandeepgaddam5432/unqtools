/**
 * Octal to Binary — pure conversion logic. No DOM access.
 */
export interface OctalToBinaryOptions {
  /** Separator between binary groups. */
  separator: string;
  /** Bits per octal digit (3) or per octal group (variable). */
  digitsPerGroup: 1 | 2 | 3 | 4;
}

export interface OctalToBinaryResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
  invalidGroups: number;
}

/** Strip all non-octal characters from input. */
export function normalizeOctal(input: string): string {
  return input.replace(/[^0-7]/g, "");
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

/** Convert full octal input to binary output. */
export function octalToBinary(input: string, opts: OctalToBinaryOptions): OctalToBinaryResult {
  const clean = normalizeOctal(input);
  if (!clean) return { output: "", inputLength: 0, outputLength: 0, groupCount: 0, invalidGroups: 0 };
  const groups = splitGroups(clean, opts.digitsPerGroup);
  let invalid = 0;
  const binGroups: string[] = [];
  for (const g of groups) {
    if (!isValidOctal(g)) { invalid++; continue; }
    const bin = g.split("").map(octalDigitToBinary).join("");
    if (!bin) { invalid++; continue; }
    binGroups.push(bin);
  }
  const output = binGroups.join(opts.separator);
  return {
    output,
    inputLength: input.length,
    outputLength: output.length,
    groupCount: groups.length,
    invalidGroups: invalid,
  };
}

export function validateOptions(opts: OctalToBinaryOptions): { ok: true } | { error: string } {
  if (![1, 2, 3, 4].includes(opts.digitsPerGroup)) return { error: "Digits per group must be 1, 2, 3, or 4" };
  return { ok: true };
}
