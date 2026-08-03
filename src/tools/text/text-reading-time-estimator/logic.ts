/**
 * Reading Time Estimator — pure logic.
 *
 * Core blueprint:
 *   • Word count, character count, sentence count, paragraph count
 *   • Reading time (default 200 WPM)
 *   • Speaking time (default 130 WPM)
 *   • Slide count estimate (default 1 slide per 60 words)
 *
 * 10+ Extras (beyond the core):
 *   1. Custom WPM control (50-1000 range)
 *   2. Custom speaking WPM control
 *   3. Custom slide words-per-slide (default 60)
 *   4. Reading time formatted as "Xm Ys"
 *   5. Speaking time formatted as "Xm Ys"
 *   6. Estimated pages (300 words / page)
 *   7. Scan time (skimming estimate, 700 WPM)
 *   8. Reading level (Flesch reading ease + grade level)
 *   9. Polyglot mode — handles CJK characters (no spaces) properly
 *  10. Batch mode (multiple documents)
 *  11. Per-document warnings (too short, very long, unusual WPM, etc.)
 *  12. CSV / JSON export
 *  13. Cost-to-read (estimated minutes × hourly rate, optional)
 */

export interface ReadingTimeOptions {
  /** Reading words-per-minute. Default 200. */
  readingWpm?: number;
  /** Speaking words-per-minute. Default 130. */
  speakingWpm?: number;
  /** Words per slide for slide-count estimate. Default 60. */
  wordsPerSlide?: number;
  /** Words per page for page estimate. Default 300. */
  wordsPerPage?: number;
  /** Skimming WPM. Default 700. */
  scanningWpm?: number;
  /** Hourly rate (for cost-to-read). Optional. */
  hourlyRate?: number;
  /** Locale string for number formatting. Default "en-US". */
  locale?: string;
}

export interface ReadingTimeResult {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTimeSeconds: number;
  speakingTimeSeconds: number;
  scanningTimeSeconds: number;
  readingTimeFormatted: string;
  speakingTimeFormatted: string;
  scanningTimeFormatted: string;
  slides: number;
  pages: number;
  /** Flesch Reading Ease score (0-100, higher = easier). */
  readingEase: number;
  /** Flesch-Kincaid grade level. */
  gradeLevel: number;
  readingEaseLabel: string;
  costToRead?: number;
  warnings: string[];
}

export interface BatchReadingResult {
  results: ReadingTimeResult[];
  totals: ReadingTimeResult;
  warnings: string[];
}

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/** Tokenize text into words (Unicode-aware, handles CJK characters (no spaces) properly). */
export function tokenizeWords(text: string): string[] {
  if (!text) return [];
  // Strip CJK characters so they are NOT consumed by the Latin regex below.
  const cjkChars = text.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu) ?? [];
  const textWithoutCjk = text.replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/gu, " ");
  // Latin/Cyrillic/Arabic/etc. word tokens (now CJK-free)
  const latin = textWithoutCjk.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  return [...latin, ...cjkChars];
}

/** Count sentences by splitting on .!? terminators. */
export function countSentences(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[^.!?]+[.!?]+/g);
  if (matches) return matches.length;
  return text.trim().length > 0 ? 1 : 0;
}

/** Count paragraphs (split by 2+ newlines or single newlines). */
export function countParagraphs(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // Split by one or more newlines and count non-empty chunks
  const paras = trimmed.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  if (paras.length > 0) return paras.length;
  // Fall back to single-newline split
  const lines = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length || 1;
}

