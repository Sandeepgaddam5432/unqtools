/**
 * Sentence Splitter — pure logic.
 * Splits text into sentences, aware of common abbreviations, quotes, and custom delimiters.
 */

/** Common English abbreviations that should NOT end a sentence. */
export const DEFAULT_ABBREVIATIONS = [
  "Mr", "Mrs", "Ms", "Dr", "Prof", "Sr", "Jr", "St", "Rev", "Hon", "Sgt", "Cpl", "Capt", "Lt", "Col", "Gen", "Maj",
  "Inc", "Ltd", "Co", "Corp", "Bros",
  "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
  "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
  "etc", "vs", "viz", "e.g", "i.e", "cf", "approx", "dept", "est", "min", "max", "avg",
  "U.S", "U.K", "E.U", "U.A.E", "D.C", "N.Y", "L.A",
  "Ph.D", "M.D", "B.A", "M.A", "B.S", "M.S", "M.B.A",
  "a.m", "p.m", "A.D", "B.C", "BCE", "CE",
  "No", "Vol", "pp", "ch", "sec", "fig", "pt", "def",
];

/** Common sentence-starter words. If an abbreviation is followed by space + one of these (capitalized), it's a new sentence. */
const SENTENCE_STARTERS = new Set([
  "The", "A", "An", "It", "He", "She", "They", "We", "I", "You", "This", "That", "These", "Those",
  "But", "And", "Or", "So", "Because", "When", "Where", "Why", "How", "What", "Who", "Then", "Now",
  "Here", "There", "However", "Therefore", "Also", "Additionally", "Meanwhile", "Finally", "First",
  "Second", "Next", "Yesterday", "Today", "Tomorrow", "Eventually", "Suddenly", "Afterward", "Later",
  "If", "Unless", "Although", "Though", "While", "Whereas", "Since", "As", "Until", "Before", "After",
]);

/** Pattern for acronym-style abbreviations (single uppercase letters separated by periods). */
const ACRONYM_PATTERN = /^([A-Z]\.)+[A-Z]?$/;

export interface SplitOptions {
  abbreviations?: string[];
  /** Custom delimiters (characters) to split on. Defaults to . ! ? */
  delimiters?: string[];
  /** Whether to keep the delimiter at the end of each sentence. */
  keepDelimiter?: boolean;
  /** Whether to trim whitespace around each sentence. */
  trim?: boolean;
  /** Whether to skip empty sentences. */
  skipEmpty?: boolean;
  /** Whether to handle quotes (don't split inside quotes). */
  respectQuotes?: boolean;
}

/** Split text into sentences. */
export function splitSentences(text: string, options: SplitOptions = {}): string[] {
  const abbreviations = options.abbreviations ?? DEFAULT_ABBREVIATIONS;
  const delimiters = options.delimiters ?? [".", "!", "?"];
  const keepDelimiter = options.keepDelimiter ?? true;
  const trim = options.trim ?? true;
  const skipEmpty = options.skipEmpty ?? true;
  const respectQuotes = options.respectQuotes ?? true;

  const sentences: string[] = [];
  let current = "";
  let inQuote: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = text[i - 1] ?? "";
    const next = text[i + 1] ?? "";

    // Track quote state — detect closing quote BEFORE toggling
    let isClosingQuote = false;
    if (respectQuotes && inQuote !== null && (ch === '"' || ch === "”")) {
      if ((inQuote === '"' && ch === '"') || (inQuote === '"' && ch === "”")) {
        isClosingQuote = true;
      }
    }
    if (respectQuotes && (ch === '"' || ch === "'" || ch === "“" || ch === "”" || ch === "‘" || ch === "’")) {
      if (inQuote === ch) {
        inQuote = null;
      } else if (inQuote === null && (ch === '"' || ch === "“")) {
        inQuote = '"';
      } else if (inQuote === null && (ch === "'" || ch === "‘")) {
        // Apostrophe vs single quote — heuristic: only treat as quote if preceded by whitespace/punctuation
        if (/\s|[.,!?;:()\[\]{}]/.test(prev) || prev === "") {
          inQuote = "'";
        }
      } else if (inQuote === '"' && (ch === "”")) {
        inQuote = null;
      } else if (inQuote === "'" && (ch === "’")) {
        inQuote = null;
      }
    }

    current += ch;

    // Detect end-of-quote with a preceding delimiter (commit sentence)
    if (isClosingQuote) {
      // Check if char before the closing quote was a delimiter
      const before = current.slice(0, -1).trimEnd();
      if (before.length > 0 && delimiters.includes(before[before.length - 1])) {
        let sentence = current;
        if (trim) sentence = sentence.trim();
        if (!skipEmpty || sentence.length > 0) sentences.push(sentence);
        current = "";
      }
    }

    if (delimiters.includes(ch) && !inQuote) {
      // Check if this is an abbreviation: look back at the word before the delimiter.
      const wordMatch = current.match(/\b([A-Za-z][A-Za-z.]*)\.$$/);
      if (wordMatch) {
        const word = wordMatch[1].replace(/\.$/, "");
        const isInAbbrevList = abbreviations.some((ab) => ab.toLowerCase() === word.toLowerCase());
        const isAcronymPattern = ACRONYM_PATTERN.test(word);
        const isSingleUpper = word.length === 1 && /[A-Z]/.test(word);
        if (isInAbbrevList) {
          // Multi-period abbreviations (U.S., Ph.D.) may end a sentence
          // if followed by a common sentence-starter. Single-word abbreviations
          // (Dr, Mr, Frobnicate) always continue — don't split.
          if (word.includes(".") && next === " " && text[i + 2]) {
            const rest = text.slice(i + 2).match(/^([A-Za-z]+)/);
            if (rest && SENTENCE_STARTERS.has(rest[1])) {
              // Fall through to commit (split here)
            } else {
              continue;
            }
          } else {
            continue;
          }
        } else if (isAcronymPattern || isSingleUpper) {
          // Initials like "J.R.R." or "U.S." (when not in list) — don't split
          continue;
        }
      }
      // Check if next char is a digit (e.g. "3.14" — not a sentence end)
      if (/\d/.test(next)) continue;
      // Check if next char is a letter (lowercase) — likely not end of sentence
      if (next && /[a-z]/.test(next) && next !== " ") continue;
      // Commit sentence
      let sentence = current;
      if (trim) sentence = sentence.trim();
      if (!skipEmpty || sentence.length > 0) sentences.push(sentence);
      current = "";
    }
  }
  if (current.length > 0) {
    let s = current;
    if (trim) s = s.trim();
    if (!skipEmpty || s.length > 0) sentences.push(s);
  }

  // If keepDelimiter is false, strip trailing delimiters
  if (!keepDelimiter) {
    return sentences.map((s) => s.replace(/[.!?]+$/, "").trim()).filter((s) => !skipEmpty || s.length > 0);
  }
  return sentences;
}

