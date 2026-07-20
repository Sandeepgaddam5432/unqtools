/**
 * AI Study Guide Generator — pure logic.
 *
 * Transform raw notes/textbook content into a structured study guide
 * using on-device extractive summarization and key-term extraction.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx.
 */

// ---------- Types ----------

export type GuideFormat = "outline" | "qa" | "summary" | "flashcard";
export type ReadingLevel = "elementary" | "middle" | "high" | "college";
export type Depth = "quick" | "standard" | "comprehensive";

export interface KeyTerm {
  term: string;
  definition: string;
  score: number;
  occurrences: number;
}

export interface Sentence {
  text: string;
  index: number;
  score: number;
  wordCount: number;
}

export interface Section {
  heading: string;
  sentences: string[];
}

export interface QuestionAnswer {
  id: string;
  type: "mcq" | "short-answer";
  question: string;
  answer: string;
  choices?: string[]; // for MCQ
  correctIndex?: number; // for MCQ
  sourceSentence?: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface StudyGuide {
  format: GuideFormat;
  readingLevel: ReadingLevel;
  depth: Depth;
  topic: string;
  overview: string;
  learningObjectives: string[];
  keyTerms: KeyTerm[];
  sections: Section[];
  summary: string[];
  questions: QuestionAnswer[];
  flashcards: Flashcard[];
  meta: {
    inputWordCount: number;
    outputWordCount: number;
    compressionRatio: number;
    sentenceCount: number;
    termCount: number;
    questionCount: number;
    flashcardCount: number;
  };
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-study-guide:history";
export const FAVES_KEY = "unqtools:ai-study-guide:faves";
export const HISTORY_MAX = 20;
export const FAVES_MAX = 50;

export const FORMAT_LABELS: Record<GuideFormat, string> = {
  outline: "Outline",
  qa: "Q&A",
  summary: "Summary sheet",
  flashcard: "Flashcards",
};

export const READING_LEVEL_LABELS: Record<ReadingLevel, string> = {
  elementary: "Elementary",
  middle: "Middle school",
  high: "High school",
  college: "College",
};

export const DEPTH_LABELS: Record<Depth, string> = {
  quick: "Quick (3 sentences/section, 5 questions)",
  standard: "Standard (5 sentences/section, 10 questions)",
  comprehensive: "Comprehensive (8 sentences/section, 15 questions)",
};

export const TOPIC_PRESETS: string[] = [
  "photosynthesis", "world war 2", "fractions", "shakespeare",
  "human digestion", "supply and demand", "the water cycle",
  "french revolution", "python loops", "atomic structure",
  "US constitution", "cell biology",
];

// Depth → sentences per section + question count
export const DEPTH_CONFIG: Record<Depth, { sentencesPerSection: number; questionCount: number; summarySentences: number }> = {
  quick: { sentencesPerSection: 3, questionCount: 5, summarySentences: 3 },
  standard: { sentencesPerSection: 5, questionCount: 10, summarySentences: 5 },
  comprehensive: { sentencesPerSection: 8, questionCount: 15, summarySentences: 8 },
};

// Reading level → max sentence length (in words) retained at full score
export const READING_LEVEL_MAX_SENTENCE_WORDS: Record<ReadingLevel, number> = {
  elementary: 15,
  middle: 20,
  high: 28,
  college: 40,
};

// Stopwords for TF-style scoring (compact list).
export const STOPWORDS: Set<string> = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "for",
  "of", "to", "in", "on", "at", "by", "with", "from", "as", "is",
  "are", "was", "were", "be", "been", "being", "this", "that", "these",
  "those", "it", "its", "they", "them", "their", "there", "here", "we",
  "us", "our", "you", "your", "i", "me", "my", "he", "she", "him", "her",
  "his", "hers", "not", "no", "yes", "do", "does", "did", "done", "have",
  "has", "had", "will", "would", "can", "could", "should", "may", "might",
  "must", "shall", "than", "so", "such", "very", "more", "most", "many",
  "much", "some", "any", "all", "each", "every", "both", "few", "other",
  "into", "out", "up", "down", "over", "under", "again", "further", "once",
  "about", "above", "below", "between", "through", "during", "before",
  "after", "above", "below", "off", "just", "also", "only", "own", "same",
]);