/** Count syllables in a word (rough heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip silent 'e' at the end (rough heuristic)
  let s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  s = s.replace(/^y/, "");
  const groups = s.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

/** Format seconds as "Xm Ys" or "Xh Ym". */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0 || !isFinite(totalSeconds)) return "0s";
  const total = Math.round(totalSeconds);
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes < 60) {
    return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

/** Compute Flesch Reading Ease. */
export function fleschReadingEase(words: string[], sentences: number): number {
  if (words.length === 0 || sentences === 0) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordsPerSentence = words.length / sentences;
  const syllablesPerWord = totalSyllables / words.length;
  return 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
}

/** Compute Flesch-Kincaid grade level. */
export function fleschKincaidGrade(words: string[], sentences: number): number {
  if (words.length === 0 || sentences === 0) return 0;
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordsPerSentence = words.length / sentences;
  const syllablesPerWord = totalSyllables / words.length;
  return 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
}

/** Label for Flesch Reading Ease score. */
export function readingEaseLabel(score: number): string {
  if (score >= 90) return "Very easy (5th grade)";
  if (score >= 80) return "Easy (6th grade)";
  if (score >= 70) return "Fairly easy (7th grade)";
  if (score >= 60) return "Standard (8th–9th grade)";
  if (score >= 50) return "Fairly difficult (10th–12th grade)";
  if (score >= 30) return "Difficult (College)";
  return "Very difficult (College graduate)";
}

/** Estimate reading time for a document. */
export function estimateReadingTime(text: string, options: ReadingTimeOptions = {}): ReadingTimeResult | { error: string } {
  const src = text ?? "";
  if (!src.trim()) return { error: "Input text is empty." };

  const readingWpm = clamp(options.readingWpm ?? 200, 50, 1000);
  const speakingWpm = clamp(options.speakingWpm ?? 130, 50, 500);
  const wordsPerSlide = clamp(options.wordsPerSlide ?? 60, 10, 1000);
  const wordsPerPage = clamp(options.wordsPerPage ?? 300, 50, 2000);
  const scanningWpm = clamp(options.scanningWpm ?? 700, 100, 2000);
  const hourlyRate = options.hourlyRate;
  const locale = options.locale ?? "en-US";

  const warnings: string[] = [];
  if (readingWpm < 100) warnings.push(`Reading WPM ${readingWpm} is below average (most adults read 200-250 WPM).`);
  if (readingWpm > 400) warnings.push(`Reading WPM ${readingWpm} is unusually high (typical max ~300-400 for skimming).`);
  if (speakingWpm < 100) warnings.push(`Speaking WPM ${speakingWpm} is below average (typical 130-150 WPM).`);

  const words = tokenizeWords(src);
  const wordCount = words.length;
  const characters = src.length;
  const charactersNoSpaces = src.replace(/\s/g, "").length;
  const sentences = countSentences(src);
  const paragraphs = countParagraphs(src);

  if (wordCount < 10) warnings.push(`Only ${wordCount} words detected — estimates may be unreliable.`);
  if (wordCount > 5000) warnings.push(`Long text (${wordCount} words) — estimate assumes sustained reading speed.`);

  const readingTimeSeconds = (wordCount / readingWpm) * 60;
  const speakingTimeSeconds = (wordCount / speakingWpm) * 60;
  const scanningTimeSeconds = (wordCount / scanningWpm) * 60;

  const slides = Math.max(1, Math.ceil(wordCount / wordsPerSlide));
  const pages = Math.max(1, Math.ceil(wordCount / wordsPerPage));

  const readingEase = fleschReadingEase(words, Math.max(1, sentences));
  const gradeLevel = fleschKincaidGrade(words, Math.max(1, sentences));
  const easeLabel = readingEaseLabel(readingEase);

  let costToRead: number | undefined;
  if (hourlyRate !== undefined && hourlyRate > 0) {
    costToRead = (readingTimeSeconds / 3600) * hourlyRate;
  }

  return {
    words: wordCount,
    characters,
    charactersNoSpaces,
    sentences,
    paragraphs,
    readingTimeSeconds,
    speakingTimeSeconds,
    scanningTimeSeconds,
    readingTimeFormatted: formatDuration(readingTimeSeconds),
    speakingTimeFormatted: formatDuration(speakingWpm === 0 ? 0 : speakingTimeSeconds),
    scanningTimeFormatted: formatDuration(scanningTimeSeconds),
    slides,
    pages,
    readingEase,
    gradeLevel,
    readingEaseLabel: easeLabel,
    costToRead,
    warnings,
  };
}

/** Estimate reading time for multiple documents. Returns per-doc + totals. */
export function estimateReadingTimeBatch(docs: string[], options: ReadingTimeOptions = {}): BatchReadingResult {
  const results: ReadingTimeResult[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < docs.length; i++) {
    const r = estimateReadingTime(docs[i] ?? "", options);
    if ("error" in r) {
      warnings.push(`Doc ${i + 1}: ${r.error}`);
      continue;
    }
    results.push(r);
  }

  // Build totals as a synthetic ReadingTimeResult.
  const totals: ReadingTimeResult = {
    words: results.reduce((s, r) => s + r.words, 0),
    characters: results.reduce((s, r) => s + r.characters, 0),
    charactersNoSpaces: results.reduce((s, r) => s + r.charactersNoSpaces, 0),
    sentences: results.reduce((s, r) => s + r.sentences, 0),
    paragraphs: results.reduce((s, r) => s + r.paragraphs, 0),
    readingTimeSeconds: results.reduce((s, r) => s + r.readingTimeSeconds, 0),
    speakingTimeSeconds: results.reduce((s, r) => s + r.speakingTimeSeconds, 0),
    scanningTimeSeconds: results.reduce((s, r) => s + r.scanningTimeSeconds, 0),
    readingTimeFormatted: "",
    speakingTimeFormatted: "",
    scanningTimeFormatted: "",
    slides: results.reduce((s, r) => s + r.slides, 0),
    pages: results.reduce((s, r) => s + r.pages, 0),
    readingEase: 0,
    gradeLevel: 0,
    readingEaseLabel: "Aggregate (no single score)",
    costToRead: results.reduce((s, r) => s + (r.costToRead ?? 0), 0) || undefined,
    warnings: [],
  };
  totals.readingTimeFormatted = formatDuration(totals.readingTimeSeconds);
  totals.speakingTimeFormatted = formatDuration(totals.speakingTimeSeconds);
  totals.scanningTimeFormatted = formatDuration(totals.scanningTimeSeconds);

  return { results, totals, warnings };
}

function clamp(v: number, min: number, max: number): number {
  if (!isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/** Convert a single result to CSV. */
export function toCsv(r: ReadingTimeResult): string {
  const header = "Metric,Value";
  const rows = [
    `Words,${r.words}`,
    `Characters,${r.characters}`,
    `CharactersNoSpaces,${r.charactersNoSpaces}`,
    `Sentences,${r.sentences}`,
    `Paragraphs,${r.paragraphs}`,
    `ReadingTimeSeconds,${r.readingTimeSeconds.toFixed(2)}`,
    `ReadingTimeFormatted,${r.readingTimeFormatted}`,
    `SpeakingTimeSeconds,${r.speakingTimeSeconds.toFixed(2)}`,
    `SpeakingTimeFormatted,${r.speakingTimeFormatted}`,
    `ScanningTimeSeconds,${r.scanningTimeSeconds.toFixed(2)}`,
    `Slides,${r.slides}`,
    `Pages,${r.pages}`,
    `ReadingEase,${r.readingEase.toFixed(2)}`,
    `GradeLevel,${r.gradeLevel.toFixed(2)}`,
    `ReadingEaseLabel,${r.readingEaseLabel}`,
    r.costToRead !== undefined ? `CostToRead,${r.costToRead.toFixed(2)}` : `CostToRead,`,
  ];
  return [header, ...rows].join("\n");
}

/** Convert a single result to JSON. */
export function toJson(r: ReadingTimeResult): string {
  return JSON.stringify({
    words: r.words,
    characters: r.characters,
    charactersNoSpaces: r.charactersNoSpaces,
    sentences: r.sentences,
    paragraphs: r.paragraphs,
    readingTimeSeconds: Number(r.readingTimeSeconds.toFixed(2)),
    readingTimeFormatted: r.readingTimeFormatted,
    speakingTimeSeconds: Number(r.speakingTimeSeconds.toFixed(2)),
    speakingTimeFormatted: r.speakingTimeFormatted,
    scanningTimeSeconds: Number(r.scanningTimeSeconds.toFixed(2)),
    scanningTimeFormatted: r.scanningTimeFormatted,
    slides: r.slides,
    pages: r.pages,
    readingEase: Number(r.readingEase.toFixed(2)),
    gradeLevel: Number(r.gradeLevel.toFixed(2)),
    readingEaseLabel: r.readingEaseLabel,
    costToRead: r.costToRead,
    warnings: r.warnings,
  }, null, 2);
}

/** Sample text for the demo. */
export function sampleText(): string {
  return `The quick brown fox jumps over the lazy dog. This sentence is short. Here is another sentence that is a bit longer than the previous one, just to add some variety to the document.

Reading time estimation is a useful feature for blogs, articles, and documentation. It helps readers decide whether they have time to engage with the content. Most tools assume an average reading speed of two hundred words per minute.

Speaking time is slower than reading time. A typical presenter speaks at about one hundred thirty words per minute. Slides should contain around sixty words each, so a ten minute talk needs about fifteen slides.`;
}


// ============================================================================
// 100x features — added while preserving all existing exports.
// ============================================================================

export const READING_SPEEDS: ReadonlyArray<{ label: string; wpm: number; description: string }> = [
  { label: "Skimming", wpm: 700, description: "Quick scanning for key points" },
  { label: "Fast reader", wpm: 400, description: "Experienced reader, familiar topic" },
  { label: "Average adult", wpm: 250, description: "Typical adult reading speed" },
  { label: "Slow reader", wpm: 150, description: "Reading carefully or unfamiliar topic" },
  { label: "Reading aloud", wpm: 130, description: "Speaking pace" },
  { label: "Lecture pace", wpm: 100, description: "Presentation/lecture delivery" },
];

export function estimateAllReadingTimes(text: string): Array<{ label: string; wpm: number; minutes: number; formatted: string }> {
  const words = text.split(/\s+/).filter(Boolean).length;
  return READING_SPEEDS.map((speed) => {
    const minutes = words / speed.wpm;
    return { label: speed.label, wpm: speed.wpm, minutes: Math.round(minutes * 100) / 100, formatted: formatDuration(minutes * 60 * 1000) };
  });
}

export function estimateWithDifficulty(text: string, baseWpm: number = 250, options: { difficultyFactor?: number; familiarityFactor?: number; fatigueFactor?: number } = {}): { minutes: number; words: number; adjustedWpm: number; factors: { difficulty: number; familiarity: number; fatigue: number } } {
  const { difficultyFactor = 1, familiarityFactor = 1, fatigueFactor = 1 } = options;
  const words = text.split(/\s+/).filter(Boolean).length;
  const avgWordLength = words > 0 ? text.replace(/\s/g, "").length / words : 5;
  const autoDifficulty = avgWordLength > 7 ? 1.3 : avgWordLength > 6 ? 1.15 : 1;
  const effectiveDifficulty = difficultyFactor * autoDifficulty;
  const adjustedWpm = Math.round(baseWpm / (effectiveDifficulty * familiarityFactor * fatigueFactor));
  const minutes = words / Math.max(1, adjustedWpm);
  return { minutes: Math.round(minutes * 100) / 100, words, adjustedWpm, factors: { difficulty: effectiveDifficulty, familiarity: familiarityFactor, fatigue: fatigueFactor } };
}

export function readingTimeBySection(sections: Array<{ title: string; text: string }>, wpm: number = 250): Array<{ title: string; words: number; minutes: number; formatted: string }> {
  return sections.map((section) => {
    const words = section.text.split(/\s+/).filter(Boolean).length;
    const minutes = words / wpm;
    return { title: section.title, words, minutes: Math.round(minutes * 100) / 100, formatted: formatDuration(minutes * 60 * 1000) };
  });
}

export function formatDurationDetailed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)} seconds`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes} min ${remainingSeconds} sec` : `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hours`;
}

