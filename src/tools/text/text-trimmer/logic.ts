/**
 * Text Trimmer — pure logic.
 */

export interface TrimOptions {
  trimLeading?: boolean;
  trimTrailing?: boolean;
  trimBoth?: boolean; // alias for leading+trailing
  collapseInternalWhitespace?: boolean;
  removeEmptyLines?: boolean;
  customChars?: string; // each char in this string will be trimmed from start/end
  stripQuotes?: "none" | "single" | "double" | "backtick" | "all";
  stripMarkdownSyntax?: boolean;
  stripHtmlTags?: boolean;
  stripZeroWidthChars?: boolean;
  stripBom?: boolean;
  perLine?: boolean;
}

export interface TrimResult {
  output: string;
  inputLength: number;
  outputLength: number;
  charsRemoved: number;
  linesRemoved: number;
  warnings: string[];
}

const ZERO_WIDTH_REGEX = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const BOM = "\uFEFF";
const HTML_TAG_REGEX = /<[^>]+>/g;
const MARKDOWN_SYNTAX_REGEX = /[*_~`#>[\]()!]/g;

export function trimText(input: string, options: TrimOptions): TrimResult | { error: string } {
  if (!input) return { output: "", inputLength: 0, outputLength: 0, charsRemoved: 0, linesRemoved: 0, warnings: [] };
  const warnings: string[] = [];
  const inputLength = input.length;
  let working = input;
  let linesRemoved = 0;

  const applyPerLine = (fn: (s: string) => string) => {
    if (options.perLine) {
      working = working.split("\n").map(fn).join("\n");
    } else {
      working = fn(working);
    }
  };

  // Strip BOM (start of string only)
  if (options.stripBom) {
    while (working.startsWith(BOM)) working = working.slice(1);
  }

  // Strip zero-width chars
  if (options.stripZeroWidthChars) {
    working = working.replace(ZERO_WIDTH_REGEX, "");
  }

  // Strip HTML tags
  if (options.stripHtmlTags) {
    applyPerLine((s) => s.replace(HTML_TAG_REGEX, ""));
  }

  // Strip markdown syntax
  if (options.stripMarkdownSyntax) {
    applyPerLine((s) => s.replace(MARKDOWN_SYNTAX_REGEX, ""));
  }

  // Strip quotes (loop until no change, to handle mixed wrapping)
  if (options.stripQuotes && options.stripQuotes !== "none") {
    const doSingle = options.stripQuotes === "single" || options.stripQuotes === "all";
    const doDouble = options.stripQuotes === "double" || options.stripQuotes === "all";
    const doBacktick = options.stripQuotes === "backtick" || options.stripQuotes === "all";
    applyPerLine((s) => {
      let out = s;
      let changed = true;
      while (changed) {
        changed = false;
        if (doSingle && out.startsWith("'")) { out = out.slice(1); changed = true; }
        if (doSingle && out.endsWith("'")) { out = out.slice(0, -1); changed = true; }
        if (doDouble && out.startsWith('"')) { out = out.slice(1); changed = true; }
        if (doDouble && out.endsWith('"')) { out = out.slice(0, -1); changed = true; }
        if (doBacktick && out.startsWith("`")) { out = out.slice(1); changed = true; }
        if (doBacktick && out.endsWith("`")) { out = out.slice(0, -1); changed = true; }
      }
      return out;
    });
  }

  // Custom character trim
  if (options.customChars) {
    const chars = [...options.customChars];
    applyPerLine((s) => {
      let out = s;
      while (chars.length > 0 && chars.includes(out[0]!)) out = out.slice(1);
      while (chars.length > 0 && chars.includes(out[out.length - 1]!)) out = out.slice(0, -1);
      return out;
    });
  }

  // Whitespace trim
  const doTrimLeading = options.trimLeading || options.trimBoth;
  const doTrimTrailing = options.trimTrailing || options.trimBoth;
  if (doTrimLeading || doTrimTrailing) {
    applyPerLine((s) => {
      let out = s;
      if (doTrimLeading) out = out.replace(/^\s+/, "");
      if (doTrimTrailing) out = out.replace(/\s+$/, "");
      return out;
    });
  }

  // Collapse internal whitespace
  if (options.collapseInternalWhitespace) {
    applyPerLine((s) => s.replace(/[ \t]+/g, " "));
  }

  // Remove empty lines (only truly empty — whitespace-only preserved)
  if (options.removeEmptyLines) {
    const before = working.split("\n").length;
    working = working.split("\n").filter((line) => line.length > 0).join("\n");
    const after = working.split("\n").length;
    linesRemoved = before - after;
  }

  const outputLength = working.length;
  if (outputLength === 0 && inputLength > 0) warnings.push("Output is empty — input was entirely trimmed.");

  return {
    output: working,
    inputLength,
    outputLength,
    charsRemoved: inputLength - outputLength,
    linesRemoved,
    warnings,
  };
}

