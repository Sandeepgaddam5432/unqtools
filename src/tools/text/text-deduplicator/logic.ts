/** Text Deduplicator — pure logic. */

export type Mode = "lines" | "words";
export type MatchMethod = "exact" | "case-insensitive" | "fuzzy";

export interface DedupeOptions {
  mode: Mode;
  method: MatchMethod;
  fuzzyThreshold?: number; // 0-1 — similarity below this counts as duplicate
  keepFirst?: boolean;
  sortOutput?: boolean;
}

export interface DedupeResult {
  output: string;
  inputCount: number;
  outputCount: number;
  duplicatesRemoved: number;
  warnings: string[];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length]!;
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function process(input: string, options: DedupeOptions): DedupeResult | { error: string } {
  const warnings: string[] = [];
  const threshold = options.fuzzyThreshold ?? 0.85;
  if (threshold < 0 || threshold > 1) return { error: "Fuzzy threshold must be between 0 and 1" };
  const items = options.mode === "lines"
    ? input.split("\n")
    : (input.match(/\S+/g) ?? []);
  const inputCount = items.length;
  const kept: string[] = [];
  const seenKeys: string[] = [];
  const seenLower: string[] = [];
  for (const item of items) {
    let isDup = false;
    if (options.method === "exact") {
      if (seenKeys.includes(item)) isDup = true;
      else seenKeys.push(item);
    } else if (options.method === "case-insensitive") {
      const low = item.toLowerCase();
      if (seenLower.includes(low)) isDup = true;
      else seenLower.push(low);
    } else {
      for (const k of seenKeys) {
        if (similarity(k, item) >= threshold) { isDup = true; break; }
      }
      if (!isDup) seenKeys.push(item);
    }
    if (!isDup) kept.push(item);
  }
  let output = kept;
  if (options.sortOutput) output = [...kept].sort();
  if (inputCount === 0 || (inputCount === 1 && items[0] === "")) warnings.push("Input is empty.");
  return {
    output: output.join(options.mode === "lines" ? "\n" : " "),
    inputCount,
    outputCount: output.length,
    duplicatesRemoved: inputCount - output.length,
    warnings,
  };
}

export function batchToCsv(results: DedupeResult[], labels: string[]): string {
  const lines = ["Label,InputCount,OutputCount,DuplicatesRemoved"];
  results.forEach((r, i) => {
    if ("error" in r) return;
    lines.push(`${labels[i] ?? i},${r.inputCount},${r.outputCount},${r.duplicatesRemoved}`);
  });
  return lines.join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

/**
 * Advanced deduplication with multiple modes.
 */
export type DedupeMode = "exact" | "caseInsensitive" | "trimmed" | "normalized";

export function deduplicateAdvanced(
  text: string,
  options: {
    mode?: DedupeMode;
    unit?: "lines" | "words" | "paragraphs";
    keep?: "first" | "last" | "longest" | "shortest";
    caseSensitive?: boolean;
    trimWhitespace?: boolean;
    normalizeUnicode?: boolean;
  } = {},
): { output: string; originalCount: number; uniqueCount: number; removedCount: number; duplicates: string[] } {
  const {
    mode = "exact",
    unit = "lines",
    keep = "first",
    caseSensitive = true,
    trimWhitespace = false,
    normalizeUnicode = false,
  } = options;

  const separator = unit === "words" ? /\s+/ : unit === "paragraphs" ? /\n{2,}/ : /\n/;
  const items = text.split(separator);
  const originalCount = items.length;

  const normalize = (s: string): string => {
    let r = s;
    if (trimWhitespace) r = r.trim();
    if (!caseSensitive) r = r.toLowerCase();
    if (normalizeUnicode) r = r.normalize("NFC");
    return r;
  };

  const seen = new Map<string, { index: number; value: string }>();
  const result: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const key = normalize(item);
    if (!seen.has(key)) {
      seen.set(key, { index: i, value: item });
      result.push(item);
    } else {
      const existing = seen.get(key)!;
      if (keep === "last") {
        result[existing.index] = item;
        existing.value = item;
      } else if (keep === "longest" && item.length > existing.value.length) {
        result[existing.index] = item;
        existing.value = item;
      } else if (keep === "shortest" && item.length < existing.value.length) {
        result[existing.index] = item;
        existing.value = item;
      }
    }
  }

  const uniqueCount = result.length;
  const removedCount = originalCount - uniqueCount;
  const duplicates = items.filter((item, i) => {
    const key = normalize(item);
    const firstIdx = items.findIndex((it) => normalize(it) === key);
    return firstIdx !== i;
  });

  return {
    output: result.join(unit === "words" ? " " : unit === "paragraphs" ? "\n\n" : "\n"),
    originalCount,
    uniqueCount,
    removedCount,
    duplicates,
  };
}

/**
 * Find near-duplicates using Levenshtein distance.
 */
export function findNearDuplicates(
  lines: string[],
  threshold: number = 0.8,
): Array<{ a: number; b: number; similarity: number }> {
  const result: Array<{ a: number; b: number; similarity: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const sim = levenshteinSimilarity(lines[i]!, lines[j]!);
      if (sim >= threshold) {
        result.push({ a: i, b: j, similarity: sim });
      }
    }
  }
  return result;
}

/**
 * Levenshtein distance-based similarity (0-1).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Levenshtein edit distance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
    }
  }
  return d[m]![n]!;
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateDedupeInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text || text.trim().length === 0) {
    reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." });
    return reports;
  }
  const lines = text.split("\n");
  if (lines.length > 10000) {
    reports.push({ level: "warn", code: "LARGE_INPUT", message: `${lines.length} lines — processing may be slow.` });
  }
  const unique = new Set(lines.map((l) => l.trim().toLowerCase()));
  const dupRatio = 1 - unique.size / lines.length;
  if (dupRatio > 0.5) {
    reports.push({ level: "warn", code: "MANY_DUPES", message: `${Math.round(dupRatio * 100)}% of lines appear to be duplicates.` });
  } else {
    reports.push({ level: "pass", code: "INPUT_OK", message: `${lines.length} lines, ${unique.size} unique.` });
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
    tool: "text-deduplicator",
    version: "100x.1.0",
    timestamp: new Date().toISOString(),
    inputFingerprint: (h >>> 0).toString(16).padStart(8, "0"),
  };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Levenshtein-1966", citation: "Levenshtein V.I. (1966)", summary: "Binary codes capable of correcting deletions, insertions, and reversals." },
  { id: "Unicode-NFC", citation: "Unicode Standard Annex #15", summary: "Unicode Normalization Forms." },
];
