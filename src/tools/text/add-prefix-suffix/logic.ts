/**
 * Add Prefix/Suffix to Lines — pure logic.
 * Adds prefix and/or suffix to every line, with optional counter token {n},
 * skip-empty, regex-conditional, trim, escape, and reverse (strip) mode.
 */

export interface PrefixSuffixOptions {
  prefix: string;
  suffix: string;
  skipEmpty: boolean;
  trimLines: boolean;
  /** Counter token {n} interpolation */
  counterStart: number;
  counterStep: number;
  counterPadding: number;
  /** Only wrap lines matching this regex (empty = all lines) */
  matchRegex: string;
  /** Escape mode for the line content */
  escape: "none" | "json" | "html" | "sql";
  /** Reverse mode: strip prefix/suffix instead of adding */
  reverse: boolean;
}

export const DEFAULT_OPTIONS: PrefixSuffixOptions = {
  prefix: "",
  suffix: "",
  skipEmpty: true,
  trimLines: false,
  counterStart: 1,
  counterStep: 1,
  counterPadding: 0,
  matchRegex: "",
  escape: "none",
  reverse: false,
};

export const PRESETS: { name: string; prefix: string; suffix: string }[] = [
  { name: "Double quotes", prefix: '"', suffix: '"' },
  { name: "Single quotes", prefix: "'", suffix: "'" },
  { name: "HTML <li>", prefix: "<li>", suffix: "</li>" },
  { name: "Markdown bullet", prefix: "- ", suffix: "" },
  { name: "SQL values", prefix: "'", suffix: "'," },
  { name: "Array items", prefix: '"', suffix: '",' },
  { name: "Parentheses", prefix: "(", suffix: ")" },
  { name: "Brackets", prefix: "[", suffix: "]" },
];

function escapeContent(text: string, mode: PrefixSuffixOptions["escape"]): string {
  switch (mode) {
    case "json":
      return JSON.stringify(text).slice(1, -1);
    case "html":
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    case "sql":
      return text.replace(/'/g, "''");
    default:
      return text;
  }
}

function pad(n: number, width: number): string {
  const s = String(n);
  return s.length >= width ? s : "0".repeat(width - s.length) + s;
}

function interpolate(token: string, counter: number, opts: PrefixSuffixOptions): string {
  return token.replace(/\{n\}/g, pad(counter, opts.counterPadding));
}

/**
 * Strip a prefix and/or suffix from a line (reverse mode).
 * Only strips if the line actually starts with prefix and ends with suffix.
 */
function stripAffixes(line: string, prefix: string, suffix: string): string {
  let result = line;
  if (prefix && result.startsWith(prefix)) {
    result = result.slice(prefix.length);
  }
  if (suffix && result.endsWith(suffix)) {
    result = result.slice(0, -suffix.length);
  }
  return result;
}

export function addPrefixSuffix(input: string, opts: PrefixSuffixOptions): string {
  if (!input) return "";

  const o = { ...DEFAULT_OPTIONS, ...opts };
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let regex: RegExp | null = null;
  if (o.matchRegex) {
    try {
      regex = new RegExp(o.matchRegex);
    } catch {
      regex = null;
    }
  }

  let counter = o.counterStart;
  const result: string[] = [];

  for (const line of lines) {
    const isEmpty = line.trim() === "";

    if (isEmpty && o.skipEmpty && !o.reverse) {
      result.push(line);
      continue;
    }

    let content = o.trimLines ? line.trim() : line;

    if (o.reverse) {
      const stripped = stripAffixes(content, o.prefix, o.suffix);
      result.push(stripped);
      continue;
    }

    // Regex conditional — skip lines that don't match
    if (regex && !regex.test(content)) {
      result.push(content);
      continue;
    }

    // Escape content
    content = escapeContent(content, o.escape);

    // Interpolate counter tokens in prefix/suffix
    const prefix = interpolate(o.prefix, counter, o);
    const suffix = interpolate(o.suffix, counter, o);

    result.push(prefix + content + suffix);
    counter += o.counterStep;
  }

  return result.join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function addPrefixSuffixNumbered(
  text: string,
  prefix: string,
  suffix: string,
  options: { startNum?: number; padLength?: number; separator?: string; skipBlank?: boolean } = {},
): string {
  const { startNum = 1, padLength = 0, separator = "", skipBlank = true } = options;
  const lines = text.split("\n");
  let counter = startNum;
  return lines.map((line) => {
    if (skipBlank && line.trim().length === 0) return line;
    const num = String(counter).padStart(padLength, "0");
    counter++;
    return `${prefix}${separator}${num}${separator}${line}${separator}${suffix}`;
  }).join("\n");
}

export function addPrefixSuffixToWords(text: string, prefix: string, suffix: string): string {
  return text.split(/(\s+)/).map((part) => /\s/.test(part) ? part : `${prefix}${part}${suffix}`).join("");
}

export function addPrefixSuffixToSentences(text: string, prefix: string, suffix: string): string {
  return text.split(/(?<=[.!?])\s+/).map((s) => `${prefix}${s}${suffix}`).join(" ");
}

export function addPrefixSuffixToParagraphs(text: string, prefix: string, suffix: string): string {
  return text.split(/\n{2,}/).map((p) => `${prefix}${p}${suffix}`).join("\n\n");
}

export function removePrefixSuffix(text: string, prefix: string, suffix: string): string {
  return text.split("\n").map((line) => {
    let result = line;
    if (prefix && result.startsWith(prefix)) result = result.slice(prefix.length);
    if (suffix && result.endsWith(suffix)) result = result.slice(0, -suffix.length);
    return result;
  }).join("\n");
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validatePrefixSuffix(prefix: string, suffix: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!prefix && !suffix) {
    reports.push({ level: "warn", code: "BOTH_EMPTY", message: "Both prefix and suffix are empty." });
  } else {
    reports.push({ level: "pass", code: "VALID", message: `Prefix: "${prefix || "(none)"}", Suffix: "${suffix || "(none)"}".` });
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(prefix: string, suffix: string): Receipt {
  const s = prefix + "|" + suffix;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "add-prefix-suffix", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "String-Methods", citation: "MDN: String.prototype", summary: "JavaScript string manipulation." },
];