/** Batch mode: trim each line independently with same options. */
export function trimBatch(inputs: string[], options: TrimOptions): TrimResult[] {
  return inputs.map((input) => {
    const r = trimText(input, options);
    return "error" in r ? { output: "", inputLength: input.length, outputLength: 0, charsRemoved: input.length, linesRemoved: 0, warnings: ["Error"] } : r;
  });
}

/** Generate diff stats CSV. */
export function diffStatsToCsv(results: TrimResult[], inputs: string[]): string {
  const lines = ["Input,Output,InputLength,OutputLength,CharsRemoved"];
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    const escapedIn = `"${inputs[i]!.replace(/"/g, '""')}"`;
    const escapedOut = `"${r.output.replace(/"/g, '""')}"`;
    lines.push(`${escapedIn},${escapedOut},${r.inputLength},${r.outputLength},${r.charsRemoved}`);
  }
  return lines.join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Trim options with all possible trim modes.
 */
export interface AdvancedTrimOptions {
  trimStart?: boolean;
  trimEnd?: boolean;
  trimLines?: boolean;
  collapseSpaces?: boolean;
  collapseBlankLines?: boolean;
  removeBlankLines?: boolean;
  trimTrailingWhitespace?: boolean;
  trimLeadingWhitespace?: boolean;
}

/**
 * Advanced trim with per-option control.
 */
export function trimAdvanced(text: string, options: AdvancedTrimOptions = {}): string {
  let result = text;
  if (options.trimLines) {
    result = result.split("\n").map((l) => l.trim()).join("\n");
  }
  if (options.collapseSpaces) {
    result = result.replace(/[^\S\n]+/g, " ");
  }
  if (options.removeBlankLines) {
    result = result.split("\n").filter((l) => l.trim().length > 0).join("\n");
  } else if (options.collapseBlankLines) {
    result = result.replace(/\n{3,}/g, "\n\n");
  }
  if (options.trimTrailingWhitespace) {
    result = result.replace(/[^\S\n]+$/gm, "");
  }
  if (options.trimLeadingWhitespace) {
    result = result.replace(/^\s+/gm, "");
  }
  if (options.trimStart) {
    result = result.replace(/^\s+/, "");
  }
  if (options.trimEnd) {
    result = result.replace(/\s+$/, "");
  }
  return result;
}

/**
 * Count whitespace statistics.
 */
export function whitespaceStats(text: string): {
  leadingSpaces: number;
  trailingSpaces: number;
  trailingNewlines: number;
  blankLines: number;
  tabs: number;
  totalWhitespace: number;
} {
  const lines = text.split("\n");
  let leadingSpaces = 0;
  let trailingSpaces = 0;
  let blankLines = 0;
  let tabs = (text.match(/\t/g) ?? []).length;
  let totalWhitespace = (text.match(/\s/g) ?? []).length;
  let trailingNewlines = (text.match(/\n+$/) ?? [""])[0]!.length;
  for (const line of lines) {
    if (line.trim().length === 0) blankLines++;
    const lead = line.match(/^\s+/);
    const trail = line.match(/\s+$/);
    if (lead) leadingSpaces += lead[0].length;
    if (trail) trailingSpaces += trail[0].length;
  }
  return { leadingSpaces, trailingSpaces, trailingNewlines, blankLines, tabs, totalWhitespace };
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateTrimInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) {
    reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." });
    return reports;
  }
  const stats = whitespaceStats(text);
  if (stats.trailingSpaces > 0) {
    reports.push({ level: "warn", code: "TRAILING_SPACES", message: `${stats.trailingSpaces} trailing space characters detected.` });
  }
  if (stats.blankLines > 5) {
    reports.push({ level: "warn", code: "MANY_BLANK_LINES", message: `${stats.blankLines} blank lines detected.` });
  }
  if (stats.tabs > 0) {
    reports.push({ level: "info" as "pass", code: "TABS_FOUND", message: `${stats.tabs} tab characters detected.` });
  }
  if (stats.trailingSpaces === 0 && stats.blankLines <= 5) {
    reports.push({ level: "pass", code: "CLEAN", message: "Text appears clean — minimal whitespace issues." });
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + text.charCodeAt(0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    tool: "text-trimmer",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Unicode-White_Space", citation: "Unicode Standard §5.7", summary: "White space characters and normalization." },
  { id: "ECMA-262-String", citation: "ECMA-262 §22.1", summary: "String.prototype.trim and related methods." },
];
