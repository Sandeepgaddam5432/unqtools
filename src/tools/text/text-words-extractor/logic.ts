/**
 * Text Words Extractor — pure tokenization + counting logic. No DOM access.
 */

export interface ExtractOptions {
  /** Minimum word length (default 1). */
  minLength: number;
  /** Case-sensitive unique words (default false). */
  caseSensitive: boolean;
  /** Ignore stop words. */
  ignoreStopWords: boolean;
  /** N-gram size (1 = single words, 2 = bigrams, etc.). */
  ngramSize: number;
}

export interface WordStats {
  totalWords: number;
  uniqueWords: number;
  totalChars: number;
  avgWordLength: number;
  longestWord: string;
}

export interface FrequencyEntry {
  word: string;
  count: number;
}

export interface ExtractResult {
  uniqueWords: string[];
  frequency: FrequencyEntry[];
  ngrams: FrequencyEntry[];
  stats: WordStats;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "of", "in", "on", "at",
  "to", "for", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "can", "this", "that", "these", "those",
  "i", "you", "he", "she", "it", "we", "they", "them", "their", "his", "her",
]);

/** Tokenize input into words (alphanumeric sequences, apostrophes inside words). */
export function tokenizeWords(input: string, opts: ExtractOptions): string[] {
  if (!input) return [];
  const matches = input.match(/[a-zA-Z0-9]+(?:'[a-zA-Z]+)?/g) ?? [];
  let words = matches;
  if (!opts.caseSensitive) words = words.map((w) => w.toLowerCase());
  if (opts.minLength > 1) words = words.filter((w) => w.length >= opts.minLength);
  if (opts.ignoreStopWords) words = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  return words;
}

/** Compute frequency map. */
export function wordFrequency(words: string[]): FrequencyEntry[] {
  const map = new Map<string, number>();
  for (const w of words) {
    map.set(w, (map.get(w) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** Build N-grams from a word list. */
export function buildNgrams(words: string[], n: number): FrequencyEntry[] {
  if (n <= 1) return wordFrequency(words);
  const map = new Map<string, number>();
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(" ");
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** Compute basic stats over a word list. */
export function computeStats(words: string[]): WordStats {
  if (words.length === 0) {
    return { totalWords: 0, uniqueWords: 0, totalChars: 0, avgWordLength: 0, longestWord: "" };
  }
  const totalChars = words.reduce((s, w) => s + w.length, 0);
  const uniqueWords = new Set(words).size;
  const longestWord = words.reduce((longest, w) => (w.length > longest.length ? w : longest), "");
  return {
    totalWords: words.length,
    uniqueWords,
    totalChars,
    avgWordLength: Math.round((totalChars / words.length) * 100) / 100,
    longestWord,
  };
}

/** Extract words, frequency, N-grams and stats. */
export function extractWords(input: string, opts: ExtractOptions): ExtractResult {
  const words = tokenizeWords(input, opts);
  const uniqueWords = [...new Set(words)].sort();
  return {
    uniqueWords,
    frequency: wordFrequency(words),
    ngrams: buildNgrams(words, Math.max(1, opts.ngramSize)),
    stats: computeStats(words),
  };
}

/** Convert frequency list to CSV. */
export function frequencyToCsv(freq: FrequencyEntry[]): string {
  const lines = ["Word,Count"];
  for (const f of freq) {
    const w = f.word.includes(",") || f.word.includes('"') ? `"${f.word.replace(/"/g, '""')}"` : f.word;
    lines.push(`${w},${f.count}`);
  }
  return lines.join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function extractWordsAdvanced(text: string, options: { minLength?: number; maxLength?: number; uniqueOnly?: boolean; sorted?: "none" | "alpha" | "frequency" | "length"; removeStopWords?: boolean; caseSensitive?: boolean; pattern?: RegExp } = {}): string[] {
  const { minLength = 0, maxLength = 0, uniqueOnly = false, sorted = "none", removeStopWords = false, caseSensitive = false, pattern } = options;
  const stopWords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","is","was","are","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","can"]);
  let words = text.split(/\s+/).filter(Boolean);
  if (!caseSensitive) words = words.map((w) => w.toLowerCase());
  words = words.filter((w) => {
    const clean = w.replace(/[^a-zA-Z0-9']/g, "");
    if (clean.length < minLength) return false;
    if (maxLength > 0 && clean.length > maxLength) return false;
    if (removeStopWords && stopWords.has(clean.toLowerCase())) return false;
    if (pattern && !pattern.test(clean)) return false;
    return true;
  });
  if (uniqueOnly) words = [...new Set(words)];
  switch (sorted) {
    case "alpha": words.sort((a, b) => a.localeCompare(b)); break;
    case "frequency": { const freq = new Map<string, number>(); for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1); words = [...new Set(words)].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0)); break; }
    case "length": words.sort((a, b) => b.length - a.length); break;
  }
  return words;
}

export function extractByPattern(text: string, pattern: RegExp): string[] {
  const matches = text.match(pattern);
  return matches ? matches : [];
}

export function extractUniqueWithStats(text: string): { words: string[]; totalWords: number; uniqueWords: number; uniqueRatio: number; avgLength: number; longestWord: string; shortestWord: string } {
  const allWords = text.split(/\s+/).filter(Boolean);
  const unique = [...new Set(allWords.map((w) => w.toLowerCase()))];
  const totalLen = allWords.reduce((a, w) => a + w.length, 0);
  const longest = allWords.reduce((a, b) => b.length > a.length ? b : a, "");
  const shortest = allWords.reduce((a, b) => b.length < a.length ? b : a, allWords[0] ?? "");
  return { words: unique, totalWords: allWords.length, uniqueWords: unique.length, uniqueRatio: allWords.length > 0 ? Math.round((unique.length / allWords.length) * 10000) / 100 : 0, avgLength: allWords.length > 0 ? Math.round((totalLen / allWords.length) * 100) / 100 : 0, longestWord: longest, shortestWord: shortest };
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateExtractInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text || text.trim().length === 0) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const words = text.split(/\s+/).filter(Boolean);
  reports.push({ level: "pass", code: "VALID", message: `${words.length} words found.` });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-words-extractor", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "NLP-Tokenization", citation: "Jurafsky & Martin (2023). SLP3.", summary: "Speech and Language Processing — tokenization." },
  { id: "Unicode-UAX29", citation: "Unicode Standard Annex #29", summary: "Word boundary detection in Unicode." },
];
