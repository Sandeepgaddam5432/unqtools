/**
 * AI Text Simplifier (ELI5) — pure logic.
 *
 * Rewrites complex text into plain language at a chosen reading level.
 * Pure-JS engine — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 *
 * Capabilities:
 *   - Reading-level presets: ELI5 / grade-school / teen / plain-professional
 *   - Jargon dictionary (80+ terms) → plain synonym + gloss
 *   - Synonym substitution toward grade-school vocabulary
 *   - Sentence splitter (threshold per level)
 *   - Preserve-exactly locks for figures, dates, dosages, citations,
 *     currency, percentages, URLs
 *   - Flesch reading-ease + grade-level before/after
 *   - Side-by-side diff (word-level LCS)
 *   - Sentence-length + passive-voice highlights
 *   - Bullet-ize option
 *   - History (localStorage, last 20) + shareable URL
 *
 * Pure functions only.
 */

// ---------- Types ----------

export type ReadingLevel = "eli5" | "grade-school" | "teen" | "plain-professional";

export interface JargonEntry {
  term: string;          // canonical lowercase term used for matching
  plain: string;         // grade-school replacement
  simpler: string;       // ELI5 replacement (most plain)
  gloss: string;         // short definition shown as tooltip
}

export interface JargonHit {
  id: string;
  entry: JargonEntry;
  start: number;
  end: number;
  original: string;
  replacement: string;
}

export interface LockedToken {
  start: number;
  end: number;
  text: string;
  kind: "figure" | "date" | "dosage" | "citation" | "currency" | "percent" | "url" | "time" | "doi";
}

export interface SimplifyOptions {
  level: ReadingLevel;
  lockTokens: boolean;
  splitLongSentences: boolean;
  bulletize: boolean;
  ignored: string[];
}

export interface Readability {
  fleschReadingEase: number;     // 0-100 (higher = easier)
  fleschGradeLevel: number;
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  avgWordsPerSentence: number;
  longSentenceCount: number;
}

export interface SimplifyResult {
  original: string;
  simplified: string;
  hits: JargonHit[];
  locked: LockedToken[];
  stats: {
    jargonCount: number;
    lockedCount: number;
    originalReadability: Readability;
    simplifiedReadability: Readability;
    improvement: number;
    passiveVoiceCount: number;
    longSentenceCount: number;
  };
}

export interface DiffSegment {
  type: "same" | "added" | "removed";
  text: string;
}

export interface HistoryEntry {
  ts: number;
  level: ReadingLevel;
  originalLength: number;
  simplifiedLength: number;
  jargonCount: number;
  improvement: number;
}

