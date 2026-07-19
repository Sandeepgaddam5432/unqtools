/**
 * AI Grammar Correction Tool — pure logic.
 *
 * Rule-based grammar checker covering six families:
 *   1. Subject-verb agreement (is/are, was/were, has/have, do/does)
 *   2. Articles (a vs an, missing/redundant)
 *   3. Punctuation (double spaces, terminal periods, comma spacing)
 *   4. Capitalization (sentence start, "I", days/months)
 *   5. Common confusions (their/there/they're, your/you're, its/it's, to/too, then/than)
 *   6. Spelling (common misspellings dictionary)
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type IssueCategory =
  | "grammar"
  | "article"
  | "punctuation"
  | "capitalization"
  | "confusion"
  | "spelling";

export interface Issue {
  id: string;
  category: IssueCategory;
  start: number;        // inclusive offset in original text
  end: number;          // exclusive offset
  original: string;     // text[start:end]
  suggestion: string;   // suggested replacement
  explanation: string;
  severity: "error" | "warning" | "style";
}

export interface CheckResult {
  original: string;
  issues: Issue[];
  stats: Stats;
}

export interface Stats {
  totalIssues: number;
  byCategory: Record<IssueCategory, number>;
  bySeverity: { error: number; warning: number; style: number };
  wordCount: number;
  sentenceCount: number;
  characters: number;
  readability: Readability;
}

export interface Readability {
  fleschReadingEase: number;     // 0-100
  fleschGradeLevel: number;
  passiveVoiceCount: number;
  longSentenceCount: number;
  avgWordsPerSentence: number;
}

export interface DiffSegment {
  type: "equal" | "insert" | "delete";
  text: string;
}

export interface HistoryEntry {
  ts: number;
  textPreview: string;
  issueCount: number;
  byCategory: Record<IssueCategory, number>;
  readability: Readability;
}

export interface ShareState {
  text: string;
  lang: string;
}

export interface LlmPrompt {
  system: string;
  user: string;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-grammar-tool:history";
export const HISTORY_MAX = 20;
export const IGNORE_KEY = "unqtools:ai-grammar-tool:ignore";

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  grammar: "Grammar",
  article: "Articles",
  punctuation: "Punctuation",
  capitalization: "Capitalization",
  confusion: "Common confusions",
  spelling: "Spelling",
};

export const CATEGORY_COLORS: Record<IssueCategory, string> = {
  grammar: "#dc2626",        // red-600
  article: "#2563eb",        // blue-600
  punctuation: "#7c3aed",    // violet-600
  capitalization: "#d97706", // amber-600
  confusion: "#db2777",      // pink-600
  spelling: "#059669",       // emerald-600
};

export const SEVERITY_LABELS: Record<Issue["severity"], string> = {
  error: "Error",
  warning: "Warning",
  style: "Style",
};

export const SAMPLE_TEXTS: string[] = [
  "their going to the park with there friends. i think its a beautiful day.",
  "She don't knows what to do. a apple a day keeps the doctor away  .",
  "the team are winning. Its been a long time since we met. Your going to love it.",
  "i think that their is a problem with the report. we needs too fix it by friday.",
  "He was been happy. The quick brown fox jumps over the lazy dog. To infinity and beyond!",
];

/** Vowels for the a/an rule (y is handled separately as vowel-sound test). */
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

/**
 * Common confusions — list of {wrong, right, explanation} pairs.
 * Each entry is matched as a whole word (case-insensitive, case-preserving
 * replacement).
 */
export interface ConfusionRule {
  wrong: string;       // lowercased
  right: string;       // lowercased
  explanation: string;
}

export const CONFUSION_RULES: ConfusionRule[] = [
  { wrong: "their", right: "they're", explanation: "Use \"they're\" (they are) for the action. \"Their\" is possessive." },
  { wrong: "there", right: "they're", explanation: "Use \"they're\" (they are) for the action. \"There\" is a place." },
  // The two rules above are intentionally ambiguous — the checker prefers the
  // 's ownership vs contraction hints below to choose. Both are listed for
  // explanatory purposes; only the highest-confidence match surfaces.
  { wrong: "your", right: "you're", explanation: "Use \"you're\" (you are) for the action. \"Your\" is possessive." },
  { wrong: "its", right: "it's", explanation: "Use \"it's\" (it is / it has) for the contraction. \"Its\" is possessive." },
  { wrong: "to", right: "too", explanation: "Use \"too\" for \"also\" or \"excessively\". \"To\" is the preposition." },
  { wrong: "then", right: "than", explanation: "Use \"than\" for comparisons. \"Then\" refers to time or sequence." },
  { wrong: "affect", right: "effect", explanation: "Use \"effect\" for the noun (a result). \"Affect\" is the verb (to influence)." },
  { wrong: "loose", right: "lose", explanation: "Use \"lose\" for misplacing or not winning. \"Loose\" means not tight." },
];

