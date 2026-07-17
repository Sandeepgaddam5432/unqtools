/**
 * Content Readability Analyzer — pure logic.
 *
 * Computes multiple readability formulas:
 *  - Flesch Reading Ease
 *  - Flesch-Kincaid Grade Level
 *  - Gunning Fog Index
 *  - SMOG Index
 *  - Coleman-Liau Index
 *  - Automated Readability Index (ARI)
 *  - (bonus) Reading Time estimate
 *
 * Pure functions only — no DOM, no network.
 */

export interface ReadabilityStats {
  words: number;
  sentences: number;
  syllables: number;
  characters: number;
  complexWords: number;       // 3+ syllables, not proper nouns
  polysyllabicWords: number;  // 3+ syllables (for SMOG)
  averageWordsPerSentence: number;
  averageSyllablesPerWord: number;
  averageCharactersPerWord: number;
  readingTimeMinutes: number;  // @ 200 WPM
  speakingTimeMinutes: number; // @ 130 WPM
  paragraphs: number;
  longestSentenceWords: number;
  passiveVoiceHits: number;
}

export interface ReadabilityScores {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  smog: number;
  colemanLiau: number;
  ari: number;
  averageGrade: number;
  consensusLevel: string;
}

export interface AnalysisResult {
  stats: ReadabilityStats;
  scores: ReadabilityScores;
  complexWordList: string[];
  longSentences: string[];
  passiveVoicePhrases: string[];
}

const READING_WPM = 200;
const SPEAKING_WPM = 130;
const COMPLEX_MIN_SYLLABLES = 3;

/** Count syllables in a single word using a heuristic. */
export function countSyllables(word: string): number {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Subtract silent 'e' at end (unless word ends in 'le' after consonant)
  let cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  cleaned = cleaned.replace(/^y/, "");
  const groups = cleaned.match(/[aeiouy]{1,2}/g);
  const count = groups ? groups.length : 0;
  return Math.max(1, count);
}

/** Tokenize a string into words (letters only, lowercased for matching). */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .match(/[a-z0-9']+/g) || [];
}

/** Split text into sentences using punctuation + capital-letter heuristics. */
export function splitSentences(text: string): string[] {
  if (!text || !text.trim()) return [];
  // Match sentence-ending punctuation followed by whitespace + capital/quote/end
  const sentences = text
    .replace(/\n+/g, " ")
    .match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g);
  if (!sentences) return [text.trim()].filter(Boolean);
  return sentences.map((s) => s.trim()).filter(Boolean);
}

/** Count paragraphs (blocks separated by one or more blank lines). */
export function countParagraphs(text: string): number {
  if (!text || !text.trim()) return 0;
  return text
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

/** Detect words ending in common passive voice indicators (was/were/been + -ed participle). */
export function detectPassiveVoicePhrases(text: string): string[] {
  if (!text) return [];
  const passivePatterns = [
    /\b(is|are|was|were|be|been|being)\s+\w+(ed|en)\b/gi,
    /\b(has|have|had)\s+been\s+\w+ed\b/gi,
    /\b(is|are|was|were)\s+being\s+\w+ed\b/gi,
  ];
  const found = new Set<string>();
  for (const re of passivePatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      found.add(m[0]);
    }
  }
  return Array.from(found);
}

/** Common short words that may have 3+ syllables by heuristic but are not "complex". */
const COMMON_3_SYLLABLE_EXCEPTIONS = new Set([
  "the", "and", "but", "for", "nor", "yet", "or", "so",
]);

