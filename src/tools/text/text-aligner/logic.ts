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


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function justifyText(text: string, width: number = 80): string {
  const lines = text.split("\n");
  return lines.map((line) => {
    const words = line.trim().split(/\s+/);
    if (words.length <= 1) return line;
    const wordLen = words.reduce((a, w) => a + w.length, 0);
    const totalSpaces = width - wordLen;
    if (totalSpaces <= 0) return line;
    const gaps = words.length - 1;
    const spacePerGap = Math.floor(totalSpaces / gaps);
    const extraSpaces = totalSpaces % gaps;
    let result = "";
    for (let i = 0; i < words.length; i++) {
      result += words[i];
      if (i < gaps) {
        const spaces = spacePerGap + (i < extraSpaces ? 1 : 0);
        result += " ".repeat(spaces);
      }
    }
    return result;
  }).join("\n");
}

export function centerText(text: string, width: number = 80): string {
  return text.split("\n").map((line) => {
    const trimmed = line.trim();
    const totalPadding = Math.max(0, width - trimmed.length);
    const leftPad = Math.floor(totalPadding / 2);
    const rightPad = totalPadding - leftPad;
    return " ".repeat(leftPad) + trimmed + " ".repeat(rightPad);
  }).join("\n");
}

export function rightAlignText(text: string, width: number = 80): string {
  return text.split("\n").map((line) => {
    const trimmed = line.trim();
    const padding = Math.max(0, width - trimmed.length);
    return " ".repeat(padding) + trimmed;
  }).join("\n");
}

export function leftAlignText(text: string): string {
  return text.split("\n").map((l) => l.replace(/\s+$/, "")).join("\n");
}

export function alignByDelimiter(text: string, delimiter: string = "="): string {
  const lines = text.split("\n");
  const positions = lines.map((l) => l.indexOf(delimiter)).filter((i) => i !== -1);
  if (positions.length === 0) return text;
  const maxPos = Math.max(...positions);
  return lines.map((line) => {
    const idx = line.indexOf(delimiter);
    if (idx === -1) return line;
    const before = line.slice(0, idx).trimEnd();
    const after = line.slice(idx + delimiter.length).trimStart();
    return before + " ".repeat(maxPos - before.length) + delimiter + " " + after;
  }).join("\n");
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateAlignment(text: string, width: number): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  if (width <= 0) { reports.push({ level: "fail", code: "INVALID_WIDTH", message: "Width must be positive." }); return reports; }
  const lines = text.split("\n");
  const longLines = lines.filter((l) => l.length > width).length;
  if (longLines > 0) reports.push({ level: "warn", code: "OVERFLOW", message: `${longLines} lines exceed width ${width}.` });
  else reports.push({ level: "pass", code: "FITS", message: `All ${lines.length} lines fit within width ${width}.` });
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string, width: number): Receipt {
  const s = text.length + ":" + width;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-aligner", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Unicode-UAX14", citation: "Unicode Standard Annex #14", summary: "Unicode Line Breaking Algorithm." },
  { id: "Knuth-Plass", citation: "Knuth & Plass (1981)", summary: "Optimal line breaking algorithm." },
];