/**
 * Spelling dictionary: { misspelling → correction }.
 */
export const SPELLING_DICT: Record<string, string> = {
  "recieve": "receive",
  "seperate": "separate",
  "definately": "definitely",
  "occured": "occurred",
  "occuring": "occurring",
  "occurence": "occurrence",
  "wich": "which",
  "thru": "through",
  "thier": "their",
  "teh": "the",
  "adn": "and",
  "taht": "that",
  "witht": "with",
  "becuase": "because",
  "beleive": "believe",
  "freind": "friend",
  "wierd": "weird",
  "neccessary": "necessary",
  "tommorow": "tomorrow",
  "tommorrow": "tomorrow",
  "tounge": "tongue",
  "truely": "truly",
  "arguement": "argument",
  "enviroment": "environment",
  "goverment": "government",
  "independant": "independent",
  "publically": "publicly",
  "realy": "really",
  "similiar": "similar",
  "speach": "speech",
  "sucessful": "successful",
  "wether": "whether",
  "writting": "writing",
  "begining": "beginning",
  "calender": "calendar",
  "cemetary": "cemetery",
  "changable": "changeable",
  "collegue": "colleague",
  "comming": "coming",
  "commitee": "committee",
  "concious": "conscious",
  "curiousity": "curiosity",
  "dissapear": "disappear",
  "embarras": "embarrass",
  "existance": "existence",
  "foriegn": "foreign",
  "garantee": "guarantee",
  "gramar": "grammar",
  "happend": "happened",
  "harras": "harass",
  "heirarchy": "hierarchy",
  "humourous": "humorous",
  "inteligent": "intelligent",
  "jewelery": "jewelry",
  "knowlege": "knowledge",
  "liason": "liaison",
  "libary": "library",
  "lisence": "license",
  "maintainance": "maintenance",
  "managable": "manageable",
  "millenium": "millennium",
  "noticable": "noticeable",
  "occassion": "occasion",
  "persistant": "persistent",
  "posession": "possession",
  "prefered": "preferred",
  "priviledge": "privilege",
  "probaly": "probably",
  "pronounciation": "pronunciation",
  "que": "queue",
  "refered": "referred",
  "religous": "religious",
  "rythm": "rhythm",
  "sacreligious": "sacrilegious",
  "sieze": "seize",
  "supercede": "supersede",
  "tendancy": "tendency",
  "threshold": "threshold",
  "twelth": "twelfth",
  "unfortunatly": "unfortunately",
  "vaccum": "vacuum",
  "welth": "wealth",
  "withold": "withhold",
  "writen": "written",
  "yatch": "yacht",
};

/** Days and months to capitalize. */
export const PROPER_NOUNS: string[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
];

// ---------- Normalization ----------

/** Normalize newlines and collapse internal whitespace runs (preserves single spaces). */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Count words (rough — split on whitespace). */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Count sentences (rough — split on terminal punctuation followed by space/end). */
export function countSentences(s: string): number {
  if (!s || !s.trim()) return 0;
  const parts = s.split(/[.!?]+(?:\s|$)/).filter((p) => p.trim().length > 0);
  // Add 1 if the text ends with terminal punctuation but no trailing space.
  if (/[.!?]\s*$/.test(s) && parts.length === 0) return 1;
  return parts.length || 1;
}

/** Count syllables in a word (rough heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip silent trailing 'e'
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const matches = cleaned.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

// ---------- Rule helpers ----------

/** Generate a short pseudo-random id. */
function genId(): string {
  return `iss-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-4)}`;
}

/** Preserve the case pattern of `original` when substituting `suggestion`. */
export function preserveCase(original: string, suggestion: string): string {
  if (!original) return suggestion;
  if (!suggestion) return suggestion;
  // All caps
  if (original === original.toUpperCase() && original.length > 1) {
    return suggestion.toUpperCase();
  }
  // Title case (first letter upper, rest lower)
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return suggestion[0].toUpperCase() + suggestion.slice(1).toLowerCase();
  }
  return suggestion;
}

/** Test whether a word starts with a vowel sound (for a/an). */
export function startsWithVowelSound(word: string): boolean {
  const w = (word || "").toLowerCase();
  if (!w) return false;
  // Special-case 'hour', 'honest', 'honor' — silent h
  if (/^(hour|honest|honor|honestly|honour)/.test(w)) return true;
  // Special-case 'university', 'unicorn', 'european', 'one' — start with consonant sound
  if (/^(uni|use|usu|euro|one|once)/.test(w)) return false;
  const first = w[0];
  return VOWELS.has(first);
}

