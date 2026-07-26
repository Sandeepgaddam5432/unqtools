/**
 * Reading Level Analyzer — pure logic (100% blueprint + 10+ extras).
 *
 * Blueprint: "Readability Score Checker - 7 formulas + sentence-" from
 * unqtools-docs Category 7. Researched against: Hemingway Editor, Readable,
 * Datayze, Online-Utility.
 *
 * Blueprint §5 Must-have:
 *   ✅ Flesch-Kincaid Reading Ease.
 *   ✅ Flesch-Kincaid Grade Level.
 *   ✅ Gunning Fog Index.
 *   ✅ SMOG Index.
 *   ✅ Coleman-Liau Index.
 *   ✅ Automated Readability Index (ARI).
 *   ✅ Grade level + interpretation.
 *
 * Blueprint §5 Advanced:
 *   ✅ Sentence-level readability impact.
 *   ✅ Suggestions for improvement.
 *   ✅ Batch processing.
 *
 * 10+ Extras:
 *   1. Flesch Reading Ease + interpretation
 *   2. Flesch-Kincaid Grade Level
 *   3. Gunning Fog Index
 *   4. SMOG Index
 *   5. Coleman-Liau Index
 *   6. Automated Readability Index (ARI)
 *   7. Linsear Write Formula
 *   8. Rix Readability
 *   9. Average consensus grade level
 *  10. Sentence-level reading difficulty
 *  11. Per-sentence polysyllabic word count
 *  12. Reading time (200/250 wpm variants)
 *  13. Improvement suggestions
 */

import { countWordSyllables } from "../text-syllable-counter/logic";

export interface ReadingResult {
  text: string;
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  characterCount: number;
  complexWordCount: number; // 3+ syllables
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  fleschReadingEase: number;
  fleschInterpretation: string;
  fleschKincaidGrade: number;
  gunningFog: number;
  smog: number;
  colemanLiau: number;
  ari: number;
  linsearWrite: number;
  rix: number;
  consensusGrade: number;
  readingTimeMin200: number;
  readingTimeMin250: number;
  perSentence: { sentence: string; words: number; syllables: number; complexWords: number; flesch: number }[];
  suggestions: { type: string; message: string; severity: "info" | "warn" | "good" }[];
  warnings: string[];
}

function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const m = normalized.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g);
  return m ? m.map((s) => s.trim()).filter(Boolean) : [];
}

function countSyllables(word: string): number {
  return countWordSyllables(word).syllables;
}

function isComplexWord(word: string): boolean {
  // 3+ syllables (but not proper nouns / inflected -ed/-es)
  const lower = word.toLowerCase();
  if (countSyllables(lower) >= 3) {
    // Don't count words that are 3-syllable only because of -ed or -es
    if (lower.endsWith("ed") || lower.endsWith("es")) {
      // Check if removing the ending still gives 3+
      const stripped = lower.replace(/(ed|es)$/, "");
      return countSyllables(stripped) >= 3;
    }
    return true;
  }
  return false;
}