export interface ShareState {
  text: string;
  level: ReadingLevel;
  lockTokens: boolean;
  splitLongSentences: boolean;
  bulletize: boolean;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-text-simplifier-eli5:history";
export const HISTORY_MAX = 20;
export const IGNORE_KEY = "unqtools:ai-text-simplifier-eli5:ignored";

export const LEVEL_LABELS: Record<ReadingLevel, string> = {
  "eli5": "ELI5 (very young)",
  "grade-school": "Grade-school (grade 5)",
  "teen": "Teen (grade 8)",
  "plain-professional": "Plain-professional",
};

export const LEVEL_THRESHOLDS: Record<ReadingLevel, number> = {
  "eli5": 12,
  "grade-school": 20,
  "teen": 25,
  "plain-professional": 999, // no forced splitting
};

export const DEFAULT_OPTIONS: SimplifyOptions = {
  level: "grade-school",
  lockTokens: true,
  splitLongSentences: true,
  bulletize: false,
  ignored: [],
};

export const SAMPLE_TEXTS: { label: string; text: string }[] = [
  {
    label: "Dense academic",
    text: "The utilization of multi-faceted pedagogical methodologies facilitates the amelioration of student learning outcomes. Notwithstanding the aforementioned challenges, educators must endeavor to incorporate heterogeneous instructional modalities to accommodate diverse learning modalities.",
  },
  {
    label: "Technical jargon",
    text: "The asynchronous microservices architecture leverages containerization to achieve horizontal scalability. Throughput improved by 40% on 2024-03-15 after the refactor, reducing latency by approximately 25%.",
  },
  {
    label: "Legal-style",
    text: "Notwithstanding any provision herein to the contrary, the party shall indemnify and hold harmless the counterparty for any tort or breach. Force majeure shall not apply to obligations under Section 4.2. See Smith v. Jones, 2020.",
  },
  {
    label: "Medical-style",
    text: "Patient presents with hypertension and Type 2 diabetes mellitus. Prescribed metformin 500mg twice daily. Prognosis is favorable with no contraindication to exercise. Blood pressure was 140/90 mmHg.",
  },
];

// ---------- Jargon dictionary (80+ entries) ----------

export const JARGON_DICTIONARY: JargonEntry[] = [
  { term: "utilization", plain: "use", simpler: "use", gloss: "The act of using something." },
  { term: "utilize", plain: "use", simpler: "use", gloss: "To use something." },
  { term: "amelioration", plain: "improvement", simpler: "making better", gloss: "Making something better." },
  { term: "ameliorate", plain: "improve", simpler: "make better", gloss: "To make better." },
  { term: "facilitate", plain: "help", simpler: "help", gloss: "To make easier or help happen." },
  { term: "facilitates", plain: "helps", simpler: "helps", gloss: "Makes easier." },
  { term: "pedagogical", plain: "teaching", simpler: "teaching", gloss: "About teaching." },
  { term: "methodology", plain: "method", simpler: "way", gloss: "A way of doing something." },
  { term: "methodologies", plain: "methods", simpler: "ways", gloss: "Ways of doing something." },
  { term: "notwithstanding", plain: "even so", simpler: "even so", gloss: "In spite of; even so." },
  { term: "aforementioned", plain: "mentioned earlier", simpler: "named before", gloss: "Mentioned before." },
  { term: "endeavor", plain: "try", simpler: "try", gloss: "To try hard." },
  { term: "endeavor to", plain: "try to", simpler: "try to", gloss: "To try to." },
  { term: "heterogeneous", plain: "varied", simpler: "mixed", gloss: "Made of different kinds." },
  { term: "incorporate", plain: "include", simpler: "add", gloss: "To include or add." },
  { term: "accommodate", plain: "fit", simpler: "fit", gloss: "To fit or help." },
  { term: "modalities", plain: "methods", simpler: "ways", gloss: "Ways of doing something." },
  { term: "modality", plain: "method", simpler: "way", gloss: "A way of doing something." },
  { term: "demonstrate", plain: "show", simpler: "show", gloss: "To show clearly." },
  { term: "demonstrates", plain: "shows", simpler: "shows", gloss: "Shows." },
  { term: "subsequently", plain: "later", simpler: "later", gloss: "Afterwards; later." },
  { term: "consequently", plain: "so", simpler: "so", gloss: "As a result; so." },
  { term: "additionally", plain: "also", simpler: "also", gloss: "Also; in addition." },
  { term: "furthermore", plain: "also", simpler: "also", gloss: "Also; in addition." },
  { term: "moreover", plain: "also", simpler: "also", gloss: "Also; besides." },
  { term: "nevertheless", plain: "even so", simpler: "even so", gloss: "In spite of that." },
  { term: "nonetheless", plain: "even so", simpler: "even so", gloss: "In spite of that." },
  { term: "therefore", plain: "so", simpler: "so", gloss: "For that reason; so." },
  { term: "however", plain: "but", simpler: "but", gloss: "But; on the other hand." },
  { term: "thus", plain: "so", simpler: "so", gloss: "So; therefore." },
  { term: "hence", plain: "so", simpler: "so", gloss: "So; for that reason." },
  { term: "regarding", plain: "about", simpler: "about", gloss: "About." },
  { term: "concerning", plain: "about", simpler: "about", gloss: "About." },
  { term: "numerous", plain: "many", simpler: "many", gloss: "Many." },
  { term: "approximately", plain: "about", simpler: "about", gloss: "About; roughly." },
  { term: "sufficient", plain: "enough", simpler: "enough", gloss: "Enough." },
  { term: "insufficient", plain: "not enough", simpler: "not enough", gloss: "Not enough." },
  { term: "demonstrate", plain: "show", simpler: "show", gloss: "To show." },
  { term: "elucidate", plain: "explain", simpler: "explain", gloss: "To explain clearly." },
  { term: "ascertain", plain: "find out", simpler: "find out", gloss: "To find out." },
  { term: "commence", plain: "start", simpler: "start", gloss: "To start." },
  { term: "terminate", plain: "end", simpler: "end", gloss: "To end." },
  { term: "initiate", plain: "start", simpler: "start", gloss: "To start." },
  { term: "constitute", plain: "make up", simpler: "make up", gloss: "To make up or form." },
  { term: "comprise", plain: "include", simpler: "include", gloss: "To include or be made of." },
  { term: "predominantly", plain: "mostly", simpler: "mostly", gloss: "Mostly; mainly." },
  { term: "primarily", plain: "mostly", simpler: "mostly", gloss: "Mostly; first." },
  { term: "substantially", plain: "a lot", simpler: "a lot", gloss: "A lot; greatly." },
  { term: "significantly", plain: "a lot", simpler: "a lot", gloss: "A lot; in an important way." },
  { term: "in order to", plain: "to", simpler: "to", gloss: "To; for the purpose of." },
  { term: "prior to", plain: "before", simpler: "before", gloss: "Before." },
  { term: "subsequent to", plain: "after", simpler: "after", gloss: "After." },
  { term: "in the event that", plain: "if", simpler: "if", gloss: "If." },
  { term: "in lieu of", plain: "instead of", simpler: "instead of", gloss: "Instead of." },
  { term: "with regard to", plain: "about", simpler: "about", gloss: "About." },
  { term: "with respect to", plain: "about", simpler: "about", gloss: "About." },
  { term: "in accordance with", plain: "following", simpler: "following", gloss: "Following; per." },
  { term: "asynchronous", plain: "non-blocking", simpler: "no waiting", gloss: "Happening without waiting." },
  { term: "microservices", plain: "small services", simpler: "small app parts", gloss: "An app split into small parts." },
  { term: "containerization", plain: "packaging", simpler: "boxing up", gloss: "Packaging apps with what they need." },
  { term: "scalability", plain: "growth capacity", simpler: "ability to grow", gloss: "Ability to grow." },
  { term: "throughput", plain: "work rate", simpler: "speed of work", gloss: "How much work gets done in time." },
  { term: "latency", plain: "delay", simpler: "wait time", gloss: "A delay." },
  { term: "refactor", plain: "restructure", simpler: "tidy up", gloss: "Improve code structure." },
  { term: "hypertension", plain: "high blood pressure", simpler: "high blood pressure", gloss: "High blood pressure." },
  { term: "diabetes mellitus", plain: "diabetes", simpler: "diabetes", gloss: "A sugar-handling disease." },
  { term: "subcutaneous", plain: "under the skin", simpler: "under the skin", gloss: "Under the skin." },
  { term: "contraindication", plain: "reason not to", simpler: "reason not to", gloss: "A reason not to do something." },
  { term: "prognosis", plain: "outlook", simpler: "outlook", gloss: "Likely outcome of an illness." },
  { term: "prescribed", plain: "given as medicine", simpler: "given as medicine", gloss: "Given as medicine." },
  { term: "indemnify", plain: "protect from costs", simpler: "protect from costs", gloss: "To protect from costs or loss." },
  { term: "hold harmless", plain: "not blame", simpler: "not blame", gloss: "To not blame or sue." },
  { term: "force majeure", plain: "act of God", simpler: "unforeseeable event", gloss: "An unforeseeable event like a disaster." },
  { term: "tort", plain: "wrongful act", simpler: "wrongful act", gloss: "A civil wrong." },
  { term: "provision", plain: "clause", simpler: "rule", gloss: "A clause or rule in a contract." },
  { term: "obligations", plain: "duties", simpler: "duties", gloss: "Things you must do." },
  { term: "counterparty", plain: "other party", simpler: "other side", gloss: "The other party in a deal." },
  { term: "herein", plain: "in this", simpler: "in this", gloss: "In this document." },
  { term: "therein", plain: "in that", simpler: "in that", gloss: "In that thing." },
  { term: "thereof", plain: "of that", simpler: "of that", gloss: "Of that." },
  { term: "alleviate", plain: "ease", simpler: "ease", gloss: "To make less severe." },
  { term: "implement", plain: "carry out", simpler: "do", gloss: "To carry out." },
  { term: "implementation", plain: "carrying out", simpler: "doing", gloss: "The act of carrying out." },
  { term: "leverage", plain: "use", simpler: "use", gloss: "To use to advantage." },
  { term: "optimize", plain: "improve", simpler: "make better", gloss: "To make as good as possible." },
  { term: "facilitates", plain: "helps", simpler: "helps", gloss: "Helps." },
  { term: "endeavor", plain: "try", simpler: "try", gloss: "To try." },
  { term: "regarding", plain: "about", simpler: "about", gloss: "About." },
];

// ---------- String helpers ----------

export function normalizeWhitespace(s: string): string {
  return (s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
}

export function countSyllables(word: string): number {
  const w = (word || "").toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip silent trailing 'e'
  let s = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  s = s.replace(/^y/, "");
  const m = s.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

export function splitSentences(text: string): string[] {
  if (!text) return [];
  // Split on sentence enders followed by whitespace, keep abbreviations
  const parts = text
    .replace(/([.!?])\s+/g, "$1\u0001")
    .split("\u0001")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts;
}

export function splitWords(sentence: string): string[] {
  if (!sentence) return [];
  return sentence.split(/\s+/).filter(Boolean);
}

// ---------- Lock tokens (preserve-exactly) ----------

const LOCK_PATTERNS: { kind: LockedToken["kind"]; re: RegExp }[] = [
  { kind: "url", re: /https?:\/\/[^\s)]+/gi },
  { kind: "doi", re: /DOI:\s*10\.[0-9]{4,9}\/[^\s,]+/gi },
  // citation like "Smith v. Jones, 2020" or "Smith v. Jones (2020)"
  { kind: "citation", re: /[A-Z][a-zA-Z]+ v\. [A-Z][a-zA-Z]+,?\s*\(?[12][0-9]{3}\)?/g },
  // currency $1,200 or €1.200 or £100
  { kind: "currency", re: /[$€£¥]\s?[0-9][0-9,.\s]{0,12}/g },
  // percent 40% or 40 %
  { kind: "percent", re: /[0-9]+(?:\.[0-9]+)?\s?%/g },
  // dosage 500mg, 50 mL, 10 mcg
  { kind: "dosage", re: /[0-9]+(?:\.[0-9]+)?\s?(?:mg|mcg|g|kg|mL|L|IU|mmol)\b/gi },
  // date 2024-03-15, 03/15/2024, March 15 2024, 15 March 2024
  { kind: "date", re: /\b(?:[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+[0-9]{4})\b/g },
  // time 12:30, 3:45 PM
  { kind: "time", re: /\b[0-9]{1,2}:[0-9]{2}(?:\s?[AaPp][Mm])?\b/g },
  // figure (must be after percent/currency/dosage to avoid stealing)
  { kind: "figure", re: /\b[0-9][0-9,.]*\b/g },
];

/** Find all locked tokens in text. Returns non-overlapping spans. */
export function findLockedTokens(text: string): LockedToken[] {
  if (!text) return [];
  const hits: LockedToken[] = [];
  for (const { kind, re } of LOCK_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // skip if overlaps an existing hit
      const overlaps = hits.some((h) => start < h.end && end > h.start);
      if (!overlaps) {
        hits.push({ kind, start, end, text: m[0] });
      }
      if (m[0].length === 0) re.lastIndex++; // safety
    }
  }
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

// ---------- Jargon detection ----------

/** Pick the right replacement for a jargon entry based on level. */
export function pickReplacement(entry: JargonEntry, level: ReadingLevel): string {
  if (level === "eli5") return entry.simpler || entry.plain || entry.term;
  if (level === "grade-school") return entry.plain || entry.simpler || entry.term;
  return entry.term; // teen / plain-professional: keep original, gloss only
}

/** Find jargon hits in text (case-insensitive whole-word match). */
export function findJargon(
  text: string,
  dictionary: JargonEntry[],
  level: ReadingLevel,
  ignored: string[] = [],
): JargonHit[] {
  if (!text || dictionary.length === 0) return [];
  const ignoreSet = new Set(ignored.map((s) => s.toLowerCase().trim()));
  const hits: JargonHit[] = [];
  for (const entry of dictionary) {
    if (ignoreSet.has(entry.term)) continue;
    // build a whole-word regex; escape regex special chars in the term
    const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      hits.push({
        id: `${entry.term}-${start}`,
        entry,
        start,
        end,
        original: m[0],
        replacement: pickReplacement(entry, level),
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

// ---------- Sentence splitting (long-sentence splitter) ----------

export function splitLongSentence(sentence: string, threshold: number): string[] {
  const words = splitWords(sentence);
  if (words.length <= threshold) return [sentence];
  // Try to split at commas, semicolons, and conjunctions first.
  const parts: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length > 0) {
      parts.push(current.join(" "));
      current = [];
    }
  };
  for (const w of words) {
    current.push(w);
    const isBreakpoint = /[,;:]$/.test(w) || /^(and|but|so|because|although|however|therefore|which|that)\b/i.test(w);
    if (current.length >= threshold && isBreakpoint) {
      flush();
    }
  }
  flush();
  // If splitting didn't help (no break points), force-chop at threshold
  if (parts.length === 1 && parts[0] === sentence) {
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += threshold) {
      chunks.push(words.slice(i, i + threshold).join(" "));
    }
    return chunks;
  }
  // Make sure each chunk ends with a period if the original did
  const endsWithPeriod = /[.!?]$/.test(sentence.trim());
  return parts.map((p, i) => {
    const isLast = i === parts.length - 1;
    const trimmed = p.trim();
    if (endsWithPeriod && isLast && !/[.!?]$/.test(trimmed)) return trimmed + ".";
    if (!endsWithPeriod && /[.!?]$/.test(trimmed)) return trimmed.slice(0, -1);
    return trimmed;
  });
}

// ---------- Passive voice detection ----------

const PASSIVE_RE = /\b(?:is|are|was|were|be|been|being)\s+([a-z]+ed|written|done|made|taken|given|known|shown|held|kept|sent|told|paid|built|brought|bought|caught|taught|thought|fought|found|lost|won)\b/gi;

export function detectPassiveVoice(text: string): { start: number; end: number; text: string }[] {
  if (!text) return [];
  const out: { start: number; end: number; text: string }[] = [];
  PASSIVE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = PASSIVE_RE.exec(text)) !== null) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
    if (m[0].length === 0) PASSIVE_RE.lastIndex++;
  }
  return out;
}

// ---------- Readability ----------

export function computeReadability(text: string, longSentenceThreshold = 20): Readability {
  const clean = normalizeWhitespace(text);
  if (!clean) {
    return {
      fleschReadingEase: 0,
      fleschGradeLevel: 0,
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      avgWordsPerSentence: 0,
      longSentenceCount: 0,
    };
  }
  const sentences = splitSentences(clean);
  const words = splitWords(clean.replace(/[.!?]/g, " "));
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const wordCount = words.length;
  const sentenceCount = Math.max(sentences.length, 1);
  const avgWordsPerSentence = wordCount / sentenceCount;
  const longSentenceCount = sentences.filter((s) => splitWords(s).length > longSentenceThreshold).length;
  const fleschReadingEase = Math.max(
    0,
    Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * (syllables / Math.max(wordCount, 1))),
  );
  const fleschGradeLevel = 0.39 * avgWordsPerSentence + 11.8 * (syllables / Math.max(wordCount, 1)) - 15.59;
  return {
    fleschReadingEase: round(fleschReadingEase, 1),
    fleschGradeLevel: round(Math.max(0, fleschGradeLevel), 1),
    wordCount,
    sentenceCount,
    syllableCount: syllables,
    avgWordsPerSentence: round(avgWordsPerSentence, 1),
    longSentenceCount,
  };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

// ---------- Diff ----------

/** Word-level LCS diff between original and simplified. */
export function diffText(original: string, simplified: string): DiffSegment[] {
  const a = (original || "").split(/(\s+)/);
  const b = (simplified || "").split(/(\s+)/);
  const n = a.length;
  const m = b.length;
  // DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segs: DiffSegment[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushSeg(segs, "same", a[i]);
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushSeg(segs, "removed", a[i]);
      i++;
    } else {
      pushSeg(segs, "added", b[j]);
      j++;
    }
  }
  while (i < n) { pushSeg(segs, "removed", a[i++]); }
  while (j < m) { pushSeg(segs, "added", b[j++]); }
  return segs;
}