/** Join sentences back into a paragraph with proper spacing. */
export function joinSentences(sentences: string[], separator = " "): string {
  return sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Ensure each sentence ends with punctuation
      if (!/[.!?]$/.test(s)) s += ".";
      return s;
    })
    .join(separator);
}

/** Get sentence statistics: count, avg length, longest, shortest. */
export function sentenceStats(text: string, options: SplitOptions = {}): {
  count: number;
  avgWords: number;
  avgChars: number;
  longest: { text: string; words: number };
  shortest: { text: string; words: number };
} {
  const sentences = splitSentences(text, options);
  if (sentences.length === 0) {
    return { count: 0, avgWords: 0, avgChars: 0, longest: { text: "", words: 0 }, shortest: { text: "", words: 0 } };
  }
  const withCounts = sentences.map((s) => ({ text: s, words: s.split(/\s+/).filter(Boolean).length }));
  const totalWords = withCounts.reduce((sum, s) => sum + s.words, 0);
  const totalChars = withCounts.reduce((sum, s) => sum + s.text.length, 0);
  const longest = withCounts.reduce((a, b) => (b.words > a.words ? b : a));
  const shortest = withCounts.reduce((a, b) => (b.words < a.words ? b : a));
  return {
    count: sentences.length,
    avgWords: Math.round(totalWords / sentences.length),
    avgChars: Math.round(totalChars / sentences.length),
    longest,
    shortest,
  };
}

/** Format sentences as a numbered list. */
export function formatAsList(sentences: string[], format: "numbered" | "bulleted" | "plain" = "numbered"): string {
  return sentences
    .map((s, i) => {
      if (format === "numbered") return `${i + 1}. ${s}`;
      if (format === "bulleted") return `• ${s}`;
      return s;
    })
    .join("\n");
}

/** Detect language-heuristic: split heuristically for languages without spaces (CJK). */
export function splitCJK(text: string): string[] {
  // CJK sentences end with 。！？ etc.
  return text
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Add a custom abbreviation to a list. */
export function addAbbreviation(list: string[], abbr: string): string[] {
  if (!abbr.trim()) return list;
  return [...new Set([...list, abbr.trim()])];
}

/** Parse a user-provided abbreviation list (comma or newline separated). */
export function parseAbbreviations(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Detect potential split errors: sentences starting with lowercase (may indicate missed split). */
export function detectIssues(text: string, options: SplitOptions = {}): { type: string; sample: string }[] {
  const issues: { type: string; sample: string }[] = [];
  const sentences = splitSentences(text, options);
  for (const s of sentences) {
    const first = s.trim()[0];
    if (first && /[a-z]/.test(first)) {
      issues.push({ type: "lowercase-start", sample: s.slice(0, 60) });
    }
    // Very long sentence (>40 words) might be a missed split
    if (s.split(/\s+/).length > 40) {
      issues.push({ type: "long-sentence", sample: s.slice(0, 60) + "…" });
    }
  }
  return issues;
}

/** Validate options. */
export function validateOptions(options: SplitOptions): string[] {
  const errs: string[] = [];
  if (options.delimiters && options.delimiters.length === 0) errs.push("Delimiters cannot be empty");
  if (options.minItems && options.minItems < 0) errs.push("minItems must be ≥ 0");
  return errs;
}

/** Estimate reading time in seconds (200 wpm average). */
export function readingTime(text: string, wpm = 200): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / wpm) * 60);
}

/** Filter sentences by word count range. */
export function filterByLength(sentences: string[], min: number, max: number): string[] {
  return sentences.filter((s) => {
    const wc = s.split(/\s+/).filter(Boolean).length;
    return wc >= min && wc <= max;
  });
}

/** Highlight the sentence at a given index (returns original with [START]/[END] markers). */
export function highlightSentence(sentences: string[], index: number): string {
  return sentences
    .map((s, i) => (i === index ? `[START] ${s} [END]` : s))
    .join(" ");
}
