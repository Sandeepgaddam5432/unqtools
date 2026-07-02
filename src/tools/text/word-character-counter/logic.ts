/**
 * Word & Character Counter — pure logic. No DOM access; safe to run in a Worker.
 *
 * Public API:
 *   - countText(input): TextStats  — main entry point, returns all counts
 *   - segmentWords(input): string[]
 *   - segmentSentences(input): string[]
 *   - countSmsSegments(input): SmsInfo
 *   - computeReadingTime(words): { minutes: number; seconds: number }
 *   - computeSpeakingTime(words): { minutes: number; seconds: number }
 *   - getPlatformLimits(chars, words): PlatformLimit[]
 *
 * Uses Intl.Segmenter for Unicode-correct grapheme/word/sentence segmentation.
 * Falls back to a regex-based counter when Intl.Segmenter is unavailable
 * (older browsers), and clearly flags the result as approximate.
 *
 * GSM-7 charset table from the official 3GPP TS 23.038 spec.
 */

export interface TextStats {
  /** True grapheme count (Intl.Segmenter). Each emoji = 1, even ZWJ families. */
  graphemes: number;
  /** UTF-16 code units (the .length of the string). For devs. */
  codeUnits: number;
  /** UTF-8 byte count. For devs / byte-budgeted systems. */
  utf8Bytes: number;
  /** Code points (true Unicode scalar values). */
  codePoints: number;
  /** Whitespace count. */
  whitespace: number;
  /** Characters excluding whitespace. */
  charactersNoSpaces: number;
  /** Words, language-aware (Intl.Segmenter). */
  words: number;
  /** Sentences. */
  sentences: number;
  /** Paragraphs (text separated by one or more blank lines). */
  paragraphs: number;
  /** Lines (count of \n + 1, or 0 for empty input). */
  lines: number;
  /** Longest sentence length in words. */
  longestSentenceWords: number;
  /** Average sentence length in words. */
  avgSentenceWords: number;
  /** Approximate flag: true if Intl.Segmenter was unavailable. */
  approximate: boolean;
}

export interface SmsInfo {
  encoding: "GSM-7" | "UCS-2";
  segments: number;
  charsPerSegment: number;
  remainingInSegment: number;
}

export interface PlatformLimit {
  id: string;
  label: string;
  limit: number;
  unit: "characters" | "words";
  remaining: number;
  over: boolean;
}

export const WORKER_THRESHOLD_BYTES = 100 * 1024; // 100 KB

const GSM_7_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà".split(
    "",
  ),
);
// Extended GSM-7 chars (each counts as 2 in the 7-bit packed encoding)
const GSM_7_EXTENDED = new Set(["^", "{", "}", "\\", "[", "~", "]", "|", "€"]);

/** True if every char fits the GSM-7 basic or extended set. */
function isGsm7(input: string): boolean {
  for (const ch of input) {
    if (!GSM_7_BASIC.has(ch) && !GSM_7_EXTENDED.has(ch)) return false;
  }
  return true;
}

/**
 * Count SMS segments per 3GPP TS 23.038.
 *  - GSM-7: 160 chars first segment, 153 subsequent.
 *  - UCS-2: 70 chars first segment, 67 subsequent.
 *  - Extended GSM-7 chars cost 2 septets each, so we count "septet cost" not raw length.
 */
export function countSmsSegments(input: string): SmsInfo {
  if (!input) {
    return { encoding: "GSM-7", segments: 0, charsPerSegment: 160, remainingInSegment: 160 };
  }
  if (isGsm7(input)) {
    // Count septet cost (extended chars cost 2)
    let septets = 0;
    for (const ch of input) {
      septets += GSM_7_EXTENDED.has(ch) ? 2 : 1;
    }
    if (septets <= 160) {
      return {
        encoding: "GSM-7",
        segments: 1,
        charsPerSegment: 160,
        remainingInSegment: 160 - septets,
      };
    }
    const segments = Math.ceil(septets / 153);
    const usedInLast = septets - 153 * (segments - 1);
    return {
      encoding: "GSM-7",
      segments,
      charsPerSegment: 153,
      remainingInSegment: 153 - usedInLast,
    };
  }
  // UCS-2 (16-bit code units; surrogate pairs cost 2)
  const units = input.length;
  if (units <= 70) {
    return { encoding: "UCS-2", segments: 1, charsPerSegment: 70, remainingInSegment: 70 - units };
  }
  const segments = Math.ceil(units / 67);
  const usedInLast = units - 67 * (segments - 1);
  return { encoding: "UCS-2", segments, charsPerSegment: 67, remainingInSegment: 67 - usedInLast };
}

