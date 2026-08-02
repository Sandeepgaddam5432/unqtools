/** Text Finder & Replacer — pure logic. */

export interface FindOptions {
  find: string;
  replace: string;
  useRegex?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  multiline?: boolean;
}

export interface FindResult {
  output: string;
  matches: number;
  matchLines: number[];
  warnings: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function process(input: string, options: FindOptions): FindResult | { error: string } {
  if (!options.find) return { error: "Find pattern is empty" };
  const warnings: string[] = [];
  let pattern: string;
  try {
    pattern = options.useRegex ? options.find : escapeRegex(options.find);
  } catch (e) {
    return { error: `Invalid pattern: ${(e as Error).message}` };
  }
  if (options.wholeWord) pattern = `\\b${pattern}\\b`;
  let flags = "g";
  if (!options.caseSensitive) flags += "i";
  if (options.multiline) flags += "m";

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (e) {
    return { error: `Invalid regex: ${(e as Error).message}` };
  }

  const matchLines = new Set<number>();
  let matches = 0;
  try {
    const replaced = input.replace(regex, (match, ...args) => {
      matches++;
      // args layout: [...captureGroups, offset, fullString]
      const offset: number = typeof args[args.length - 2] === "number"
        ? (args[args.length - 2] as number)
        : 0;
      const before = input.slice(0, offset);
      const line = before.split("\n").length;
      matchLines.add(line);
      return options.replace.replace(/\$0/g, match).replace(/\$(\d+)/g, (_, n) => args[Number(n) - 1] ?? "");
    });
    if (matches === 0) warnings.push("No matches found.");
    return { output: replaced, matches, matchLines: [...matchLines].sort((a, b) => a - b), warnings };
  } catch (e) {
    return { error: `Replace failed: ${(e as Error).message}` };
  }
}

export interface BatchRow {
  input: string;
  result: FindResult | { error: string };
}

export function batchProcess(inputs: string[], options: FindOptions): BatchRow[] {
  return inputs.map((input) => ({ input, result: process(input, options) }));
}

export function batchToCsv(rows: BatchRow[]): string {
  const lines = ["Input,Output,Matches"];
  for (const row of rows) {
    const out = "error" in row.result ? "" : row.result.output;
    const matches = "error" in row.result ? 0 : row.result.matches;
    const ein = `"${row.input.replace(/"/g, '""')}"`;
    const eout = `"${out.replace(/"/g, '""')}"`;
    lines.push(`${ein},${eout},${matches}`);
  }
  return lines.join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Advanced find-and-replace with regex support.
 */
export function findReplaceAdvanced(
  text: string,
  find: string,
  replace: string,
  options: { useRegex?: boolean; caseSensitive?: boolean; wholeWord?: boolean; multiline?: boolean } = {},
): { output: string; replacements: number; matches: Array<{ index: number; matched: string; replaced: string }> } {
  const { useRegex = false, caseSensitive = false, wholeWord = false, multiline = false } = options;
  let pattern: RegExp;
  try {
    if (useRegex) {
      const flags = caseSensitive ? (multiline ? "gm" : "g") : (multiline ? "gim" : "gi");
      pattern = new RegExp(find, flags);
    } else {
      const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const prefix = wholeWord ? "\\b" : "";
      const suffix = wholeWord ? "\\b" : "";
      const flags = caseSensitive ? (multiline ? "gm" : "g") : (multiline ? "gim" : "gi");
      pattern = new RegExp(prefix + escaped + suffix, flags);
    }
  } catch {
    return { output: text, replacements: 0, matches: [] };
  }
  const matches: Array<{ index: number; matched: string; replaced: string }> = [];
  let replacementCount = 0;
  const output = text.replace(pattern, (matched, ...args) => {
    const index = args[args.length - 2] as number;
    const replaced = replace.replace(/\$&/g, matched);
    matches.push({ index, matched, replaced });
    replacementCount++;
    return replaced;
  });
  return { output, replacements: replacementCount, matches };
}

/**
 * Highlight matches without replacing.
 */
export function highlightMatches(
  text: string,
  find: string,
  options: { useRegex?: boolean; caseSensitive?: boolean } = {},
): Array<{ start: number; end: number; text: string }> {
  const { useRegex = false, caseSensitive = false } = options;
  let pattern: RegExp;
  try {
    if (useRegex) {
      pattern = new RegExp(find, caseSensitive ? "g" : "gi");
    } else {
      const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      pattern = new RegExp(escaped, caseSensitive ? "g" : "gi");
    }
  } catch {
    return [];
  }
  const results: Array<{ start: number; end: number; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    results.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m.index === pattern.lastIndex) pattern.lastIndex++;
  }
  return results;
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateFindReplaceInput(find: string, replace: string, options: { useRegex?: boolean } = {}): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!find) {
    reports.push({ level: "fail", code: "EMPTY_FIND", message: "Find pattern is empty." });
    return reports;
  }
  if (options.useRegex) {
    try {
      new RegExp(find);
      reports.push({ level: "pass", code: "VALID_REGEX", message: "Regular expression is valid." });
    } catch (e) {
      reports.push({ level: "fail", code: "INVALID_REGEX", message: `Invalid regex: ${(e as Error).message}` });
    }
  }
  if (find.length > 10000) {
    reports.push({ level: "warn", code: "LONG_PATTERN", message: "Find pattern is very long — may be slow." });
  }
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(find: string, replace: string): Receipt {
  const s = find.length + ":" + replace.length;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return {
    tool: "text-finder-replacer",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "MDN-RegExp", citation: "MDN Web Docs: RegExp", summary: "JavaScript regular expression reference." },
  { id: "ECMA-262", citation: "ECMA-262 §21.2", summary: "RegExp Objects — the ECMAScript specification." },
];