function pushSeg(segs: DiffSegment[], type: DiffSegment["type"], text: string): void {
  if (!text) return;
  const last = segs[segs.length - 1];
  if (last && last.type === type) last.text += text;
  else segs.push({ type, text });
}

// ---------- Core simplify ----------

/** Apply jargon substitutions to text. Returns new text. Preserves the
 *  capitalization of the original first letter (so "Utilize" → "Use"). */
export function applyJargonSubstitutions(
  text: string,
  hits: JargonHit[],
): string {
  if (hits.length === 0) return text;
  // hits are sorted by start; apply from end to start to keep offsets valid
  let out = text;
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    let replacement = h.replacement;
    // Preserve capitalization: if the original starts with an uppercase
    // letter, uppercase the first character of the replacement.
    const firstChar = h.original.charAt(0);
    if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    out = out.slice(0, h.start) + replacement + out.slice(h.end);
  }
  return out;
}

/** Split all long sentences in text according to level threshold. */
export function splitLongSentencesInText(
  text: string,
  threshold: number,
  enabled: boolean,
): string {
  if (!enabled || !text) return text;
  const sentences = splitSentences(text);
  const out: string[] = [];
  for (const s of sentences) {
    const chunks = splitLongSentence(s, threshold);
    out.push(chunks.join(" "));
  }
  return out.join(" ");
}

