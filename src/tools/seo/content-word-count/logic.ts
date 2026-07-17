/**
 * Content Word Count & SEO Analyzer — pure logic.
 *
 * Counts words, characters, sentences, paragraphs; estimates reading &
 * speaking time; computes keyword density and an overall SEO score.
 *
 * Pure functions only — no DOM, no network.
 */

export interface CountStats {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  uniqueWords: number;
  averageWordLength: number;
  averageSentenceLength: number;
  longestWord: string;
  longestSentence: string;
  longestSentenceWordCount: number;
  readingTimeMinutes: number;   // @ 200 WPM
  readingTimeMinutes250: number; // @ 250 WPM
  speakingTimeMinutes: number;   // @ 130 WPM
}

export interface KeywordHit {
  word: string;
  count: number;
  density: number; // percentage
}

export interface SentenceLengthBucket {
  range: string;
  count: number;
}

export interface ParagraphStats {
  count: number;
  averageSentencesPerParagraph: number;
  averageWordsPerParagraph: number;
  longestParagraphWords: number;
}

export interface SeoScore {
  score: number;          // 0-100
  label: string;
  checks: Array<{ name: string; passed: boolean; hint: string }>;
}

export interface AnalysisResult {
  stats: CountStats;
  topKeywords: KeywordHit[];
  sentenceLengthBuckets: SentenceLengthBucket[];
  paragraphStats: ParagraphStats;
  seoScore: SeoScore;
}

export const DEFAULT_READING_WPM = 200;
export const READING_WPM_250 = 250;
export const SPEAKING_WPM = 130;
export const TOP_KEYWORDS_LIMIT = 10;

/** Common English stop words for keyword density filtering. */
export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "of", "to", "in",
  "for", "on", "with", "as", "by", "at", "from", "up", "down", "out", "over",
  "under", "again", "further", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should", "could",
  "can", "may", "might", "must", "shall", "this", "that", "these", "those", "i",
  "you", "he", "she", "it", "we", "they", "me", "him", "her", "us", "them", "my",
  "your", "his", "its", "our", "their", "what", "which", "who", "whom", "where",
  "when", "why", "how", "all", "any", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "also", "into", "via", "per", "off", "about",
  "above", "below", "between", "through", "during", "before", "after",
]);

export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  return text.toLowerCase().match(/[a-z0-9']+/g) || [];
}

export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  const matches = text.replace(/\n+/g, " ").match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  if (!matches) return [text.trim()].filter(Boolean);
  return matches.map((s) => s.trim()).filter(Boolean);
}

export function splitParagraphs(text: string): string[] {
  if (!text || !text.trim()) return [];
  return text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
}

export function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\n/).length;
}

/** Compute word/char/sentence counts and reading times. */
export function computeStats(text: string): CountStats {
  if (!text || !text.trim()) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
      uniqueWords: 0,
      averageWordLength: 0,
      averageSentenceLength: 0,
      longestWord: "",
      longestSentence: "",
      longestSentenceWordCount: 0,
      readingTimeMinutes: 0,
      readingTimeMinutes250: 0,
      speakingTimeMinutes: 0,
    };
  }
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, "").length;
  const unique = new Set(words);
  const totalLetters = words.reduce((sum, w) => sum + w.length, 0);
  let longestWord = "";
  for (const w of words) {
    if (w.length > longestWord.length) longestWord = w;
  }
  let longestSentence = "";
  let longestSentenceWordCount = 0;
  for (const s of sentences) {
    const n = tokenizeWords(s).length;
    if (n > longestSentenceWordCount) {
      longestSentenceWordCount = n;
      longestSentence = s;
    }
  }
  return {
    words: wordCount,
    characters,
    charactersNoSpaces,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    lines: countLines(text),
    uniqueWords: unique.size,
    averageWordLength: wordCount > 0 ? totalLetters / wordCount : 0,
    averageSentenceLength: wordCount / sentenceCount,
    longestWord,
    longestSentence,
    longestSentenceWordCount,
    readingTimeMinutes: wordCount / DEFAULT_READING_WPM,
    readingTimeMinutes250: wordCount / READING_WPM_250,
    speakingTimeMinutes: wordCount / SPEAKING_WPM,
  };
}

/** Compute top-N keyword frequency & density (filtered by stop words). */
export function computeTopKeywords(
  text: string,
  limit: number = TOP_KEYWORDS_LIMIT,
  excludeStopWords: boolean = true,
  customExclude?: string[],
): KeywordHit[] {
  const words = tokenizeWords(text);
  const total = words.length;
  if (total === 0) return [];
  const custom = new Set((customExclude || []).map((s) => s.toLowerCase().trim()).filter(Boolean));
  const freq = new Map<string, number>();
  for (const w of words) {
    if (w.length < 2) continue;
    if (excludeStopWords && STOP_WORDS.has(w)) continue;
    if (custom.has(w)) continue;
    freq.set(w, (freq.get(w) || 0) + 1);
  }
  const entries = Array.from(freq.entries());
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.slice(0, limit).map(([word, count]) => ({
    word,
    count,
    density: (count / total) * 100,
  }));
}

