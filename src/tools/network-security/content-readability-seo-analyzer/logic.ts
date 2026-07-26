/**
 * Content Readability & SEO Score Analyzer — pure logic.
 */

export interface AnalysisResult {
  wordCount: number;
  charCount: number;
  charCountNoSpaces: number;
  sentenceCount: number;
  paragraphCount: number;
  readingTimeMinutes: number;
  speakingTimeMinutes: number;
  avgWordsPerSentence: number;
  avgCharsPerWord: number;
  uniqueWords: number;
  topWords: { word: string; count: number }[];
  warnings: string[];
}

const STOPWORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "is", "was", "are", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "may", "might", "must", "can", "this", "that", "these", "those", "i", "you", "he", "she", "it", "we", "they", "them", "their", "what", "which", "who", "when", "where", "why", "how", "all", "each", "every", "both", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "just", "also"]);

export function analyze(text: string): AnalysisResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      wordCount: 0, charCount: 0, charCountNoSpaces: 0, sentenceCount: 0,
      paragraphCount: 0, readingTimeMinutes: 0, speakingTimeMinutes: 0,
      avgWordsPerSentence: 0, avgCharsPerWord: 0, uniqueWords: 0,
      topWords: [], warnings: ["Empty input"],
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = text.length;
  const charCountNoSpaces = text.replace(/\s/g, "").length;
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const paragraphCount = paragraphs.length || 1;

  const readingTimeMinutes = wordCount / 225;
  const speakingTimeMinutes = wordCount / 130;

  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const avgCharsPerWord = wordCount > 0 ? charCountNoSpaces / wordCount : 0;

  const wordFreq = new Map<string, number>();
  for (const word of words) {
    const lower = word.toLowerCase().replace(/[^a-z0-9']/g, "");
    if (!lower || STOPWORDS.has(lower) || lower.length < 2) continue;
    wordFreq.set(lower, (wordFreq.get(lower) || 0) + 1);
  }
  const uniqueWords = wordFreq.size;
  const topWords = Array.from(wordFreq.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const warnings: string[] = [];
  if (avgWordsPerSentence > 25) warnings.push("Average sentence length is high — consider breaking up long sentences");
  if (avgWordsPerSentence < 8) warnings.push("Average sentence length is low — sentences may feel choppy");
  if (paragraphCount === 1 && wordCount > 200) warnings.push("Single long paragraph — consider splitting for readability");

  return {
    wordCount, charCount, charCountNoSpaces, sentenceCount, paragraphCount,
    readingTimeMinutes, speakingTimeMinutes, avgWordsPerSentence, avgCharsPerWord,
    uniqueWords, topWords, warnings,
  };
}

export function analyzeBulk(texts: string[]): AnalysisResult[] {
  return texts.map((t) => analyze(t));
}

export function compareTexts(a: string, b: string): {
  overlap: number;
  aUnique: number;
  bUnique: number;
  sharedWords: string[];
} {
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/[^a-z0-9']/g, "")).filter(Boolean));
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(Boolean).map((w) => w.replace(/[^a-z0-9']/g, "")).filter(Boolean));
  const shared = Array.from(aWords).filter((w) => bWords.has(w));
  const union = new Set([...aWords, ...bWords]).size;
  const overlap = union > 0 ? shared.length / union : 0;
  return {
    overlap,
    aUnique: aWords.size - shared.length,
    bUnique: bWords.size - shared.length,
    sharedWords: shared,
  };
}

export function formatTime(minutes: number): string {
  if (minutes < 1) return `${Math.ceil(minutes * 60)} sec`;
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  return `${h} hr ${m} min`;
}

export function exportReport(result: AnalysisResult, format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify(result, null, 2);
  const rows = [
    ["Metric", "Value"],
    ["Word count", String(result.wordCount)],
    ["Character count", String(result.charCount)],
    ["Characters (no spaces)", String(result.charCountNoSpaces)],
    ["Sentence count", String(result.sentenceCount)],
    ["Paragraph count", String(result.paragraphCount)],
    ["Reading time", formatTime(result.readingTimeMinutes)],
    ["Speaking time", formatTime(result.speakingTimeMinutes)],
    ["Avg words/sentence", result.avgWordsPerSentence.toFixed(1)],
    ["Avg chars/word", result.avgCharsPerWord.toFixed(1)],
    ["Unique words", String(result.uniqueWords)],
  ];
  return rows.map((r) => r.join(",")).join("\n");
}
