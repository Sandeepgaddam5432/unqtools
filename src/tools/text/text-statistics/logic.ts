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