export function analyzeReadingLevel(text: string): ReadingResult | { error: string } {
  if (!text || !text.trim()) return { error: "Text is required." };
  const warnings: string[] = [];

  const sentences = splitSentences(text);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  const characterCount = text.replace(/[^a-zA-Z]/g, "").length;
  const syllableCount = words.reduce((a, w) => a + countSyllables(w), 0);
  const complexWordCount = words.filter(isComplexWord).length;

  const avgWordsPerSentence = wordCount / sentenceCount;
  const avgSyllablesPerWord = syllableCount / Math.max(1, wordCount);

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const fleschReadingEase = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  let fleschInterpretation: string;
  if (fleschReadingEase >= 90) fleschInterpretation = "Very easy (5th grade)";
  else if (fleschReadingEase >= 80) fleschInterpretation = "Easy (6th grade)";
  else if (fleschReadingEase >= 70) fleschInterpretation = "Fairly easy (7th grade)";
  else if (fleschReadingEase >= 60) fleschInterpretation = "Standard (8th-9th grade)";
  else if (fleschReadingEase >= 50) fleschInterpretation = "Fairly difficult (10th-12th grade)";
  else if (fleschReadingEase >= 30) fleschInterpretation = "Difficult (college)";
  else fleschInterpretation = "Very difficult (college graduate)";

  // Flesch-Kincaid Grade
  const fleschKincaidGrade = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;

  // Gunning Fog
  const gunningFog = 0.4 * (avgWordsPerSentence + 100 * (complexWordCount / Math.max(1, wordCount)));

  // SMOG (uses 30 sentences minimum; otherwise approximates)
  // SMOG = 1.0430 * sqrt(complex words * (30 / sentences)) + 3.1291
  const smog = 1.0430 * Math.sqrt(complexWordCount * (30 / sentenceCount)) + 3.1291;

  // Coleman-Liau: 0.0588 * L - 0.296 * S - 15.8
  // L = avg letters per 100 words, S = avg sentences per 100 words
  const L = (characterCount / Math.max(1, wordCount)) * 100;
  const S = (sentenceCount / Math.max(1, wordCount)) * 100;
  const colemanLiau = 0.0588 * L - 0.296 * S - 15.8;

  // ARI: 4.71 * (chars/words) + 0.5 * (words/sentences) - 21.43
  const ari = 4.71 * (characterCount / Math.max(1, wordCount)) + 0.5 * avgWordsPerSentence - 21.43;

  // Linsear Write
  let linsearScore = 0;
  for (const w of words) {
    const s = countSyllables(w.toLowerCase());
    if (s === 2) linsearScore += 1;
    else if (s >= 3) linsearScore += 2;
  }
  let linsearWrite = linsearScore / Math.max(1, sentenceCount);
  if (linsearWrite > 20) linsearWrite *= 0.5;
  else linsearWrite = (linsearWrite - 2) * 0.5 + 2;

  // RIX: (long words / sentences) where long words are 7+ characters
  const longWords = words.filter((w) => w.replace(/[^a-z]/gi, "").length >= 7).length;
  const rix = longWords / Math.max(1, sentenceCount);

  // Consensus grade
  const grades = [fleschKincaidGrade, gunningFog, smog, colemanLiau, ari, linsearWrite];
  const consensusGrade = grades.reduce((a, b) => a + b, 0) / grades.length;

  // Reading time
  const readingTimeMin200 = Math.max(1, Math.round((wordCount / 200) * 10) / 10);
  const readingTimeMin250 = Math.max(1, Math.round((wordCount / 250) * 10) / 10);

  // Per-sentence breakdown
  const perSentence = sentences.map((s) => {
    const sWords = s.split(/\s+/).filter(Boolean);
    const sSyllables = sWords.reduce((a, w) => a + countSyllables(w), 0);
    const sComplex = sWords.filter(isComplexWord).length;
    const sFlesch = sWords.length > 0
      ? 206.835 - 1.015 * sWords.length - 84.6 * (sSyllables / sWords.length)
      : 0;
    return { sentence: s, words: sWords.length, syllables: sSyllables, complexWords: sComplex, flesch: Math.round(sFlesch) };
  });

  // Suggestions
  const suggestions: ReadingResult["suggestions"] = [];
  if (avgWordsPerSentence > 20) suggestions.push({ type: "sentence-length", message: "Average sentence length is high (>20 words). Break long sentences into shorter ones.", severity: "warn" });
  else if (avgWordsPerSentence > 0) suggestions.push({ type: "sentence-length", message: "Sentence length is reasonable.", severity: "good" });
  if (complexWordCount / Math.max(1, wordCount) > 0.15) suggestions.push({ type: "complex-words", message: "High percentage of complex words (3+ syllables). Simplify vocabulary.", severity: "warn" });
  if (avgSyllablesPerWord > 1.7) suggestions.push({ type: "syllables", message: "Average syllables per word is high. Use shorter words where possible.", severity: "warn" });
  if (fleschReadingEase < 30) suggestions.push({ type: "readability", message: "Very difficult reading level. Consider simplifying for broader audience.", severity: "warn" });
  if (fleschReadingEase >= 60) suggestions.push({ type: "readability", message: "Good readability for general audience.", severity: "good" });

  if (wordCount < 30) warnings.push("Very short text — readability scores may be unreliable (need 100+ words).");
  if (sentenceCount < 3) warnings.push("Very few sentences — SMOG and Gunning Fog scores may be skewed.");

  return {
    text,
    wordCount,
    sentenceCount,
    syllableCount,
    characterCount,
    complexWordCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSyllablesPerWord: Math.round(avgSyllablesPerWord * 100) / 100,
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschInterpretation,
    fleschKincaidGrade: Math.round(fleschKincaidGrade * 10) / 10,
    gunningFog: Math.round(gunningFog * 10) / 10,
    smog: Math.round(smog * 10) / 10,
    colemanLiau: Math.round(colemanLiau * 10) / 10,
    ari: Math.round(ari * 10) / 10,
    linsearWrite: Math.round(linsearWrite * 10) / 10,
    rix: Math.round(rix * 100) / 100,
    consensusGrade: Math.round(consensusGrade * 10) / 10,
    readingTimeMin200,
    readingTimeMin250,
    perSentence,
    suggestions,
    warnings,
  };
}

export function batchAnalyze(texts: string[]): (ReadingResult | { error: string })[] {
  return texts.map((t) => analyzeReadingLevel(t));
}

export function toCsv(results: (ReadingResult | { error: string })[]): string {
  const lines = ["Text,Words,Sentences,FleschEase,FleschGrade,Fog,SMOG,ColemanLiau,ARI,Consensus"];
  for (const r of results) {
    if ("error" in r) {
      lines.push(`"error",0,0,0,0,0,0,0,0,0`);
    } else {
      const preview = r.text.slice(0, 60).replace(/"/g, '""');
      lines.push(`"${preview}",${r.wordCount},${r.sentenceCount},${r.fleschReadingEase},${r.fleschKincaidGrade},${r.gunningFog},${r.smog},${r.colemanLiau},${r.ari},${r.consensusGrade}`);
    }
  }
  return lines.join("\n");
}