export interface ValidationReport { level: "pass" | "warn" | "fail"; code: string; message: string; }

export function validateReadingTimeInput(text: string): ValidationReport[] {
  const reports: ValidationReport[] = [];
  if (!text || text.trim().length === 0) { reports.push({ level: "fail", code: "EMPTY", message: "Input text is empty." }); return reports; }
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words < 10) reports.push({ level: "warn", code: "VERY_SHORT", message: `Only ${words} words — reading time estimate may be unreliable.` });
  else reports.push({ level: "pass", code: "VALID", message: `${words} words — sufficient for reading time estimation.` });
  return reports;
}

export interface Receipt { tool: string; version: string; timestamp: string; inputFingerprint: string; }

export function buildReceipt(text: string): Receipt {
  const s = text.length + ":" + (text.charCodeAt(0) ?? 0);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return { tool: "text-reading-time-estimator", version: "100x.1.0", timestamp: new Date().toISOString(), inputFingerprint: (h >>> 0).toString(16).padStart(8, "0") };
}

export const REFERENCES: ReadonlyArray<{ id: string; citation: string; summary: string }> = [
  { id: "Brysbaert-2019", citation: "Brysbaert, M. (2019)", summary: "How many words do we read per minute? A review and meta-analysis." },
  { id: "Rayner-1998", citation: "Rayner, K. (1998)", summary: "Eye movements in reading and information processing." },
];
