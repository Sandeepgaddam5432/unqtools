/**
 * People Also Ask Extractor — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export type QuestionWord = "what" | "how" | "why" | "when" | "where" | "who" | "which";

export interface QuestionResult {
  question: string;
  word: QuestionWord;
  template: string;
  seed: string;
}

export interface ExtractionResult {
  questions: QuestionResult[];
  total: number;
  duplicatesRemoved: number;
  byWord: Record<QuestionWord, number>;
}

export interface ExtractionOptions {
  words: QuestionWord[];
  templates: string[]; // template names
}

export const ALL_WORDS: QuestionWord[] = [
  "what", "how", "why", "when", "where", "who", "which",
];

export const TEMPLATES: Record<string, { word: QuestionWord; fn: (seed: string) => string }[]> = {
  basic: [
    { word: "what", fn: (s) => `What is ${s}?` },
    { word: "what", fn: (s) => `What are ${s}?` },
    { word: "how", fn: (s) => `How to ${s}?` },
    { word: "how", fn: (s) => `How does ${s} work?` },
    { word: "why", fn: (s) => `Why is ${s} important?` },
    { word: "why", fn: (s) => `Why use ${s}?` },
    { word: "when", fn: (s) => `When to use ${s}?` },
    { word: "where", fn: (s) => `Where to find ${s}?` },
    { word: "who", fn: (s) => `Who uses ${s}?` },
    { word: "which", fn: (s) => `Which ${s} is best?` },
  ],
  comparative: [
    { word: "what", fn: (s) => `What is the difference between ${s} and alternatives?` },
    { word: "which", fn: (s) => `Which ${s} is better?` },
    { word: "how", fn: (s) => `How does ${s} compare to others?` },
  ],
  "how-many": [
    { word: "how", fn: (s) => `How much does ${s} cost?` },
    { word: "how", fn: (s) => `How many ${s} do I need?` },
  ],
  "how-long": [
    { word: "how", fn: (s) => `How long does ${s} take?` },
    { word: "how", fn: (s) => `How long until ${s} works?` },
  ],
  "best-of": [
    { word: "what", fn: (s) => `What are the best ${s}?` },
    { word: "what", fn: (s) => `What is the best ${s}?` },
  ],
  people: [
    { word: "who", fn: (s) => `Who needs ${s}?` },
    { word: "who", fn: (s) => `Who created ${s}?` },
    { word: "who", fn: (s) => `Who should use ${s}?` },
  ],
};

export const ALL_TEMPLATE_NAMES = Object.keys(TEMPLATES);

/** Parse bulk seed input (newline or comma). */
export function parseSeeds(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Dedup questions (case-insensitive). */
export function dedupQuestions(
  questions: QuestionResult[],
): { unique: QuestionResult[]; removed: number } {
  const seen = new Set<string>();
  const out: QuestionResult[] = [];
  let removed = 0;
  for (const q of questions) {
    const norm = q.question.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(norm)) {
      removed++;
      continue;
    }
    seen.add(norm);
    out.push(q);
  }
  return { unique: out, removed };
}

/** Generate all questions for a single seed. */
export function generateForSeed(seed: string, options: ExtractionOptions): QuestionResult[] {
  if (!seed || !seed.trim()) return [];
  const s = seed.trim();
  const out: QuestionResult[] = [];
  const enabledWords = new Set(options.words);
  for (const tplName of options.templates) {
    const tpls = TEMPLATES[tplName];
    if (!tpls) continue;
    for (const t of tpls) {
      if (!enabledWords.has(t.word)) continue;
      out.push({
        question: t.fn(s),
        word: t.word,
        template: tplName,
        seed: s,
      });
    }
  }
  return out;
}

/** Run full extraction across all seeds. */
export function extract(seeds: string[], options: ExtractionOptions): ExtractionResult {
  const all: QuestionResult[] = [];
  for (const s of seeds) {
    all.push(...generateForSeed(s, options));
  }
  const { unique, removed } = dedupQuestions(all);
  const byWord: Record<QuestionWord, number> = {
    what: 0, how: 0, why: 0, when: 0, where: 0, who: 0, which: 0,
  };
  for (const q of unique) byWord[q.word]++;
  return {
    questions: unique,
    total: unique.length,
    duplicatesRemoved: removed,
    byWord,
  };
}

/** Render as CSV. */
export function renderCsv(result: ExtractionResult): string {
  const lines = ["question,word,template,seed"];
  for (const q of result.questions) {
    lines.push(`${escapeCsv(q.question)},${q.word},${q.template},${escapeCsv(q.seed)}`);
  }
  return lines.join("\n");
}

/** Render as Markdown, grouped by question word. */
export function renderMarkdown(result: ExtractionResult): string {
  const lines: string[] = ["# People Also Ask — Questions", ""];
  for (const word of ALL_WORDS) {
    const qs = result.questions.filter((q) => q.word === word);
    if (qs.length === 0) continue;
    lines.push(`## ${word.toUpperCase()} (${qs.length})`);
    for (const q of qs) lines.push(`- ${q.question}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** Render as plain text list. */
export function renderList(result: ExtractionResult): string {
  return result.questions.map((q) => q.question).join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:people-also-ask-extractor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  seedCount: number;
  total: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

export function buildShareUrl(input: {
  seeds: string;
  words: QuestionWord[];
  templates: string[];
}): string {
  const params = new URLSearchParams();
  if (input.seeds) params.set("seeds", input.seeds);
  if (input.words.length > 0) params.set("words", input.words.join(","));
  if (input.templates.length > 0) params.set("templates", input.templates.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  seeds: string;
  words: QuestionWord[];
  templates: string[];
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { seeds: "", words: [], templates: [] };
  const params = new URLSearchParams(clean);
  const words = (params.get("words") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is QuestionWord =>
      ALL_WORDS.includes(s as QuestionWord),
    );
  const templates = (params.get("templates") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => ALL_TEMPLATE_NAMES.includes(s));
  return {
    seeds: params.get("seeds") ?? "",
    words,
    templates,
  };
}