// ---------- Helpers ----------

/** Clean a topic string. */
export function clean(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Tokenize text into lowercased word tokens (no punctuation). */
export function tokenize(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Tokenize, dropping stopwords. */
export function tokenizeContent(text: string): string[] {
  return tokenize(text).filter((t) => !STOPWORDS.has(t) && t.length > 2);
}

/** Split text into sentences. */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  // Normalize whitespace, then split on . ! ? followed by whitespace/end.
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}

/** Count words in a string. */
export function countWords(s: string): number {
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

/** Capitalize first letter. */
function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Stable id. */
function id(prefix: string, i: number): string {
  return `${prefix}-${i}`;
}

/** Quick string hash. */
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return h;
}

// ---------- Term Frequency scoring ----------

/** Compute term-frequency map over content tokens. */
export function computeTermFrequencies(text: string): Map<string, number> {
  const tokens = tokenizeContent(text);
  const freq = new Map<string, number>();
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  return freq;
}

/** Score sentences by summed TF of their content words, normalised by length. */
export function scoreSentences(
  sentences: string[],
  freq: Map<string, number>,
  readingLevel: ReadingLevel,
): Sentence[] {
  const maxLen = READING_LEVEL_MAX_SENTENCE_WORDS[readingLevel];
  const out: Sentence[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const text = sentences[i];
    const tokens = tokenizeContent(text);
    const wc = countWords(text);
    if (wc < 4) continue; // skip too-short fragments
    let score = 0;
    for (const t of tokens) score += freq.get(t) ?? 0;
    // Normalize by square root of word count (avoid long-sentence bias).
    const normalized = score / Math.sqrt(Math.max(1, tokens.length));
    // Penalty for sentences exceeding reading-level length.
    const lengthPenalty = wc > maxLen ? 0.6 : 1.0;
    out.push({
      text,
      index: i,
      score: normalized * lengthPenalty,
      wordCount: wc,
    });
  }
  return out;
}

// ---------- Key term extraction ----------

/**
 * Extract key terms from text. A "term" is a single word or a bigram
 * that appears 2+ times and has high TF relative to its length.
 */
export function extractKeyTerms(text: string, max = 15): KeyTerm[] {
  const tokens = tokenizeContent(text);
  if (tokens.length === 0) return [];
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  // Bigram frequencies
  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const b = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(b, (bigrams.get(b) ?? 0) + 1);
  }

  const totalTokens = tokens.length;
  const candidates: KeyTerm[] = [];

  // Unigram terms: appear 2+ times, score = freq * log(1 + length)
  for (const [term, count] of freq.entries()) {
    if (count < 2) continue;
    const score = count * Math.log(1 + term.length) * (1 + count / totalTokens);
    candidates.push({
      term,
      definition: extractDefinition(term, text),
      score,
      occurrences: count,
    });
  }

  // Bigram terms: appear 2+ times, score boost
  for (const [term, count] of bigrams.entries()) {
    if (count < 2) continue;
    const score = count * Math.log(1 + term.length) * 1.5 * (1 + count / totalTokens);
    candidates.push({
      term,
      definition: extractDefinition(term, text),
      score,
      occurrences: count,
    });
  }

  // Sort by score, dedupe (prefer bigrams over their unigram parts).
  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: KeyTerm[] = [];
  for (const c of candidates) {
    const parts = c.term.split(" ");
    const conflict = parts.some((p) => seen.has(p));
    if (conflict && c.occurrences < 3) continue;
    seen.add(c.term);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** Best-effort: extract a definition for a term by finding "term is/are/refers to …" patterns. */
export function extractDefinition(term: string, text: string): string {
  if (!term) return "(no term provided — see source for context)";
  if (!text) return `(appears in source 0 times — see source for full context)`;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Try patterns: "term is X", "term are X", "term refers to X", "term: X", "term — X"
  const patterns = [
    new RegExp(`${escaped}\\s+(?:is|are|was|were)\\s+([^.!?]{5,120}[.!?]?)`, "i"),
    new RegExp(`${escaped}\\s+refers?\\s+to\\s+([^.!?]{5,120}[.!?]?)`, "i"),
    new RegExp(`${escaped}\\s*[:\\-–—]\\s*([^.!?]{5,120}[.!?]?)`, "i"),
    new RegExp(`(?:define|definition of)\\s+${escaped}\\s*[:\\-–—]?\\s*([^.!?]{5,120}[.!?]?)`, "i"),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      return capitalize(m[1].trim());
    }
  }
  // Fallback: first sentence containing the term, trimmed.
  const sentences = splitSentences(text);
  for (const s of sentences) {
    if (new RegExp(`\\b${escaped}\\b`, "i").test(s)) {
      return s.trim();
    }
  }
  return `(appears in source — see source for full context)`;
}

// ---------- Section splitting ----------

/** Group sentences into sections by paragraph breaks (blank line) or every N sentences. */
export function splitSections(text: string, maxPerSection = 4): Section[] {
  if (!text || !text.trim()) return [];
  // Try paragraph split first
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const sections: Section[] = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const sentences = splitSentences(paragraphs[i]);
    if (sentences.length === 0) continue;
    // If paragraph has >maxPerSection sentences, chunk it.
    for (let j = 0; j < sentences.length; j += maxPerSection) {
      const chunk = sentences.slice(j, j + maxPerSection);
      sections.push({
        heading: `Section ${sections.length + 1}`,
        sentences: chunk,
      });
    }
  }
  // Fallback: if no paragraphs, split all sentences into chunks.
  if (sections.length === 0) {
    const all = splitSentences(text);
    for (let i = 0; i < all.length; i += maxPerSection) {
      sections.push({
        heading: `Section ${sections.length + 1}`,
        sentences: all.slice(i, i + maxPerSection),
      });
    }
  }
  return sections;
}

