/**
 * Text Reverse Words — pure logic. No DOM access.
 *
 * Extras:
 *  1. Per-line word reversal
 *  2. Per-sentence word reversal (split by . ! ?)
 *  3. Preserve trailing/leading whitespace
 *  4. Keep punctuation attached to words
 *  5. Batch validation
 *  6. Stats (lines, words, chars)
 *  7. Identity check
 *  8. Tokenizer + reverser
 *  9. Custom delimiter support
 * 10. Trim/normalize option
 * 11. Sentence detection
 * 12. Presets
 */
export type ReversalScope = "line" | "sentence" | "all";

export interface ReverseWordsOptions {
  preserveEdges: boolean;
  keepPunctuation: boolean;
  scope: ReversalScope;
  /** Custom delimiter regex for splitting (defaults to whitespace). */
  customDelimiter: string;
  /** Normalize multiple whitespace runs to single space. */
  normalizeWhitespace: boolean;
}

export const DEFAULT_OPTIONS: ReverseWordsOptions = {
  preserveEdges: true,
  keepPunctuation: true,
  scope: "line",
  customDelimiter: "",
  normalizeWhitespace: false,
};

/** Tokenize a line into words (with optional punctuation) and whitespace gaps. */
export function tokenizeLine(line: string, keepPunctuation: boolean): string[] {
  if (keepPunctuation) {
    return line.match(/\S+|\s+/g) ?? [];
  }
  return line.match(/[A-Za-z0-9']+|\s+|[^\sA-Za-z0-9']+/g) ?? [];
}

/** Tokenize using a custom delimiter. */
export function tokenizeWithDelimiter(line: string, delimiter: string): string[] {
  if (!delimiter) return tokenizeLine(line, true);
  try {
    const re = new RegExp(`(${delimiter})`, "g");
    return line.split(re).filter((t) => t.length > 0);
  } catch {
    return tokenizeLine(line, true);
  }
}

/** Reverse word order on a single line, preserving whitespace runs. */
export function reverseLine(line: string, opts: ReverseWordsOptions): string {
  const tokens = opts.customDelimiter
    ? tokenizeWithDelimiter(line, opts.customDelimiter)
    : tokenizeLine(line, opts.keepPunctuation);
  const words = tokens.filter((t) => /\S/.test(t));
  const reversed = words.slice().reverse();
  let wi = 0;
  const out = tokens.map((t) => (/\S/.test(t) ? reversed[wi++] ?? "" : t));
  let result = out.join("");
  if (opts.normalizeWhitespace) result = result.replace(/\s+/g, " ");
  if (!opts.preserveEdges) result = result.trim();
  return result;
}

/** Split text into sentences (preserving terminators). */
export function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]*\s*|\s+/g) ?? [];
}

/** Reverse words within each sentence. */
export function reverseBySentence(text: string, opts: ReverseWordsOptions): string {
  if (!text) return "";
  const parts = splitSentences(text);
  return parts.map((part) => {
    if (!part.trim()) return part;
    return reverseLine(part, opts);
  }).join("");
}

/** Reverse word order across the entire text (treat as one stream). */
export function reverseAllWords(text: string, opts: ReverseWordsOptions): string {
  if (!text) return "";
  return reverseLine(text.replace(/\n/g, " "), opts);
}

/** Reverse word order on each line. */
export function reverseWords(input: string, opts: ReverseWordsOptions): string {
  if (!input) return "";
  if (opts.scope === "sentence") return reverseBySentence(input, opts);
  if (opts.scope === "all") return reverseAllWords(input, opts);
  return input.split("\n").map((line) => reverseLine(line, opts)).join("\n");
}

/** Validate options. */
export function validateOptions(opts: Partial<ReverseWordsOptions>): ReverseWordsOptions {
  return {
    preserveEdges: opts.preserveEdges ?? true,
    keepPunctuation: opts.keepPunctuation ?? true,
    scope: opts.scope ?? "line",
    customDelimiter: opts.customDelimiter ?? "",
    normalizeWhitespace: opts.normalizeWhitespace ?? false,
  };
}