/** Words via Intl.Segmenter (language-aware), with regex fallback. */
export function segmentWords(input: string, locale = "en"): string[] {
  if (!input.trim()) return [];
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(locale, { granularity: "word" });
    return [...seg.segment(input)].filter((s) => s.isWordLike).map((s) => s.segment);
  }
  // Fallback: split on whitespace + punctuation boundaries
  return (input.match(/[\p{L}\p{N}']+/gu) ?? []) as string[];
}

/** Sentences via Intl.Segmenter, with regex fallback. */
export function segmentSentences(input: string, locale = "en"): string[] {
  if (!input.trim()) return [];
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(locale, { granularity: "sentence" });
    return [...seg.segment(input)].map((s) => s.segment.trim()).filter(Boolean);
  }
  return (input.match(/[^.!?]+[.!?]+/g) ?? [input]).map((s) => s.trim()).filter(Boolean);
}

/** Graphemes via Intl.Segmenter, with fallback to Array.from (code points). */
function countGraphemes(input: string, locale = "en"): number {
  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter(locale, { granularity: "grapheme" });
    return [...seg.segment(input)].length;
  }
  return Array.from(input).length;
}

/** UTF-8 byte length without TextEncoder when unavailable. */
function utf8ByteLength(input: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(input).length;
  }
  let bytes = 0;
  for (const ch of Array.from(input)) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes += 1;
    else if (cp < 0x800) bytes += 2;
    else if (cp < 0x10000) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

export function countText(input: string, locale = "en"): TextStats {
  if (!input) {
    return {
      graphemes: 0,
      codeUnits: 0,
      utf8Bytes: 0,
      codePoints: 0,
      whitespace: 0,
      charactersNoSpaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
      longestSentenceWords: 0,
      avgSentenceWords: 0,
      approximate: false,
    };
  }

  const Segmenter = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  const approximate = !Segmenter;

  const graphemes = countGraphemes(input, locale);
  const codeUnits = input.length;
  const utf8Bytes = utf8ByteLength(input);
  const codePoints = Array.from(input).length;
  const whitespace = (input.match(/\s/g) ?? []).length;
  const charactersNoSpaces = graphemes - whitespace;

  const wordsArr = segmentWords(input, locale);
  const words = wordsArr.length;

  const sentencesArr = segmentSentences(input, locale);
  const sentences = sentencesArr.length;
  const sentenceWordCounts = sentencesArr.map((s) => segmentWords(s, locale).length);
  const longestSentenceWords = sentenceWordCounts.length ? Math.max(...sentenceWordCounts) : 0;
  const avgSentenceWords = sentences ? Math.round((words / sentences) * 10) / 10 : 0;

  // Paragraphs: split on one or more blank lines
  const paragraphs = input
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;

  // Lines: count of \n + 1 (or 0 for empty)
  const lines = input === "" ? 0 : input.split("\n").length;

  return {
    graphemes,
    codeUnits,
    utf8Bytes,
    codePoints,
    whitespace,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    longestSentenceWords,
    avgSentenceWords,
    approximate,
  };
}

export function computeReadingTime(words: number, wpm = 225): { minutes: number; seconds: number } {
  const totalSeconds = Math.round((words / wpm) * 60);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

export function computeSpeakingTime(
  words: number,
  wpm = 130,
): { minutes: number; seconds: number } {
  const totalSeconds = Math.round((words / wpm) * 60);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
}

/** Platform limits — Twitter/X, SMS, meta description, title tag, OG description. */
export function getPlatformLimits(chars: number, _words: number): PlatformLimit[] {
  return [
    {
      id: "twitter",
      label: "X (Twitter)",
      limit: 280,
      unit: "characters",
      remaining: 280 - chars,
      over: chars > 280,
    },
    {
      id: "sms",
      label: "SMS (single)",
      limit: 160,
      unit: "characters",
      remaining: 160 - chars,
      over: chars > 160,
    },
    {
      id: "meta-desc",
      label: "Meta description",
      limit: 160,
      unit: "characters",
      remaining: 160 - chars,
      over: chars > 160,
    },
    {
      id: "title-tag",
      label: "Title tag",
      limit: 60,
      unit: "characters",
      remaining: 60 - chars,
      over: chars > 60,
    },
    {
      id: "og-desc",
      label: "OG description",
      limit: 200,
      unit: "characters",
      remaining: 200 - chars,
      over: chars > 200,
    },
    {
      id: "linkedin",
      label: "LinkedIn post",
      limit: 3000,
      unit: "characters",
      remaining: 3000 - chars,
      over: chars > 3000,
    },
    {
      id: "instagram",
      label: "Instagram caption",
      limit: 2200,
      unit: "characters",
      remaining: 2200 - chars,
      over: chars > 2200,
    },
    {
      id: "facebook",
      label: "Facebook post",
      limit: 63206,
      unit: "characters",
      remaining: 63206 - chars,
      over: chars > 63206,
    },
  ];
}

/** Top-N keyword frequency, excluding optional English stopwords. */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "need",
  "dare",
  "ought",
  "used",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
  "this",
  "that",
  "these",
  "those",
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "if",
  "because",
  "while",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "my",
  "your",
  "his",
  "her",
  "its",
  "our",
]);

export function keywordDensity(
  input: string,
  opts: { excludeStopwords?: boolean; topN?: number } = {},
): { word: string; count: number; density: number }[] {
  const { excludeStopwords = true, topN = 10 } = opts;
  const words = segmentWords(input).map((w) => w.toLowerCase());
  const counts = new Map<string, number>();
  for (const w of words) {
    if (excludeStopwords && STOPWORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const total = words.length || 1;
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count, density: Math.round((count / total) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, topN);
}
