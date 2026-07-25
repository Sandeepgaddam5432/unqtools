/**
 * Text To Binary — pure conversion logic. No DOM access.
 */

export interface TextToBinaryOptions {
  /** Bits per character (7 for ASCII, 8 for UTF-8, 16 for UTF-16). */
  bits: 7 | 8 | 16;
  /** Separator between binary groups. */
  separator: string;
  /** Uppercase 0/1 vs lowercase o/l — kept as 0/1 either way. */
  uppercase: boolean;
}

export interface TextToBinaryResult {
  output: string;
  inputLength: number;
  outputLength: number;
  groupCount: number;
}

/** Convert a single character code to a binary string of the given bit width. */
export function charToBinary(code: number, bits: number): string {
  if (bits <= 0) return "";
  const safeBits = Math.min(32, Math.max(1, bits));
  return code.toString(2).padStart(safeBits, "0").slice(-safeBits);
}

/** Convert a string to a sequence of binary groups. */
export function textToBinary(input: string, opts: TextToBinaryOptions): TextToBinaryResult {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, groupCount: 0 };
  const groups = Array.from(input).map((ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return charToBinary(code, opts.bits);
  });
  let output = groups.join(opts.separator);
  if (opts.uppercase) output = output.toUpperCase();
  return {
    output,
    inputLength: Array.from(input).length,
    outputLength: output.length,
    groupCount: groups.length,
  };
}

/** Batch mode: one input per line. */
export function textToBinaryBatch(inputs: string[], opts: TextToBinaryOptions): TextToBinaryResult[] {
  return inputs.map((s) => textToBinary(s, opts));
}

/** Convert batch results to CSV. */
export function batchToCsv(results: TextToBinaryResult[], inputs: string[]): string {
  const lines = ["Input,Binary,Groups"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const escapedIn = `"${inputs[i]!.replace(/"/g, '""')}"`;
    const escapedOut = `"${r.output.replace(/"/g, '""')}"`;
    lines.push(`${escapedIn},${escapedOut},${r.groupCount}`);
  }
  return lines.join("\n");
}

export function validateOptions(opts: TextToBinaryOptions): { ok: true } | { error: string } {
  if (![7, 8, 16].includes(opts.bits)) return { error: "Bits must be 7, 8, or 16" };
  return { ok: true };
}
