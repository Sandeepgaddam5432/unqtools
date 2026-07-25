/** Text Aligner — pure logic. No DOM access.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Left / right / center / justify alignment
 *   2. Custom width (1-200 chars)
 *   3. Custom padding char
 *   4. Justify-last-line option
 *   5. Word-aware justification
 *   6. Truncation detection
 *   7. Per-line preview helper
 *   8. Batch processing
 *   9. CSV export
 *  10. Line length statistics
 *  11. Validation with detailed error messages
 *  12. Auto-fit width from longest line
 */
export type Alignment = "left" | "right" | "center" | "justify";

export interface AlignOptions {
  width: number;
  alignment: Alignment;
  fillChar?: string;
  justifyLastLine?: boolean;
}

export interface AlignResult {
  output: string;
  linesProcessed: number;
  truncatedLines: number;
  warnings: string[];
  lineLengths: number[];
}

const isFin = (n: number) => Number.isFinite(n);
const isPos = (n: number) => isFin(n) && n > 0;

function padLine(str: string, width: number, alignment: Alignment, fillChar: string): string {
  if (str.length >= width) return str.slice(0, width);
  const pad = width - str.length;
  if (alignment === "left") return str + fillChar.repeat(pad);
  if (alignment === "right") return fillChar.repeat(pad) + str;
  // center
  const left = Math.floor(pad / 2);
  return fillChar.repeat(left) + str + fillChar.repeat(pad - left);
}

function justifyLine(str: string, width: number, fillChar: string): string {
  const trimmed = str.trim();
  if (trimmed.length >= width) return trimmed.slice(0, width);
  const words = trimmed.split(/\s+/);
  if (words.length <= 1) return padLine(trimmed, width, "left", fillChar);
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  const totalGaps = words.length - 1;
  const totalSpace = width - totalChars;
  if (totalSpace <= 0) return words.join(fillChar);
  const base = Math.floor(totalSpace / totalGaps);
  const extra = totalSpace - base * totalGaps;
  let out = words[0]!;
  for (let i = 1; i < words.length; i++) {
    const spaces = base + (i <= extra ? 1 : 0);
    out += fillChar.repeat(spaces) + words[i];
  }
  return out;
}

export function process(input: string, options: AlignOptions): AlignResult | { error: string } {
  if (!isPos(options.width)) return { error: "Width must be at least 1" };
  if (options.width > 1000) return { error: "Width must be at most 1000" };
  const fillChar = (options.fillChar ?? " ").charAt(0) ?? " ";
  if (fillChar === "") return { error: "Fill char is required" };
  const warnings: string[] = [];
  const lines = input.split("\n");
  let truncatedLines = 0;
  const out: string[] = [];
  const lineLengths: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > options.width) truncatedLines++;
    if (options.alignment === "justify") {
      const isLast = i === lines.length - 1;
      if (isLast && !options.justifyLastLine) {
        const padded = padLine(line.trim(), options.width, "left", fillChar);
        out.push(padded);
        lineLengths.push(padded.length);
      } else {
        const justified = justifyLine(line, options.width, fillChar);
        out.push(justified);
        lineLengths.push(justified.length);
      }
    } else {
      const padded = padLine(line, options.width, options.alignment, fillChar);
      out.push(padded);
      lineLengths.push(padded.length);
    }
  }
  if (truncatedLines > 0) warnings.push(`${truncatedLines} line(s) were longer than ${options.width} and truncated.`);
  return { output: out.join("\n"), linesProcessed: lines.length, truncatedLines, warnings, lineLengths };
}

export function previewLine(line: string, options: AlignOptions): string {
  const r = process(line, options);
  return "error" in r ? line : r.output;
}

/** Compute statistics about line lengths. */
export function lineLengthStats(lengths: number[]): { min: number; max: number; avg: number; total: number } {
  if (lengths.length === 0) return { min: 0, max: 0, avg: 0, total: 0 };
  let min = Infinity; let max = 0; let total = 0;
  for (const len of lengths) {
    if (len < min) min = len;
    if (len > max) max = len;
    total += len;
  }
  return { min, max, avg: total / lengths.length, total };
}

/** Auto-fit the width based on the longest line in the input. */
export function autoFitWidth(input: string): number {
  const lines = input.split("\n");
  let max = 1;
  for (const line of lines) if (line.length > max) max = line.length;
  return max;
}

/** Validate alignment options. */
export function validateOptions(opts: AlignOptions): { ok: true } | { error: string } {
  if (!isPos(opts.width)) return { error: "Width must be positive" };
  if (opts.width > 1000) return { error: "Width must be ≤ 1000" };
  if (!["left", "right", "center", "justify"].includes(opts.alignment)) return { error: "Unknown alignment" };
  if (opts.fillChar !== undefined && opts.fillChar.length > 0 && opts.fillChar.length !== 1) {
    return { error: "Fill char must be a single character" };
  }
  return { ok: true };
}

/** Batch-process multiple inputs. */
export function batchProcess(
  inputs: string[], opts: AlignOptions,
): { i: number; result: AlignResult | { error: string } }[] {
  return inputs.map((input, i) => ({ i, result: process(input, opts) }));
}

/** Render batch results as CSV. */
export function batchToCsv(
  results: { i: number; result: AlignResult | { error: string } }[],
): string {
  const lines = ["index,linesProcessed,truncatedLines,output"];
  for (const r of results) {
    if ("error" in r.result) lines.push(`${r.i},,error,"${r.result.error}"`);
    else lines.push(`${r.i},${r.result.linesProcessed},${r.result.truncatedLines},"${r.result.output.replace(/"/g, '""')}"`);
  }
  return lines.join("\n");
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!isFin(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}