// ---------- Summarization ----------

/**
 * Extractive summary: pick the top N highest-scoring sentences,
 * returned in original order.
 */
export function summarize(
  text: string,
  n: number,
  readingLevel: ReadingLevel,
): string[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return [];
  const freq = computeTermFrequencies(text);
  const scored = scoreSentences(sentences, freq, readingLevel);
  // Pick top N, preserve original order
  const top = [...scored].sort((a, b) => b.score - a.score).slice(0, n);
  top.sort((a, b) => a.index - b.index);
  return top.map((s) => s.text);
}

// ---------- Q&A generation ----------

/**
 * Generate Q&A pairs from the source text. Mix of MCQ (key-term based)
 * and short-answer (sentence-comprehension) questions.
 */
export function generateQuestions(
  text: string,
  terms: KeyTerm[],
  count: number,
): QuestionAnswer[] {
  const out: QuestionAnswer[] = [];
  const sentences = splitSentences(text);
  const half = Math.ceil(count / 2);
  // Half: MCQ from key terms
  const termSlice = terms.slice(0, half);
  for (let i = 0; i < termSlice.length && out.length < half; i++) {
    const t = termSlice[i];
    const q: QuestionAnswer = {
      id: id("mcq", i),
      type: "mcq",
      question: `Which term best matches this definition? "${truncate(t.definition, 100)}"`,
      answer: t.term,
      choices: buildMcqChoices(t.term, terms),
      correctIndex: 0,
      sourceSentence: t.definition,
    };
    // Shuffle choices deterministically
    const shuffled = shuffleChoices(q.choices ?? [], q.answer);
    q.choices = shuffled.choices;
    q.correctIndex = shuffled.correctIndex;
    out.push(q);
  }
  // Other half: short-answer from top sentences
  const topSentences = [...sentences]
    .sort((a, b) => countWords(b) - countWords(a))
    .slice(0, count - out.length + 5);
  let qi = 0;
  for (const s of topSentences) {
    if (out.length >= count) break;
    const q = buildShortAnswerQuestion(s, qi);
    if (q) out.push(q);
    qi++;
  }
  return out.slice(0, count);
}