/** Find all non-overlapping matches of a regex with their offsets. */
export function findAll(re: RegExp, text: string): { match: string; start: number; end: number }[] {
  const out: { match: string; start: number; end: number }[] = [];
  if (!re.global) {
    throw new Error("findAll requires a global regex");
  }
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    out.push({ match: m[0], start: m.index, end: m.index + m[0].length });
    if (m[0] === "") re.lastIndex++; // avoid infinite loop on zero-width
  }
  return out;
}

/** Determine if an offset is inside a code span (`...`) or URL-like token. */
export function isProtected(text: string, offset: number): boolean {
  // Code span — backtick before offset and another backtick after (within same line)
  const before = text.slice(0, offset);
  const after = text.slice(offset);
  const backticksBefore = (before.match(/`/g) ?? []).length;
  const backticksAfter = (after.match(/`/g) ?? []).length;
  if (backticksBefore % 2 === 1 && backticksAfter % 2 === 1) return true;
  // URL — `http`, `https`, `www` in the same word
  const lineStart = text.lastIndexOf("\n", offset) + 1;
  const lineEndIdx = text.indexOf("\n", offset);
  const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;
  const line = text.slice(lineStart, lineEnd);
  if (/\bhttps?:\/\/\S+|\bwww\.\S+/i.test(line)) return true;
  return false;
}

