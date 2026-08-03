/** Text Statistics — pure logic. */

export interface StatsOptions {
  wordsPerMinute?: number; // for reading time
}

export interface StatsResult {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  syllables: number;
  readingTimeMinutes: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  averageWordLength: number;
  averageSentenceLength: number;
  longestWord: string;
  warnings: string[];
}

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let count = 0;
  let prevVowel = false;
  for (let i = 0; i < w.length; i++) {
    const v = VOWELS.has(w[i]!);
    if (v && !prevVowel) count++;
    prevVowel = v;
  }
  if (w.endsWith("e")) count = Math.max(1, count - 1);
  if (w.endsWith("le") && w.length > 2 && !VOWELS.has(w[w.length - 3]!)) count++;
  return Math.max(1, count);
}

export function process(input: string, options: StatsOptions = {}): StatsResult {
  const warnings: string[] = [];
  const wpm = options.wordsPerMinute ?? 200;
  const text = input ?? "";
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const words = (text.match(/\b[\p{L}\p{N}']+\b/gu) ?? []);
  const wordCount = words.length;
  const sentences = (text.match(/[^.!?]+[.!?]+/g) ?? []).length || (wordCount > 0 ? 1 : 0);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const lines = text === "" ? 0 : text.split("\n").length;
  let syllables = 0;
  let longestWord = "";
  let totalLen = 0;
  for (const w of words) {
    syllables += countSyllables(w);
    totalLen += w.length;
    if (w.length > longestWord.length) longestWord = w;
  }
  const averageWordLength = wordCount > 0 ? totalLen / wordCount : 0;
  const averageSentenceLength = sentences > 0 ? wordCount / sentences : 0;
  const readingTimeMinutes = wordCount > 0 ? wordCount / wpm : 0;
  let fleschReadingEase = 0;
  let fleschKincaidGrade = 0;
  if (wordCount > 0 && sentences > 0) {
    const sylPerWord = syllables / wordCount;
    const wordsPerSent = wordCount / sentences;
    fleschReadingEase = 206.835 - 1.015 * wordsPerSent - 84.6 * sylPerWord;
    fleschKincaidGrade = 0.39 * wordsPerSent + 11.8 * sylPerWord - 15.59;
  }
  if (wordCount === 0) warnings.push("No words detected.");
  return {
    characters, charactersNoSpaces, words: wordCount, sentences, paragraphs, lines,
    syllables, readingTimeMinutes, fleschReadingEase, fleschKincaidGrade,
    averageWordLength, averageSentenceLength, longestWord, warnings,
  };
}

export function statsToCsv(s: StatsResult): string {
  return [
    "Metric,Value",
    `Characters,${s.characters}`,
    `Characters (no spaces),${s.charactersNoSpaces}`,
    `Words,${s.words}`,
    `Sentences,${s.sentences}`,
    `Paragraphs,${s.paragraphs}`,
    `Lines,${s.lines}`,
    `Syllables,${s.syllables}`,
    `Reading time (min),${s.readingTimeMinutes.toFixed(2)}`,
    `Flesch Reading Ease,${s.fleschReadingEase.toFixed(2)}`,
    `Flesch-Kincaid Grade,${s.fleschKincaidGrade.toFixed(2)}`,
    `Avg word length,${s.averageWordLength.toFixed(2)}`,
    `Avg sentence length,${s.averageSentenceLength.toFixed(2)}`,
    `Longest word,${s.longestWord}`,
  ].join("\n");
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export function comprehensiveStats(text: string): {
  characters: number; charactersNoSpaces: number; words: number; sentences: number;
  paragraphs: number; lines: number; syllables: number; uniqueWords: number;
  avgWordLength: number; avgSentenceLength: number; avgSyllablesPerWord: number;
  longestWord: string; shortestWord: string; readingTimeMinutes: number; speakingTimeMinutes: number;
} {
  const words = text.split(/\s+/).filter(Boolean);
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const sentences = (text.match(/[.!?]+/g) ?? []).length || 1;
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 0).length;
  const lines = text.split("\n").length;
  const uniqueWordsSet = new Set(words.map((w) => w.toLowerCase()));
  const totalWordLen = words.reduce((a, w) => a + w.length, 0);
  const syllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const longestWord = words.reduce((a, b) => b.length > a.length ? b : a, "");
  const shortestWord = words.reduce((a, b) => b.length < a.length ? b : a, words[0] ?? "");
  return {
    characters, charactersNoSpaces, words: words.length, sentences, paragraphs, lines, syllables,
    uniqueWords: uniqueWordsSet.size,
    avgWordLength: words.length > 0 ? Math.round((totalWordLen / words.length) * 100) / 100 : 0,
    avgSentenceLength: words.length > 0 ? Math.round((words.length / sentences) * 100) / 100 : 0,
    avgSyllablesPerWord: words.length > 0 ? Math.round((syllables / words.length) * 100) / 100 : 0,
    longestWord, shortestWord,
    readingTimeMinutes: Math.round((words.length / 200) * 100) / 100,
    speakingTimeMinutes: Math.round((words.length / 130) * 100) / 100,
  };
}

export function wordFrequencyAnalysis(text: string, options: { removeStopWords?: boolean; topN?: number; minLength?: number } = {}): Array<{ word: string; count: number; percentage: number }> {
  const { removeStopWords = true, topN = 20, minLength = 3 } = options;
  const stopWords = new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","is","was","are","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","can","this","that","these","those","i","you","he","she","it","we","they","as","if","so","not","no","yes"]);
  const words = text.toLowerCase().split(/\s+/).filter((w) => {
    const clean = w.replace(/[^a-z']/g, "");
    return clean.length >= minLength && (!removeStopWords || !stopWords.has(clean));
  });
  const freq = new Map<string, number>();
  for (const word of words) freq.set(word, (freq.get(word) ?? 0) + 1);
  const total = words.length || 1;
  return Array.from(freq.entries())
    .map(([word, count]) => ({ word, count, percentage: Math.round((count / total) * 10000) / 100 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

export function characterDistribution(text: string): { letters: number; digits: number; punctuation: number; whitespace: number; uppercase: number; lowercase: number; symbols: number; control: number } {
  let letters = 0, digits = 0, punctuation = 0, whitespace = 0, uppercase = 0, lowercase = 0, symbols = 0, control = 0;
  for (const char of text) {
    if (/[a-z]/.test(char)) { letters++; lowercase++; }
    else if (/[A-Z]/.test(char)) { letters++; uppercase++; }
    else if (/[0-9]/.test(char)) { digits++; }
    else if (/\s/.test(char)) { whitespace++; }
    else if (/[.,;:!?'"()\-]/.test(char)) { punctuation++; }
    else if (/[\x00-\x1F\x7F]/.test(char)) { control++; }
    else { symbols++; }
  }
  return { letters, digits, punctuation, whitespace, uppercase, lowercase, symbols, control };
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateStatsInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text || text.trim().length === 0) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const stats = comprehensiveStats(text);
  if (stats.words > 100000) reports.push({ level: "warn", code: "LARGE_INPUT", message: `${stats.words} words — processing may be slow.` });
  reports.push({ level: "pass", code: "VALID", message: `${stats.words} words, ${stats.sentences} sentences.` });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-statistics", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Flesch-1948", citation: "Flesch, R. (1948). A new readability yardstick.", summary: "Journal of Applied Psychology, 32(3), 221-233." },
  { id: "Zipf-1949", citation: "Zipf, G. K. (1949). Human behavior and the principle of least effort.", summary: "Word frequency distributions." },
];