function buildMcqChoices(correct: string, terms: KeyTerm[]): string[] {
  const distractors = terms
    .filter((t) => t.term !== correct)
    .map((t) => t.term)
    .slice(0, 3);
  // Pad with generic distractors if not enough terms
  const genericPool = ["the main idea", "a secondary detail", "an unrelated concept"];
  while (distractors.length < 3) {
    const g = genericPool[distractors.length % genericPool.length];
    if (!distractors.includes(g)) distractors.push(g);
    else break;
  }
  return [correct, ...distractors];
}

function shuffleChoices(choices: string[], correct: string): { choices: string[]; correctIndex: number } {
  // Deterministic shuffle using correct answer hash as seed
  const seed = Math.abs(hashCode(correct));
  const arr = [...choices];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (seed * (i + 1)) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return {
    choices: arr,
    correctIndex: arr.indexOf(correct),
  };
}

function buildShortAnswerQuestion(sentence: string, idx: number): QuestionAnswer | null {
  if (!sentence || countWords(sentence) < 5) return null;
  // Pattern: "X is/are Y" → "What is X?"
  const m1 = sentence.match(/^([A-Z][^.!?]{2,40}?)\s+(?:is|are|was|were)\s+([^.!?]{5,120})[.!?]?/);
  if (m1) {
    return {
      id: id("sa", idx),
      type: "short-answer",
      question: `What ${m1[1].split(" ").length === 1 ? "is" : "are"} ${m1[1].toLowerCase()}?`,
      answer: capitalize(m1[2].trim().replace(/[.!?]+$/, "")),
      sourceSentence: sentence,
    };
  }
  // Fallback: cloze-style deletion of the longest word.
  const tokens = sentence.split(/\s+/);
  if (tokens.length < 6) return null;
  const longestIdx = tokens.reduce((best, t, i) =>
    t.replace(/[^a-zA-Z]/g, "").length > tokens[best].replace(/[^a-zA-Z]/g, "").length ? i : best, 0);
  const longest = tokens[longestIdx].replace(/[^a-zA-Z]/g, "");
  if (longest.length < 5) return null;
  const cloze = [...tokens];
  cloze[longestIdx] = "_____";
  return {
    id: id("sa", idx),
    type: "short-answer",
    question: `Fill in the blank: ${cloze.join(" ")}`,
    answer: longest,
    sourceSentence: sentence,
  };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

// ---------- Flashcards ----------

/** Generate flashcards from key terms (front: term, back: definition). */
export function generateFlashcards(terms: KeyTerm[], max = 20): Flashcard[] {
  return terms.slice(0, max).map((t, i) => ({
    id: id("fc", i),
    front: t.term,
    back: t.definition,
  }));
}

// ---------- Learning objectives ----------

/** Generate learning objectives from top key terms + top sentences. */
export function generateObjectives(terms: KeyTerm[], sentences: string[], max = 5): string[] {
  const out: string[] = [];
  for (let i = 0; i < Math.min(max, terms.length); i++) {
    out.push(`Define and explain the term "${terms[i].term}".`);
  }
  // Pad with comprehension objectives from top sentences.
  let i = 0;
  while (out.length < max && i < sentences.length) {
    const s = sentences[i];
    if (countWords(s) >= 6) {
      out.push(`Summarize the key idea: "${truncate(s, 80)}"`);
    }
    i++;
  }
  return out.slice(0, max);
}

// ---------- Overview ----------

/** Build a one-paragraph overview from the first 1-2 sentences + top key terms. */
export function buildOverview(text: string, terms: KeyTerm[]): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0 && terms.length === 0) return "";
  const opener = sentences.slice(0, 2).join(" ");
  const termList = terms.slice(0, 5).map((t) => t.term).join(", ");
  if (opener && termList) {
    return `${opener} Key concepts: ${termList}.`;
  }
  if (opener) return opener;
  return `Key concepts: ${termList}.`;
}

// ---------- Full study guide ----------