/** True when options produce a no-op (impossible for reverse). */
export function isIdentity(_opts: ReverseWordsOptions): boolean {
  return false;
}

/** Batch-validate a list of inputs. */
export function batchValidate(inputs: { name: string }[], opts: ReverseWordsOptions): { name: string; result: ReverseWordsOptions }[] {
  return inputs.map((f) => ({ name: f.name, result: validateOptions(opts) }));
}

/** Stats about input. */
export function textStats(text: string): { lines: number; words: number; chars: number } {
  const lines = text ? text.split("\n").length : 0;
  const words = text ? (text.match(/\S+/g) ?? []).length : 0;
  return { lines, words, chars: text.length };
}

/** Count sentences in text. */
export function sentenceCount(text: string): number {
  return (text.match(/[.!?]+/g) ?? []).length;
}

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<ReverseWordsOptions, "customDelimiter"> }[] = [
  { id: "default", label: "Default (line)", options: { preserveEdges: true, keepPunctuation: true, scope: "line", normalizeWhitespace: false } },
  { id: "trim", label: "Trimmed", options: { preserveEdges: false, keepPunctuation: true, scope: "line", normalizeWhitespace: true } },
  { id: "sentence", label: "Per-sentence", options: { preserveEdges: true, keepPunctuation: true, scope: "sentence", normalizeWhitespace: false } },
  { id: "all", label: "All (flatten)", options: { preserveEdges: false, keepPunctuation: true, scope: "all", normalizeWhitespace: true } },
  { id: "no-punct", label: "Separate punctuation", options: { preserveEdges: true, keepPunctuation: false, scope: "line", normalizeWhitespace: false } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}

/** Word count helper. */
export function wordCount(text: string): number {
  return text ? (text.match(/\S+/g) ?? []).length : 0;
}

/** Reverse character order of each word (not the word order itself). */
export function reverseCharsInWords(input: string, opts: ReverseWordsOptions): string {
  if (!input) return "";
  return input.split("\n").map((line) => {
    const tokens = tokenizeLine(line, opts.keepPunctuation);
    return tokens.map((t) => (/\S/.test(t) ? t.split("").reverse().join("") : t)).join("");
  }).join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function reverseWordsInParagraphs(text: string): string {
  return text.split(/\n{2,}/).map((p) => reverseWords(p)).join("\n\n");
}

export function reverseMatchingWords(text: string, pattern: RegExp): string {
  return text.split(/(\s+)/).map((part) => {
    if (/\s/.test(part)) return part;
    return pattern.test(part) ? part.split("").reverse().join("") : part;
  }).join("");
}

export function rotateWords(text: string, shift: number): string {
  const words = text.split(/\s+/);
  const n = words.length;
  if (n === 0) return text;
  const effectiveShift = ((shift % n) + n) % n;
  return [...words.slice(effectiveShift), ...words.slice(0, effectiveShift)].join(" ");
}

export function swapFirstLastWords(text: string): string {
  return text.split("\n").map((line) => {
    const words = line.split(/\s+/);
    if (words.length < 2) return line;
    const first = words[0]!;
    const last = words[words.length - 1]!;
    words[0] = last;
    words[words.length - 1] = first;
    return words.join(" ");
  }).join("\n");
}

export function sortByWordLength(text: string, descending: boolean = true): string {
  const words = text.split(/\s+/);
  words.sort((a, b) => descending ? b.length - a.length : a.length - b.length);
  return words.join(" ");
}

export interface ValidationReport {
  level: "pass" | "warn" | "fail";
  code: string;
  message: string;
}

export function validateReverseWordsInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const wordCount = (text.match(/\S+/g) ?? []).length;
  reports.push({ level: "pass", code: "WORD_COUNT", message: `${wordCount} words detected.` });
  return reports;
}

export interface Receipt {
  tool: string;
  version: string;
  timestamp: string;
  inputFingerprint: string;
}

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-reverse-words", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Unicode-UAX29", citation: "Unicode Standard Annex #29", summary: "Word boundaries in Unicode text." },
  { id: "NLP-Tokenization", citation: "NLP Fundamentals", summary: "Tokenization and word segmentation." },
];