/** Extract the word at an offset (alphanumeric + apostrophe). Returns null if the offset is on whitespace/punctuation. */
export function wordAt(text: string, offset: number): { word: string; start: number; end: number } | null {
  if (offset < 0 || offset >= text.length) return null;
  if (!/[A-Za-z0-9']/.test(text[offset])) return null;
  let start = offset;
  while (start > 0 && /[A-Za-z0-9']/.test(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && /[A-Za-z0-9']/.test(text[end])) end++;
  if (start === end) return null;
  return { word: text.slice(start, end), start, end };
}

// ---------- Rule families ----------

/** Detect "i" (lowercase) used as the pronoun and flag for capitalization. */
export function checkCapitalization(text: string): Issue[] {
  const issues: Issue[] = [];
  // 1) " i " or " i'" (contractions like i'm, i'll)
  for (const m of findAll(/\bi\b/g, text)) {
    if (m.match !== "i") continue;
    if (isProtected(text, m.start)) continue;
    issues.push({
      id: genId(),
      category: "capitalization",
      start: m.start,
      end: m.end,
      original: m.match,
      suggestion: "I",
      explanation: "The pronoun \"I\" is always capitalized.",
      severity: "error",
    });
  }
  // 2) Sentence-start: first non-space char of each sentence should be uppercase
  for (const m of findAll(/(^|[.!?]\s+)([a-z])/g, text)) {
    const letterIdx = m.start + m.match.length - 1;
    const letter = m.match[m.match.length - 1];
    if (isProtected(text, letterIdx)) continue;
    issues.push({
      id: genId(),
      category: "capitalization",
      start: letterIdx,
      end: letterIdx + 1,
      original: letter,
      suggestion: letter.toUpperCase(),
      explanation: "Capitalize the first letter of a sentence.",
      severity: "error",
    });
  }
  // 3) Days and months
  for (const noun of PROPER_NOUNS) {
    const re = new RegExp(`\\b${noun}\\b`, "gi");
    for (const m of findAll(re, text)) {
      if (m.match === noun.charAt(0).toUpperCase() + noun.slice(1)) continue;
      if (m.match === noun.toUpperCase()) continue; // all-caps is fine inside acronyms
      // Skip sentence-start (already flagged above)
      const before = text.slice(0, m.start);
      if (/(^|[.!?]\s+)$/.test(before)) continue;
      if (isProtected(text, m.start)) continue;
      issues.push({
        id: genId(),
        category: "capitalization",
        start: m.start,
        end: m.end,
        original: m.match,
        suggestion: noun.charAt(0).toUpperCase() + noun.slice(1),
        explanation: `Capitalize proper nouns — ${noun.charAt(0).toUpperCase() + noun.slice(1)} is a day or month.`,
        severity: "warning",
      });
    }
  }
  return issues;
}

/** Check for a/an agreement based on the next word. */
export function checkArticles(text: string): Issue[] {
  const issues: Issue[] = [];
  // "a" followed by a word starting with a vowel sound
  for (const m of findAll(/\b(a)\s+([A-Za-z]+)/g, text)) {
    const articleIdx = m.start;
    const articleEnd = m.start + 1;
    const nextWordMatch = m.match.match(/([A-Za-z]+)$/);
    if (!nextWordMatch) continue;
    const nextWord = nextWordMatch[1];
    if (!startsWithVowelSound(nextWord)) continue;
    if (isProtected(text, articleIdx)) continue;
    issues.push({
      id: genId(),
      category: "article",
      start: articleIdx,
      end: articleEnd,
      original: "a",
      suggestion: "an",
      explanation: `Use "an" before "${nextWord}" because it starts with a vowel sound.`,
      severity: "error",
    });
  }
  // "an" followed by a word starting with a consonant sound
  for (const m of findAll(/\b(an)\s+([A-Za-z]+)/g, text)) {
    const articleIdx = m.start;
    const articleEnd = m.start + 2;
    const nextWordMatch = m.match.match(/([A-Za-z]+)$/);
    if (!nextWordMatch) continue;
    const nextWord = nextWordMatch[1];
    if (startsWithVowelSound(nextWord)) continue;
    if (isProtected(text, articleIdx)) continue;
    issues.push({
      id: genId(),
      category: "article",
      start: articleIdx,
      end: articleEnd,
      original: "an",
      suggestion: "a",
      explanation: `Use "a" before "${nextWord}" because it starts with a consonant sound.`,
      severity: "error",
    });
  }
  return issues;
}

/** Check subject-verb agreement for is/are, was/were, has/have, do/does, don't/doesn't. */
export function checkGrammar(text: string): Issue[] {
  const issues: Issue[] = [];

  // Helper: find the subject noun phrase (very rough — look back 1-2 words).
  function subjectBefore(offset: number): string {
    const before = text.slice(0, offset).trim();
    const tokens = before.split(/\s+/);
    return tokens[tokens.length - 1] ?? "";
  }

  // "I is" → "I am"; "he are" → "he is"; "they is" → "they are"; "we was" → "we were"
  // Subject pronouns
  const PRONOUNS_PLURAL = new Set(["we", "you", "they"]);
  const PRONOUNS_SINGULAR = new Set(["i", "he", "she", "it"]);

  // is/are after pronoun
  for (const m of findAll(/\b(we|you|they)\s+(is)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("is");
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 2,
      original: text.slice(verbOffset, verbOffset + 2),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 2), "are"),
      explanation: `Use "are" with the plural pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  for (const m of findAll(/\b(he|she|it)\s+(are)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("are");
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 3,
      original: text.slice(verbOffset, verbOffset + 3),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 3), "is"),
      explanation: `Use "is" with the singular pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  // was/were after pronoun
  for (const m of findAll(/\b(we|you|they)\s+(was)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("was");
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 3,
      original: text.slice(verbOffset, verbOffset + 3),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 3), "were"),
      explanation: `Use "were" with the plural pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  for (const m of findAll(/\b(he|she|it)\s+(were)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("were");
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 4,
      original: text.slice(verbOffset, verbOffset + 4),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 4), "was"),
      explanation: `Use "was" with the singular pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  // has/have after pronoun
  for (const m of findAll(/\b(we|you|they)\s+(has)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("has");
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 3,
      original: text.slice(verbOffset, verbOffset + 3),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 3), "have"),
      explanation: `Use "have" with the plural pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  for (const m of findAll(/\b(he|she|it)\s+(have)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("have");
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 4,
      original: text.slice(verbOffset, verbOffset + 4),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 4), "has"),
      explanation: `Use "has" with the singular pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  // do/does after pronoun
  for (const m of findAll(/\b(he|she|it)\s+(do)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("do");
    // Make sure it's not 'does'
    if (text.slice(verbOffset, verbOffset + 4).toLowerCase() === "does") continue;
    if (isProtected(text, verbOffset)) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + 2,
      original: text.slice(verbOffset, verbOffset + 2),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + 2), "does"),
      explanation: `Use "does" with the singular pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }
  // don't vs doesn't
  for (const m of findAll(/\b(he|she|it)\s+(don't|dont)\b/gi, text)) {
    const verbOffset = m.start + m.match.toLowerCase().indexOf("don");
    if (isProtected(text, verbOffset)) continue;
    const original = text.slice(verbOffset, verbOffset + (m.match.toLowerCase().includes("'") ? 5 : 4));
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + original.length,
      original,
      suggestion: preserveCase(original, "doesn't"),
      explanation: `Use "doesn't" with the singular pronoun "${m.match.split(/\s+/)[0]}".`,
      severity: "error",
    });
  }

  // "he don't" → "he doesn't" already handled above.
  // Generic verb-s mismatch: simple "X (singular noun) are" heuristic.
  // Skip — too noisy without a real noun detector.

  // Plural-noun + is/are check (very rough): "books is", "the cars was"
  // We rely on simple '-s' plural detection.
  for (const m of findAll(/\b([A-Za-z]+s)\s+(is|was|has|does)\b/g, text)) {
    const noun = m.match.split(/\s+/)[0];
    // Exclude known singular '-s' words
    const singularExceptions = new Set([
      "news", "mathematics", "physics", "politics", "athletics", "economics",
      "series", "species", "means", "headquarters", "gas", "bus", "plus",
      "this", "always", "towards", "perhaps", "since", "thus",
    ]);
    if (singularExceptions.has(noun.toLowerCase())) continue;
    if (noun.toLowerCase().endsWith("ss") || noun.toLowerCase().endsWith("us") || noun.toLowerCase().endsWith("is")) {
      continue;
    }
    const verb = m.match.split(/\s+/)[1].toLowerCase();
    const verbOffset = m.start + m.match.toLowerCase().indexOf(verb);
    if (isProtected(text, verbOffset)) continue;
    const map: Record<string, string> = { is: "are", was: "were", has: "have", does: "do" };
    const suggestion = map[verb];
    if (!suggestion) continue;
    issues.push({
      id: genId(),
      category: "grammar",
      start: verbOffset,
      end: verbOffset + verb.length,
      original: text.slice(verbOffset, verbOffset + verb.length),
      suggestion: preserveCase(text.slice(verbOffset, verbOffset + verb.length), suggestion),
      explanation: `Use "${suggestion}" with the plural noun "${noun}".`,
      severity: "warning",
    });
  }

  // Suppress unused-warning for helper (kept for clarity / future use)
  void subjectBefore;

  return issues;
}

/** Punctuation: double spaces, missing terminal period, comma spacing, repeated punctuation. */
export function checkPunctuation(text: string): Issue[] {
  const issues: Issue[] = [];
  // Double spaces
  for (const m of findAll(/ {2,}/g, text)) {
    if (isProtected(text, m.start)) continue;
    issues.push({
      id: genId(),
      category: "punctuation",
      start: m.start,
      end: m.end,
      original: m.match,
      suggestion: " ",
      explanation: "Use a single space between words.",
      severity: "style",
    });
  }
  // Space before punctuation: " ," " ." " ;" " :"
  for (const m of findAll(/\s+([,.;:!?])/g, text)) {
    const punctIdx = m.start + m.match.length - 1;
    if (isProtected(text, punctIdx)) continue;
    issues.push({
      id: genId(),
      category: "punctuation",
      start: m.start,
      end: punctIdx + 1,
      original: m.match,
      suggestion: m.match[m.match.length - 1],
      explanation: "Remove the space before punctuation.",
      severity: "style",
    });
  }
  // Repeated punctuation: "..." (3 dots) is fine; 4+ or 2 is not
  for (const m of findAll(/\.{2,}/g, text)) {
    if (m.match.length === 3) continue;
    if (isProtected(text, m.start)) continue;
    issues.push({
      id: genId(),
      category: "punctuation",
      start: m.start,
      end: m.end,
      original: m.match,
      suggestion: m.match.length > 3 ? "..." : ".",
      explanation: m.match.length === 2 ? "Use a single period or an ellipsis (...)." : "Use exactly three dots for an ellipsis.",
      severity: "style",
    });
  }
  // Repeated ! or ?
  for (const m of findAll(/!{2,}|\?{2,}/g, text)) {
    if (isProtected(text, m.start)) continue;
    issues.push({
      id: genId(),
      category: "punctuation",
      start: m.start,
      end: m.end,
      original: m.match,
      suggestion: m.match[0],
      explanation: "Use a single exclamation or question mark for clarity.",
      severity: "style",
    });
  }
  // Missing terminal period: a sentence-ending word with no punctuation at the very end (only if it looks like a sentence)
  const trimmed = text.trim();
  if (trimmed && !/[.!?]["')\]]?$/.test(trimmed) && /\b[A-Z][a-z]+\s+[a-z]+\b/.test(trimmed)) {
    const endIdx = trimmed.length;
    issues.push({
      id: genId(),
      category: "punctuation",
      start: endIdx,
      end: endIdx,
      original: "",
      suggestion: ".",
      explanation: "Add a period at the end of the sentence.",
      severity: "warning",
    });
  }
  return issues;
}

/** Common confusions: their/there/they're, your/you're, its/it's, to/too, then/than. */
export function checkConfusions(text: string): Issue[] {
  const issues: Issue[] = [];

  // 1) "their is/are/was/were/going" → "they're ..."
  for (const m of findAll(/\b(their)\s+(is|are|was|were|going|coming|leaving|happy|sad|here|there)\b/gi, text)) {
    const wordIdx = m.start;
    const wordEnd = wordIdx + 5; // "their"
    if (isProtected(text, wordIdx)) continue;
    issues.push({
      id: genId(),
      category: "confusion",
      start: wordIdx,
      end: wordEnd,
      original: text.slice(wordIdx, wordEnd),
      suggestion: preserveCase(text.slice(wordIdx, wordEnd), "they're"),
      explanation: "Use \"they're\" (they are) before a verb or action. \"Their\" is possessive.",
      severity: "error",
    });
  }
  // 2) "your is/are/going/welcome" → "you're ..."
  for (const m of findAll(/\b(your)\s+(is|are|was|were|going|coming|welcome|right|wrong|here|there)\b/gi, text)) {
    const wordIdx = m.start;
    const wordEnd = wordIdx + 4; // "your"
    if (isProtected(text, wordIdx)) continue;
    issues.push({
      id: genId(),
      category: "confusion",
      start: wordIdx,
      end: wordEnd,
      original: text.slice(wordIdx, wordEnd),
      suggestion: preserveCase(text.slice(wordIdx, wordEnd), "you're"),
      explanation: "Use \"you're\" (you are) before a verb or adjective. \"Your\" is possessive.",
      severity: "error",
    });
  }
  // 3) "its a/an/the" → "it's ..."
  for (const m of findAll(/\b(its)\s+(a|an|the|been|going|coming|not|time|raining)\b/gi, text)) {
    const wordIdx = m.start;
    const wordEnd = wordIdx + 3; // "its"
    if (isProtected(text, wordIdx)) continue;
    issues.push({
      id: genId(),
      category: "confusion",
      start: wordIdx,
      end: wordEnd,
      original: text.slice(wordIdx, wordEnd),
      suggestion: preserveCase(text.slice(wordIdx, wordEnd), "it's"),
      explanation: "Use \"it's\" (it is / it has) before an article or verb. \"Its\" is possessive.",
      severity: "error",
    });
  }
  // 4) "to <adverb-of-excess>" → "too"
  for (const m of findAll(/\b(to)\s+(much|many|late|early|hard|easy|fast|slow|big|small|long|short|good|bad)\b/gi, text)) {
    const wordIdx = m.start;
    const wordEnd = wordIdx + 2; // "to"
    if (isProtected(text, wordIdx)) continue;
    issues.push({
      id: genId(),
      category: "confusion",
      start: wordIdx,
      end: wordEnd,
      original: text.slice(wordIdx, wordEnd),
      suggestion: preserveCase(text.slice(wordIdx, wordEnd), "too"),
      explanation: "Use \"too\" for \"excessively\" or \"also\". \"To\" is the preposition.",
      severity: "error",
    });
  }
  // 5) "more <adj> then" → "than"
  for (const m of findAll(/\b(more|less|fewer|better|worse|faster|slower|bigger|smaller|higher|lower)\s+\S+\s+(then)\b/gi, text)) {
    const wordIdx = m.start + m.match.toLowerCase().lastIndexOf("then");
    const wordEnd = wordIdx + 4; // "then"
    if (isProtected(text, wordIdx)) continue;
    issues.push({
      id: genId(),
      category: "confusion",
      start: wordIdx,
      end: wordEnd,
      original: text.slice(wordIdx, wordEnd),
      suggestion: preserveCase(text.slice(wordIdx, wordEnd), "than"),
      explanation: "Use \"than\" for comparisons. \"Then\" refers to time or sequence.",
      severity: "error",
    });
  }

  return issues;
}

/** Spelling checks against the dictionary. */
export function checkSpelling(text: string): Issue[] {
  const issues: Issue[] = [];
  const re = /\b[A-Za-z']+\b/g;
  for (const m of findAll(re, text)) {
    const word = m.match.toLowerCase();
    const correction = SPELLING_DICT[word];
    if (!correction) continue;
    if (correction === word) continue;
    if (isProtected(text, m.start)) continue;
    issues.push({
      id: genId(),
      category: "spelling",
      start: m.start,
      end: m.end,
      original: m.match,
      suggestion: preserveCase(m.match, correction),
      explanation: `"${m.match}" is a common misspelling of "${correction}".`,
      severity: "error",
    });
  }
  return issues;
}

// ---------- Run all rules ----------

/** Run all rule families and return a combined CheckResult. Capitalization runs last so that more-specific rules (article, confusion, grammar) win when they fire on the same offset as a sentence-start capitalization. */
export function checkText(text: string): CheckResult {
  const original = text || "";
  const issues: Issue[] = [
    ...checkArticles(original),
    ...checkGrammar(original),
    ...checkConfusions(original),
    ...checkSpelling(original),
    ...checkPunctuation(original),
    ...checkCapitalization(original),
  ];
  // Sort by offset; if two issues overlap, keep the first (longer/more-specific match wins via end DESC).
  issues.sort((a, b) => a.start - b.start || b.end - a.end);
  const deduped: Issue[] = [];
  let lastEnd = -1;
  for (const i of issues) {
    if (i.start < lastEnd) continue; // overlaps with a previous fix
    deduped.push(i);
    lastEnd = Math.max(lastEnd, i.end);
  }
  const stats = computeStats(original, deduped);
  return { original, issues: deduped, stats };
}

/** Compute statistics and readability. */
export function computeStats(text: string, issues: Issue[]): Stats {
  const byCategory: Record<IssueCategory, number> = {
    grammar: 0, article: 0, punctuation: 0,
    capitalization: 0, confusion: 0, spelling: 0,
  };
  const bySeverity = { error: 0, warning: 0, style: 0 };
  for (const i of issues) {
    byCategory[i.category] += 1;
    bySeverity[i.severity] += 1;
  }
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);
  const readability = computeReadability(text);
  return {
    totalIssues: issues.length,
    byCategory,
    bySeverity,
    wordCount,
    sentenceCount,
    characters: text.length,
    readability,
  };
}

/** Compute Flesch reading ease + grade level + passive-voice count. */
export function computeReadability(text: string): Readability {
  const words = (text.match(/\S+/g) ?? []).filter((w) => /[A-Za-z]/.test(w));
  const wordCount = words.length || 1;
  const sentenceCount = Math.max(1, countSentences(text));
  let syllableCount = 0;
  for (const w of words) syllableCount += countSyllables(w);
  const fleschReadingEase = 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
  const fleschGradeLevel = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
  // Passive voice: count occurrences of "was/were/is/are/been/be + <past participle>" (rough heuristic)
  const passiveMatches = text.match(/\b(?:was|were|is|are|been|be|being)\s+[a-z]+ed\b/gi) ?? [];
  // Long sentence: > 25 words
  const sentences = text.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim());
  const longSentenceCount = sentences.filter((s) => countWords(s) > 25).length;
  return {
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschGradeLevel: Math.round(fleschGradeLevel * 10) / 10,
    passiveVoiceCount: passiveMatches.length,
    longSentenceCount,
    avgWordsPerSentence: Math.round((wordCount / sentenceCount) * 10) / 10,
  };
}

// ---------- Apply suggestions ----------

/** Apply a single issue's suggestion to the original text. */
export function applySuggestion(text: string, issue: Issue): string {
  return text.slice(0, issue.start) + issue.suggestion + text.slice(issue.end);
}

/** Apply a list of issues to the original text. Offsets are recomputed for each issue in order. */
export function applyAll(text: string, issues: Issue[]): string {
  // Sort by offset descending so earlier slices remain valid.
  const sorted = [...issues].sort((a, b) => b.start - a.start);
  let out = text;
  for (const i of sorted) {
    out = out.slice(0, i.start) + i.suggestion + out.slice(i.end);
  }
  return out;
}

/** Filter issues by category. */
export function filterByCategory(issues: Issue[], category: IssueCategory): Issue[] {
  return issues.filter((i) => i.category === category);
}

/** Apply all issues in a single category (bulk accept-by-type). */
export function applyByCategory(text: string, issues: Issue[], category: IssueCategory): { text: string; applied: number } {
  const subset = filterByCategory(issues, category);
  return { text: applyAll(text, subset), applied: subset.length };
}

/** Reject (dismiss) an issue id from the list. */
export function dismissIssue(issues: Issue[], id: string): Issue[] {
  return issues.filter((i) => i.id !== id);
}

// ---------- Diff view ----------

/** Build a diff between the original and corrected text (line-level, naive LCS). */
export function buildDiff(original: string, corrected: string): DiffSegment[] {
  const a = original.split(/(\s+)/);
  const b = corrected.split(/(\s+)/);
  const n = a.length;
  const m = b.length;
  // DP table for LCS
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const out: DiffSegment[] = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      out.push({ type: "equal", text: a[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      out.push({ type: "delete", text: a[i - 1] });
      i--;
    } else {
      out.push({ type: "insert", text: b[j - 1] });
      j--;
    }
  }
  while (i > 0) { out.push({ type: "delete", text: a[i - 1] }); i--; }
  while (j > 0) { out.push({ type: "insert", text: b[j - 1] }); j--; }
  out.reverse();
  // Merge consecutive same-type segments
  const merged: DiffSegment[] = [];
  for (const seg of out) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type) last.text += seg.text;
    else merged.push({ ...seg });
  }
  return merged;
}

/** Render the diff as HTML with spans for insert/delete. */
export function renderDiffHtml(diff: DiffSegment[]): string {
  const parts: string[] = [];
  for (const seg of diff) {
    const esc = escapeHtml(seg.text);
    if (seg.type === "equal") parts.push(esc);
    else if (seg.type === "insert") parts.push(`<ins style="background:#bbf7d0;text-decoration:none">${esc}</ins>`);
    else parts.push(`<del style="background:#fecaca;text-decoration:none">${esc}</del>`);
  }
  return parts.join("");
}

// ---------- Highlight rendering ----------

/** Render the original text with highlights wrapping each issue. */
export function renderHighlightedHtml(text: string, issues: Issue[]): string {
  const sorted = [...issues].sort((a, b) => b.start - a.start);
  let html = escapeHtml(text);
  // Need to map offsets into the escaped HTML — easier: escape per-segment.
  html = "";
  let cursor = 0;
  const sortedAsc = [...issues].sort((a, b) => a.start - b.start);
  for (const i of sortedAsc) {
    if (i.start < cursor) continue; // overlap, skip
    html += escapeHtml(text.slice(cursor, i.start));
    const color = CATEGORY_COLORS[i.category];
    const inner = escapeHtml(text.slice(i.start, i.end)) || "•";
    const title = escapeHtml(i.explanation);
    html += `<mark style="background:${color}22;border-bottom:2px solid ${color};padding:0 1px;border-radius:2px" title="${title}" data-cat="${i.category}">${inner}</mark>`;
    cursor = i.end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

// ---------- Renderers ----------

/** Render the corrected text as plain text (for copy). */
export function renderCorrected(result: CheckResult): string {
  return applyAll(result.original, result.issues);
}

/** Render the corrected text wrapped in a simple HTML document. */
export function renderHtmlDocument(result: CheckResult): string {
  const corrected = escapeHtml(renderCorrected(result));
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Corrected Text</title>",
    "</head>",
    "<body>",
    `<pre style="white-space: pre-wrap; font-family: system-ui, sans-serif; line-height: 1.6">${corrected}</pre>`,
    "</body>",
    "</html>",
  ].join("\n");
}

/** Render the issue list as Markdown. */
export function renderMarkdown(result: CheckResult): string {
  const lines: string[] = [];
  lines.push(`# Grammar report`);
  lines.push("");
  lines.push(`- Total issues: **${result.stats.totalIssues}**`);
  lines.push(`- Words: ${result.stats.wordCount}`);
  lines.push(`- Sentences: ${result.stats.sentenceCount}`);
  lines.push(`- Flesch reading ease: ${result.stats.readability.fleschReadingEase}`);
  lines.push(`- Flesch grade level: ${result.stats.readability.fleschGradeLevel}`);
  lines.push("");
  lines.push("## Issues by category");
  for (const cat of Object.keys(CATEGORY_LABELS) as IssueCategory[]) {
    const count = result.stats.byCategory[cat];
    lines.push(`- ${CATEGORY_LABELS[cat]}: ${count}`);
  }
  lines.push("");
  if (result.issues.length === 0) {
    lines.push("_No issues found._");
    return lines.join("\n");
  }
  lines.push("## Issues");
  for (const i of result.issues) {
    lines.push(`### ${CATEGORY_LABELS[i.category]} — ${SEVERITY_LABELS[i.severity]}`);
    lines.push(`- Original: \`${i.original || "(missing)"}\``);
    lines.push(`- Suggestion: \`${i.suggestion || "(remove)"}\``);
    lines.push(`- Explanation: ${i.explanation}`);
    lines.push("");
  }
  return lines.join("\n");
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

/** Load the session ignore list (issue ids that the user dismissed). */
export function loadIgnoreList(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(IGNORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr as string[] : [];
  } catch {
    return [];
  }
}

export function saveIgnoreList(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(IGNORE_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    // ignore
  }
}

export function clearIgnoreList(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(IGNORE_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.text) params.set("text", state.text);
  if (state.lang && state.lang !== "en") params.set("lang", state.lang);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", lang: "en" };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const lang = params.get("lang") ?? "en";
  return { text, lang };
}

// ---------- Optional LLM prompt builder ----------

export function buildLlmPrompt(text: string, lang: string): LlmPrompt {
  const system = [
    "You are a careful grammar editor.",
    `Edit the following ${lang === "en" ? "English" : lang} text for grammar, spelling, punctuation, capitalization, and clarity.`,
    "Preserve the original meaning and tone. Do not rewrite or paraphrase beyond corrections.",
    "Return ONLY the corrected text — no commentary, no markdown fences.",
  ].join(" ");
  const user = text || "(no text)";
  return { system, user };
}

/** Parse a raw LLM response into a corrected-text string. */
export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}