/** Generate a full study guide from text. */
export function generateStudyGuide(
  text: string,
  format: GuideFormat,
  readingLevel: ReadingLevel,
  depth: Depth,
  topic: string,
): StudyGuide {
  const cfg = DEPTH_CONFIG[depth];
  const cleanText = clean(text);
  const sentences = splitSentences(cleanText);
  const scoredAll = scoreSentences(sentences, computeTermFrequencies(cleanText), readingLevel);
  const topSentences = [...scoredAll].sort((a, b) => b.score - a.score).slice(0, cfg.summarySentences);
  topSentences.sort((a, b) => a.index - b.index);

  const keyTerms = extractKeyTerms(cleanText, 15);
  const sections = splitSections(cleanText, cfg.sentencesPerSection);
  // For each section, pick top N sentences by score within that section
  const freq = computeTermFrequencies(cleanText);
  const enrichedSections: Section[] = sections.map((sec, i) => {
    const scored = scoreSentences(sec.sentences, freq, readingLevel);
    const top = [...scored].sort((a, b) => b.score - a.score).slice(0, cfg.sentencesPerSection);
    top.sort((a, b) => a.index - b.index);
    return {
      heading: `Section ${i + 1}`,
      sentences: top.map((s) => s.text),
    };
  });

  const summary = topSentences.map((s) => s.text);
  const questions = generateQuestions(cleanText, keyTerms, cfg.questionCount);
  const flashcards = generateFlashcards(keyTerms, 20);
  const objectives = generateObjectives(keyTerms, summary, 5);
  const overview = buildOverview(cleanText, keyTerms);
  const tp = clean(topic);

  const inputWordCount = countWords(cleanText);
  const outputWordCount =
    countWords(overview) +
    objectives.reduce((s, o) => s + countWords(o), 0) +
    keyTerms.reduce((s, t) => s + countWords(t.definition), 0) +
    enrichedSections.reduce((s, sec) => s + sec.sentences.reduce((s2, x) => s2 + countWords(x), 0), 0) +
    summary.reduce((s, x) => s + countWords(x), 0) +
    questions.reduce((s, q) => s + countWords(q.question) + countWords(q.answer), 0) +
    flashcards.reduce((s, f) => s + countWords(f.front) + countWords(f.back), 0);

  return {
    format,
    readingLevel,
    depth,
    topic: tp,
    overview,
    learningObjectives: objectives,
    keyTerms,
    sections: enrichedSections,
    summary,
    questions,
    flashcards,
    meta: {
      inputWordCount,
      outputWordCount,
      compressionRatio: inputWordCount > 0 ? outputWordCount / inputWordCount : 0,
      sentenceCount: enrichedSections.reduce((s, sec) => s + sec.sentences.length, 0),
      termCount: keyTerms.length,
      questionCount: questions.length,
      flashcardCount: flashcards.length,
    },
  };
}

// ---------- Rendering ----------

