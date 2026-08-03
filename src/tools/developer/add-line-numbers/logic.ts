/**
 * Add Line Numbers — pure logic.
 * Adds sequential line numbers to text with configurable format.
 */

export interface LineNumberOptions {
  start: number;
  step: number;
  separator: string;
  padding: number;
  skipEmpty: boolean;
  position: "before" | "after";
  format: "plain" | "brackets" | "parentheses" | "dot" | "colon" | "pipe";
}

const DEFAULTS: LineNumberOptions = {
  start: 1, step: 1, separator: " ", padding: 0,
  skipEmpty: false, position: "before", format: "plain",
};

function formatNum(n: number, opts: LineNumberOptions): string {
  const raw = String(n);
  const padded = opts.padding > 0 ? raw.padStart(opts.padding, "0") : raw;
  switch (opts.format) {
    case "brackets": return `[${padded}]`;
    case "parentheses": return `(${padded})`;
    case "dot": return `${padded}.`;
    case "colon": return `${padded}:`;
    case "pipe": return `| ${padded} |`;
    default: return padded;
  }
}

export function addLineNumbers(input: string, opts: Partial<LineNumberOptions> = {}): { ok: true; output: string; lineCount: number } | { ok: false; error: string } {
  if (!input) return { ok: false, error: "Input is empty" };
  const o = { ...DEFAULTS, ...opts };
  const lines = input.split(/\r?\n/);
  let num = o.start;
  const result: string[] = [];

  for (const line of lines) {
    if (o.skipEmpty && line.trim() === "") {
      result.push(line);
    } else {
      const formatted = formatNum(num, o);
      if (o.position === "before") {
        result.push(`${formatted}${o.separator}${line}`);
      } else {
        result.push(`${line}${o.separator}${formatted}`);
      }
      num += o.step;
    }
  }

  return { ok: true, output: result.join("\n"), lineCount: result.length };
}

export function removeLineNumbers(input: string): { ok: true; output: string } | { ok: false; error: string } {
  if (!input) return { ok: false, error: "Input is empty" };
  const lines = input.split(/\r?\n/);
  const result = lines.map(line => line.replace(/^\s*(?:\[\d+\]|\(\d+\)|\d+[.:\])]|\|\s*\d+\s*\||\d+)\s?/, ""));
  return { ok: true, output: result.join("\n") };
}

export function getStats(input: string) {
  const lines = input.split(/\r?\n/);
  return {
    lineCount: lines.length,
    charCount: input.length,
    wordCount: input.split(/\s+/).filter(Boolean).length,
    emptyLines: lines.filter(l => l.trim() === "").length,
  };
}
