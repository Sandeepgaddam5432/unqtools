/** Text Aligner — pure logic. */

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
}

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
  const warnings: string[] = [];
  if (options.width < 1) return { error: "Width must be at least 1" };
  const fillChar = (options.fillChar ?? " ").charAt(0) ?? " ";
  if (fillChar === "") return { error: "Fill char is required" };
  const lines = input.split("\n");
  let truncatedLines = 0;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.length > options.width) truncatedLines++;
    if (options.alignment === "justify") {
      const isLast = i === lines.length - 1;
      if (isLast && !options.justifyLastLine) {
        out.push(padLine(line.trim(), options.width, "left", fillChar));
      } else {
        out.push(justifyLine(line, options.width, fillChar));
      }
    } else {
      out.push(padLine(line, options.width, options.alignment, fillChar));
    }
  }
  if (truncatedLines > 0) warnings.push(`${truncatedLines} line(s) were longer than ${options.width} and truncated.`);
  return { output: out.join("\n"), linesProcessed: lines.length, truncatedLines, warnings };
}

export function previewLine(line: string, options: AlignOptions): string {
  const r = process(line, options);
  return "error" in r ? line : r.output;
}