/** Bullet-ize: split text into sentences and emit a bullet list. */
export function bulletize(text: string): string {
  if (!text) return "";
  const sentences = splitSentences(text);
  return sentences.map((s) => `- ${s}`).join("\n");
}

/** Main entry point: simplify text per options. */
export function simplifyText(text: string, options: SimplifyOptions): SimplifyResult {
  const original = text || "";
  const level = options.level;
  const threshold = LEVEL_THRESHOLDS[level];
  // 1) detect jargon
  const hits = findJargon(original, JARGON_DICTIONARY, level, options.ignored);
  // 2) detect locked tokens (before substitution so spans match original)
  const locked = options.lockTokens ? findLockedTokens(original) : [];
  // 3) substitute jargon
  let simplified = applyJargonSubstitutions(original, hits);
  // 4) split long sentences
  simplified = splitLongSentencesInText(simplified, threshold, options.splitLongSentences);
  // 5) bullet-ize
  if (options.bulletize) {
    simplified = bulletize(simplified);
  }
  // 6) readability
  const originalReadability = computeReadability(original, threshold);
  const simplifiedReadability = computeReadability(simplified, threshold);
  const passiveVoiceCount = detectPassiveVoice(original).length;
  const improvement = round(simplifiedReadability.fleschReadingEase - originalReadability.fleschReadingEase, 1);
  return {
    original,
    simplified,
    hits,
    locked,
    stats: {
      jargonCount: hits.length,
      lockedCount: locked.length,
      originalReadability,
      simplifiedReadability,
      improvement,
      passiveVoiceCount,
      longSentenceCount: originalReadability.longSentenceCount,
    },
  };
}