/** Render the study guide as Markdown. */
export function renderMarkdown(g: StudyGuide): string {
  const lines: string[] = [];
  lines.push(`# Study Guide: ${capitalize(g.topic || "Untitled Topic")}`);
  lines.push("");
  lines.push(`*Format: ${FORMAT_LABELS[g.format]} · Reading level: ${READING_LEVEL_LABELS[g.readingLevel]} · Depth: ${DEPTH_LABELS[g.depth]}*`);
  lines.push("");
  if (g.overview) {
    lines.push("## Overview");
    lines.push("");
    lines.push(g.overview);
    lines.push("");
  }
  if (g.learningObjectives.length > 0) {
    lines.push("## Learning Objectives");
    lines.push("");
    for (const o of g.learningObjectives) lines.push(`- ${o}`);
    lines.push("");
  }
  if (g.keyTerms.length > 0) {
    lines.push("## Key Terms");
    lines.push("");
    for (const t of g.keyTerms) {
      lines.push(`- **${t.term}** (${t.occurrences}× in source): ${t.definition}`);
    }
    lines.push("");
  }
  if (g.sections.length > 0 && (g.format === "outline" || g.format === "summary")) {
    lines.push("## Sections");
    lines.push("");
    for (const sec of g.sections) {
      lines.push(`### ${sec.heading}`);
      lines.push("");
      for (const s of sec.sentences) lines.push(`- ${s}`);
      lines.push("");
    }
  }
  if (g.summary.length > 0 && g.format === "summary") {
    lines.push("## Summary");
    lines.push("");
    for (const s of g.summary) lines.push(s);
    lines.push("");
  }
  if (g.questions.length > 0 && (g.format === "qa" || g.format === "summary")) {
    lines.push("## Self-Test Questions");
    lines.push("");
    g.questions.forEach((q, i) => {
      lines.push(`### Q${i + 1} (${q.type === "mcq" ? "MCQ" : "Short answer"})`);
      lines.push("");
      lines.push(q.question);
      if (q.choices && q.type === "mcq") {
        lines.push("");
        q.choices.forEach((c, idx) => {
          lines.push(`${String.fromCharCode(65 + idx)}. ${c}`);
        });
      }
      lines.push("");
      lines.push(`**Answer:** ${q.answer}`);
      lines.push("");
    });
  }
  if (g.flashcards.length > 0 && g.format === "flashcard") {
    lines.push("## Flashcards");
    lines.push("");
    for (const f of g.flashcards) {
      lines.push(`- **Front:** ${f.front}`);
      lines.push(`  - **Back:** ${f.back}`);
    }
    lines.push("");
  }
  lines.push("## Meta");
  lines.push("");
  lines.push(`- Input words: ${g.meta.inputWordCount}`);
  lines.push(`- Output words: ${g.meta.outputWordCount}`);
  lines.push(`- Compression ratio: ${g.meta.compressionRatio.toFixed(2)}×`);
  lines.push(`- Sections: ${g.sections.length} · Sentences: ${g.meta.sentenceCount}`);
  lines.push(`- Key terms: ${g.meta.termCount} · Questions: ${g.meta.questionCount} · Flashcards: ${g.meta.flashcardCount}`);
  return lines.join("\n");
}

/** Render as plain text. */
export function renderText(g: StudyGuide): string {
  return renderMarkdown(g);
}

/** Render flashcards as JSON (spaced-repetition format). */
export function renderFlashcardsJson(g: StudyGuide): string {
  return JSON.stringify(g.flashcards.map((f) => ({
    id: f.id,
    front: f.front,
    back: f.back,
  })), null, 2);
}

/** Render questions as CSV. */
export function renderCsv(g: StudyGuide): string {
  const lines = ["id,type,question,answer,choices,correct_index"];
  for (const q of g.questions) {
    lines.push([
      q.id,
      q.type,
      escapeCsv(q.question),
      escapeCsv(q.answer),
      q.choices ? escapeCsv(q.choices.join(" | ")) : "",
      q.correctIndex ?? "",
    ].join(","));
  }
  return lines.join("\n");
}

