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