/** Compute all stats needed by the readability formulas. */
export function computeStats(text: string): ReadabilityStats {
  if (!text || !text.trim()) {
    return {
      words: 0,
      sentences: 0,
      syllables: 0,
      characters: 0,
      complexWords: 0,
      polysyllabicWords: 0,
      averageWordsPerSentence: 0,
      averageSyllablesPerWord: 0,
      averageCharactersPerWord: 0,
      readingTimeMinutes: 0,
      speakingTimeMinutes: 0,
      paragraphs: 0,
      longestSentenceWords: 0,
      passiveVoiceHits: 0,
    };
  }

  const sentences = splitSentences(text);
  const words = tokenizeWords(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const characters = text.replace(/\s/g, "").length;

  let syllables = 0;
  let complexWords = 0;
  let polysyllabic = 0;
  const complexWordList: string[] = [];
  for (const w of words) {
    const syl = countSyllables(w);
    syllables += syl;
    if (syl >= COMPLEX_MIN_SYLLABLES && !COMMON_3_SYLLABLE_EXCEPTIONS.has(w)) {
      // For "complex words" in Gunning Fog, exclude proper nouns (capitalized in original)
      // and -es/-ed plurals. Since we lowercased, approximate by excluding words ending in -es/-ed
      if (!/(es|ed)$/i.test(w)) {
        complexWords++;
        complexWordList.push(w);
      }
    }
    if (syl >= COMPLEX_MIN_SYLLABLES) {
      polysyllabic++;
    }
  }

  const longestSentenceWords = sentences.reduce((max, s) => {
    const n = tokenizeWords(s).length;
    return n > max ? n : max;
  }, 0);

  const passiveHits = detectPassiveVoicePhrases(text);

  return {
    words: wordCount,
    sentences: sentenceCount,
    syllables,
    characters,
    complexWords,
    polysyllabicWords: polysyllabic,
    averageWordsPerSentence: wordCount / sentenceCount,
    averageSyllablesPerWord: wordCount > 0 ? syllables / wordCount : 0,
    averageCharactersPerWord: wordCount > 0 ? characters / wordCount : 0,
    readingTimeMinutes: wordCount / READING_WPM,
    speakingTimeMinutes: wordCount / SPEAKING_WPM,
    paragraphs: countParagraphs(text),
    longestSentenceWords,
    passiveVoiceHits: passiveHits.length,
  };
}

// ---- Formulas ----

/** Flesch Reading Ease — 0 (very hard) to 100 (very easy). */
export function fleschReadingEase(stats: ReadabilityStats): number {
  if (stats.words === 0) return 0;
  return 206.835 - 1.015 * stats.averageWordsPerSentence - 84.6 * stats.averageSyllablesPerWord;
}

/** Flesch-Kincaid Grade Level. */
export function fleschKincaidGrade(stats: ReadabilityStats): number {
  if (stats.words === 0) return 0;
  return 0.39 * stats.averageWordsPerSentence + 11.8 * stats.averageSyllablesPerWord - 15.59;
}

/** Gunning Fog Index. */
export function gunningFog(stats: ReadabilityStats): number {
  if (stats.words === 0) return 0;
  const pctComplex = (stats.complexWords / stats.words) * 100;
  return 0.4 * (stats.averageWordsPerSentence + pctComplex);
}

/** SMOG Index — uses polysyllabic words. */
export function smog(stats: ReadabilityStats): number {
  if (stats.sentences < 3) {
    // SMOG needs at least 3 sentences; use approximate
    if (stats.sentences === 0) return 0;
  }
  return 1.043 * Math.sqrt(stats.polysyllabicWords * (30 / Math.max(1, stats.sentences))) + 3.1291;
}

/** Coleman-Liau Index — based on characters per word, not syllables. */
export function colemanLiau(stats: ReadabilityStats): number {
  if (stats.words === 0) return 0;
  const L = (stats.characters / stats.words) * 100; // avg letters per 100 words
  const S = (stats.sentences / stats.words) * 100; // avg sentences per 100 words
  return 0.0588 * L - 0.296 * S - 15.8;
}

/** Automated Readability Index — uses characters per word. */
export function automatedReadability(stats: ReadabilityStats): number {
  if (stats.words === 0) return 0;
  const charsPerWord = stats.characters / stats.words;
  return 4.71 * charsPerWord + 0.5 * stats.averageWordsPerSentence - 21.43;
}

/** Map a Flesch Reading Ease score to a reading level label. */
export function fleschToLevel(score: number): string {
  if (score >= 90) return "Very Easy (5th grade)";
  if (score >= 80) return "Easy (6th grade)";
  if (score >= 70) return "Fairly Easy (7th grade)";
  if (score >= 60) return "Standard (8-9th grade)";
  if (score >= 50) return "Fairly Hard (10-12th grade)";
  if (score >= 30) return "Hard (College)";
  return "Very Hard (College Graduate)";
}

/** Map a grade-level number to a school label. */
export function gradeToLevel(grade: number): string {
  if (grade < 1) return "Kindergarten";
  if (grade < 6) return "Elementary School";
  if (grade < 9) return "Middle School";
  if (grade < 13) return "High School";
  if (grade < 16) return "College";
  return "College Graduate";
}

/** Compute all scores and a consensus reading level. */
export function computeScores(stats: ReadabilityStats): ReadabilityScores {
  const fre = fleschReadingEase(stats);
  const fkg = fleschKincaidGrade(stats);
  const gf = gunningFog(stats);
  const sm = smog(stats);
  const cl = colemanLiau(stats);
  const ari = automatedReadability(stats);
  const grades = [fkg, gf, sm, cl, ari].filter((g) => !isNaN(g) && isFinite(g));
  const avg = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
  return {
    fleschReadingEase: fre,
    fleschKincaidGrade: fkg,
    gunningFog: gf,
    smog: sm,
    colemanLiau: cl,
    ari,
    averageGrade: avg,
    consensusLevel: gradeToLevel(avg),
  };
}

/** Format a reading time in minutes to "Xm Ys" form. */
export function formatReadingTime(minutes: number): string {
  if (!minutes || minutes <= 0) return "0s";
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

/** Run the full analysis. */
export function analyze(text: string): AnalysisResult {
  const stats = computeStats(text);
  const scores = computeScores(stats);
  const sentences = splitSentences(text);
  const longSentences = sentences.filter((s) => tokenizeWords(s).length > 25);
  const passive = detectPassiveVoicePhrases(text);
  const complexWordList = Array.from(
    new Set(tokenizeWords(text).filter((w) => countSyllables(w) >= COMPLEX_MIN_SYLLABLES)),
  ).slice(0, 50);
  return {
    stats,
    scores,
    complexWordList,
    longSentences,
    passiveVoicePhrases: passive,
  };
}

// ---- History ----

const HISTORY_KEY = "unqtools:content-readability-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  wordCount: number;
  fleschScore: number;
  consensusLevel: string;
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