/** Render full guide as JSON. */
export function renderJson(g: StudyGuide): string {
  return JSON.stringify(g, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------- History (localStorage) ----------

export interface HistoryEntry {
  ts: number;
  format: GuideFormat;
  readingLevel: ReadingLevel;
  depth: Depth;
  topic: string;
  inputWordCount: number;
  questionCount: number;
  flashcardCount: number;
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

// ---------- Favorites (localStorage) ----------

export interface FavoriteEntry {
  ts: number;
  format: GuideFormat;
  readingLevel: ReadingLevel;
  depth: Depth;
  topic: string;
  markdown: string;
}

export function loadFavorites(): FavoriteEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as FavoriteEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveFavorite(entry: FavoriteEntry): FavoriteEntry[] {
  const next = [entry, ...loadFavorites()].slice(0, FAVES_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function removeFavorite(ts: number): FavoriteEntry[] {
  const next = loadFavorites().filter((f) => f.ts !== ts);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAVES_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareState {
  format: GuideFormat;
  readingLevel: ReadingLevel;
  depth: Depth;
  topic: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.format) params.set("f", state.format);
  if (state.readingLevel) params.set("r", state.readingLevel);
  if (state.depth) params.set("d", state.depth);
  if (state.topic) params.set("t", state.topic);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const cleanHash = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!cleanHash) return {};
  const params = new URLSearchParams(cleanHash);
  const out: Partial<ShareState> = {};
  const f = params.get("f") as GuideFormat | null;
  if (f && f in FORMAT_LABELS) out.format = f;
  const r = params.get("r") as ReadingLevel | null;
  if (r && r in READING_LEVEL_LABELS) out.readingLevel = r;
  const d = params.get("d") as Depth | null;
  if (d && d in DEPTH_LABELS) out.depth = d;
  const t = params.get("t");
  if (t) out.topic = t;
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(
  format: GuideFormat,
  readingLevel: ReadingLevel,
  depth: Depth,
  topic: string,
  sourceText: string,
): string {
  return [
    "You are an expert tutor who turns notes into structured study guides.",
    `Output format: ${FORMAT_LABELS[format]}.`,
    `Reading level: ${READING_LEVEL_LABELS[readingLevel]}.`,
    `Depth: ${DEPTH_LABELS[depth]}.`,
    `Topic: ${topic || "(auto-detected)"}.`,
    "",
    "Source material:",
    sourceText.slice(0, 8000),
    "",
    "Rules:",
    "- Generate an overview paragraph (2-3 sentences).",
    "- Generate 5 learning objectives.",
    "- Extract 10-15 key terms with definitions grounded in the source.",
    "- Generate 10 self-test questions: 5 MCQ (with 4 choices + correct answer) and 5 short-answer.",
    "- For each question, include the answer and the source sentence it's based on.",
    "- Stay faithful to the source. Do not invent facts.",
    "",
    "Output a JSON object with:",
    '- "overview": string',
    '- "learningObjectives": string[]',
    '- "keyTerms": [{ "term": string, "definition": string }]',
    '- "questions": [{ "type": "mcq"|"short-answer", "question": string, "answer": string, "choices"?: string[], "correctIndex"?: number, "sourceSentence"?: string }]',
    "",
    "Output ONLY a JSON object — no markdown fences, no commentary.",
  ].join("\n");
}

export interface LlmGuideResult {
  overview: string;
  learningObjectives: string[];
  keyTerms: { term: string; definition: string }[];
  questions: {
    type: "mcq" | "short-answer";
    question: string;
    answer: string;
    choices?: string[];
    correctIndex?: number;
    sourceSentence?: string;
  }[];
}

export function renderLlmResult(
  rawText: string,
): | { ok: true; result: LlmGuideResult }
   | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again or edit manually." };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = parsed as Record<string, unknown>;
  const overview = typeof o.overview === "string" ? o.overview : "";
  const learningObjectives = Array.isArray(o.learningObjectives)
    ? (o.learningObjectives as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const keyTerms = Array.isArray(o.keyTerms)
    ? (o.keyTerms as unknown[])
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x) => ({
          term: typeof x.term === "string" ? x.term : "",
          definition: typeof x.definition === "string" ? x.definition : "",
        }))
        .filter((x) => x.term)
    : [];
  const questions: LlmGuideResult["questions"] = Array.isArray(o.questions)
    ? (o.questions as unknown[])
        .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
        .map((x): LlmGuideResult["questions"][number] => {
          const type: "mcq" | "short-answer" =
            (typeof x.type === "string" && (x.type === "mcq" || x.type === "short-answer"))
              ? x.type
              : "short-answer";
          return {
            type,
            question: typeof x.question === "string" ? x.question : "",
            answer: typeof x.answer === "string" ? x.answer : "",
            choices: Array.isArray(x.choices)
              ? (x.choices as unknown[]).filter((c): c is string => typeof c === "string")
              : undefined,
            correctIndex: typeof x.correctIndex === "number" ? x.correctIndex : undefined,
            sourceSentence: typeof x.sourceSentence === "string" ? x.sourceSentence : undefined,
          };
        })
        .filter((x) => x.question)
    : [];
  if (!overview && learningObjectives.length === 0 && keyTerms.length === 0 && questions.length === 0) {
    return { ok: false, error: "LLM output contained no usable guide content." };
  }
  return {
    ok: true,
    result: { overview, learningObjectives, keyTerms, questions },
  };
}