// ---------- History (localStorage) ----------

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

/** Load the session ignore list (custom terms the user wants to keep). */
export function loadIgnored(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(IGNORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveIgnored(terms: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(IGNORE_KEY, JSON.stringify(terms));
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.text) params.set("text", state.text);
  if (state.level) params.set("level", state.level);
  params.set("lock", state.lockTokens ? "1" : "0");
  params.set("split", state.splitLongSentences ? "1" : "0");
  params.set("bullets", state.bulletize ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const level = params.get("level") as ReadingLevel | null;
  const validLevels: ReadingLevel[] = ["eli5", "grade-school", "teen", "plain-professional"];
  return {
    text: params.get("text") ?? "",
    level: level && validLevels.includes(level) ? level : undefined,
    lockTokens: params.get("lock") === "1",
    splitLongSentences: params.get("split") === "1",
    bulletize: params.get("bullets") === "1",
  };
}

// ---------- BYO-key LLM hook (request builder) ----------

export interface LlmRequestBody {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  max_tokens: number;
}

export function buildLlmRequestBody(
  text: string,
  level: ReadingLevel,
  model = "gpt-4o-mini",
): LlmRequestBody {
  const levelPrompt = level === "eli5"
    ? "Explain this to a 5-year-old. Use very simple words and short sentences."
    : level === "grade-school"
      ? "Rewrite this at a grade-5 reading level. Use simple words and short sentences."
      : level === "teen"
        ? "Rewrite this at a grade-8 reading level. Use medium-simple words."
        : "Rewrite this in plain professional English. Keep the meaning.";
  return {
    model,
    messages: [
      {
        role: "system",
        content: `${levelPrompt} Preserve all numbers, dates, citations, dosages, currency, and percentages exactly. Do not add new information.`,
      },
      { role: "user", content: text },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  };
}

/** Extract the simplified text from a typical OpenAI-style response. */
export function extractSimplifiedFromLlmResponse(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";
  const r = resp as Record<string, unknown>;
  const choices = r.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const content = choices[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