/** Build sentence-length distribution buckets. */
export function computeSentenceLengthBuckets(text: string): SentenceLengthBucket[] {
  const sentences = splitSentences(text);
  const buckets: SentenceLengthBucket[] = [
    { range: "1-5", count: 0 },
    { range: "6-10", count: 0 },
    { range: "11-15", count: 0 },
    { range: "16-20", count: 0 },
    { range: "21-30", count: 0 },
    { range: "31+", count: 0 },
  ];
  for (const s of sentences) {
    const n = tokenizeWords(s).length;
    if (n <= 5) buckets[0].count++;
    else if (n <= 10) buckets[1].count++;
    else if (n <= 15) buckets[2].count++;
    else if (n <= 20) buckets[3].count++;
    else if (n <= 30) buckets[4].count++;
    else buckets[5].count++;
  }
  return buckets;
}

export function computeParagraphStats(text: string): ParagraphStats {
  const paragraphs = splitParagraphs(text);
  if (paragraphs.length === 0) {
    return {
      count: 0,
      averageSentencesPerParagraph: 0,
      averageWordsPerParagraph: 0,
      longestParagraphWords: 0,
    };
  }
  let totalSentences = 0;
  let totalWords = 0;
  let longest = 0;
  for (const p of paragraphs) {
    const sCount = splitSentences(p).length;
    const wCount = tokenizeWords(p).length;
    totalSentences += sCount;
    totalWords += wCount;
    if (wCount > longest) longest = wCount;
  }
  return {
    count: paragraphs.length,
    averageSentencesPerParagraph: totalSentences / paragraphs.length,
    averageWordsPerParagraph: totalWords / paragraphs.length,
    longestParagraphWords: longest,
  };
}

/** Compute a simple SEO score from 0-100 based on common content SEO heuristics. */
export function computeSeoScore(text: string): SeoScore {
  const stats = computeStats(text);
  const checks: Array<{ name: string; passed: boolean; hint: string }> = [];
  // If text is empty, all checks fail
  if (stats.words === 0) {
    return {
      score: 0,
      label: "Needs work",
      checks: [
        { name: "Word count >= 300", passed: false, hint: "No text yet" },
        { name: "Word count >= 600 (long-form)", passed: false, hint: "No text yet" },
        { name: "At least 3 paragraphs", passed: false, hint: "No text yet" },
        { name: "Avg sentence length 15-20 words", passed: false, hint: "No text yet" },
        { name: "No sentence > 30 words", passed: false, hint: "No text yet" },
        { name: "Unique word ratio >= 50%", passed: false, hint: "No text yet" },
        { name: "Reading time >= 1 minute", passed: false, hint: "No text yet" },
      ],
    };
  }
  // Word count: aim for 300+
  checks.push({
    name: "Word count >= 300",
    passed: stats.words >= 300,
    hint: stats.words < 300 ? `Currently ${stats.words} words` : `Good: ${stats.words} words`,
  });
  // Word count: aim for 600+ (long-form ranks better)
  checks.push({
    name: "Word count >= 600 (long-form)",
    passed: stats.words >= 600,
    hint: stats.words < 600 ? `Currently ${stats.words} words` : `Excellent: ${stats.words} words`,
  });
  // Paragraphs: at least 3
  checks.push({
    name: "At least 3 paragraphs",
    passed: stats.paragraphs >= 3,
    hint: stats.paragraphs < 3 ? `Only ${stats.paragraphs} paragraphs` : `${stats.paragraphs} paragraphs`,
  });
  // Average sentence length: ideally 15-20
  checks.push({
    name: "Avg sentence length 15-20 words",
    passed: stats.averageSentenceLength >= 15 && stats.averageSentenceLength <= 20,
    hint: `Currently ${stats.averageSentenceLength.toFixed(1)} words/sentence`,
  });
  // No sentence longer than 30 words
  checks.push({
    name: "No sentence > 30 words",
    passed: stats.longestSentenceWordCount <= 30,
    hint: `Longest: ${stats.longestSentenceWordCount} words`,
  });
  // Unique word ratio: at least 50%
  const uniqueRatio = stats.words > 0 ? stats.uniqueWords / stats.words : 0;
  checks.push({
    name: "Unique word ratio >= 50%",
    passed: uniqueRatio >= 0.5,
    hint: `Currently ${(uniqueRatio * 100).toFixed(0)}%`,
  });
  // Reading time >= 1 min
  checks.push({
    name: "Reading time >= 1 minute",
    passed: stats.readingTimeMinutes >= 1,
    hint: `Currently ${stats.readingTimeMinutes.toFixed(1)} min`,
  });
  const passed = checks.filter((c) => c.passed).length;
  const score = Math.round((passed / checks.length) * 100);
  let label = "Needs work";
  if (score >= 80) label = "Excellent";
  else if (score >= 60) label = "Good";
  else if (score >= 40) label = "Fair";
  return { score, label, checks };
}

export function analyze(text: string): AnalysisResult {
  return {
    stats: computeStats(text),
    topKeywords: computeTopKeywords(text),
    sentenceLengthBuckets: computeSentenceLengthBuckets(text),
    paragraphStats: computeParagraphStats(text),
    seoScore: computeSeoScore(text),
  };
}

/** Format minutes to "Xm Ys" form. */
export function formatReadingTime(minutes: number): string {
  if (!minutes || minutes <= 0) return "0s";
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

// ---- History ----

const HISTORY_KEY = "unqtools:content-word-count:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  wordCount: number;
  seoScore: number;
  snippet: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(text: string): string {
  const params = new URLSearchParams();
  params.set("text", text);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { text?: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const text = params.get("text");
  if (text === null) return {};
  return { text };
}
