/**
 * PDF Text Extractor — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual content-stream parsing
 * lives in ui.tsx; this module handles formatting, statistics, history and
 * shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

export type OutputFormat = "plain-text" | "json" | "csv-per-page" | "markdown";

export const OUTPUT_FORMATS: OutputFormat[] = [
  "plain-text",
  "json",
  "csv-per-page",
  "markdown",
];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  "plain-text": "Plain text (.txt)",
  "json": "JSON (.json)",
  "csv-per-page": "CSV per page (.csv)",
  "markdown": "Markdown (.md)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  "plain-text": "txt",
  "json": "json",
  "csv-per-page": "csv",
  "markdown": "md",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  "plain-text": "text/plain",
  "json": "application/json",
  "csv-per-page": "text/csv",
  "markdown": "text/markdown",
};

export interface ExtractOptions {
  pageRange: string;
  outputFormat: OutputFormat;
  includePageNumbers: boolean;
  preserveLineBreaks: boolean;
}

export const DEFAULT_OPTIONS: ExtractOptions = {
  pageRange: "all",
  outputFormat: "plain-text",
  includePageNumbers: true,
  preserveLineBreaks: true,
};

export interface ExtractedPage {
  /** 1-based page number in the source PDF. */
  pageNumber: number;
  /** Raw extracted text (may be empty if no embedded text). */
  text: string;
  /** True if extraction produced no usable text (e.g. scanned page). */
  empty: boolean;
}

export interface TextStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  lines: number;
  paragraphs: number;
}

export interface SummaryStats {
  totalPages: number;
  extractedPages: number;
  emptyPages: number;
  totalChars: number;
  totalWords: number;
  avgCharsPerPage: number;
  avgWordsPerPage: number;
  /** 0-100 extraction success rate. */
  qualityScore: number;
}

export interface KeywordFreq {
  word: string;
  count: number;
}

export interface SearchResult {
  pageNumber: number;
  /** 1-based match index inside the page text. */
  index: number;
  /** Surrounding context (~40 chars on each side). */
  snippet: string;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  extractedChars: number;
  format: OutputFormat;
}

// ---------------------------------------------------------------------------
// Page-range spec normalization
// ---------------------------------------------------------------------------

/** Normalize a page-range spec. Lowercases, trims, replaces whitespace. "all" stays "all". */
export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

/** Resolve "all" → "1-N" for display. */
export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Page header / separator
// ---------------------------------------------------------------------------

/** Generate a page header / separator like "── Page 3 of 10 ──". */
export function generatePageSeparator(pageNumber: number, total: number): string {
  if (total <= 0) return `── Page ${pageNumber} ──`;
  return `── Page ${pageNumber} of ${total} ──`;
}

/** Format a page number label like "Page 3:" (used in CSV/JSON). */
export function formatPageHeader(pageNumber: number, total: number): string {
  if (total <= 0) return `Page ${pageNumber}`;
  return `Page ${pageNumber} / ${total}`;
}

// ---------------------------------------------------------------------------
// Line-break handling
// ---------------------------------------------------------------------------

/** Preserve line breaks (identity, but exists so callers can flip behavior). */
export function preserveLineBreaks(text: string): string {
  return text ?? "";
}

/** Collapse runs of whitespace into single spaces — useful for compact JSON. */
export function collapseLineBreaks(text: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Normalize text by either preserving or collapsing line breaks. */
export function normalizeText(text: string, preserve: boolean): string {
  return preserve ? preserveLineBreaks(text) : collapseLineBreaks(text);
}

// ---------------------------------------------------------------------------
// Empty-page detection
// ---------------------------------------------------------------------------

/** True when a page's text has no non-whitespace characters. */
export function isEmptyPage(text: string): boolean {
  return !text || text.trim().length === 0;
}

/** Filter out empty pages. */
export function filterEmptyPages(pages: ExtractedPage[]): ExtractedPage[] {
  return pages.filter((p) => !isEmptyPage(p.text));
}

// ---------------------------------------------------------------------------
// Text statistics
// ---------------------------------------------------------------------------

/** Compute char/word/line/paragraph counts for a chunk of text. */
export function computeTextStats(text: string): TextStats {
  const t = text ?? "";
  const chars = t.length;
  const charsNoSpaces = t.replace(/\s/g, "").length;
  const words = (t.match(/\S+/g) ?? []).length;
  const lines = t.length === 0 ? 0 : t.split(/\r\n|\r|\n/).length;
  const paragraphs = (t.split(/\n\s*\n/).filter((s) => s.trim().length > 0)).length;
  return { chars, charsNoSpaces, words, lines, paragraphs };
}

// ---------------------------------------------------------------------------
// Quality scoring
// ---------------------------------------------------------------------------

/** Score 0-100 — what fraction of pages produced non-empty text. */
export function scoreTextQuality(extractedNonEmpty: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  const ratio = extractedNonEmpty / totalPages;
  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

/** Compute aggregate stats across a set of extracted pages. */
export function computeSummaryStats(pages: ExtractedPage[]): SummaryStats {
  const totalPages = pages.length;
  let extractedPages = 0;
  let emptyPages = 0;
  let totalChars = 0;
  let totalWords = 0;
  for (const p of pages) {
    if (p.empty || isEmptyPage(p.text)) {
      emptyPages += 1;
    } else {
      extractedPages += 1;
    }
    const s = computeTextStats(p.text);
    totalChars += s.chars;
    totalWords += s.words;
  }
  return {
    totalPages,
    extractedPages,
    emptyPages,
    totalChars,
    totalWords,
    avgCharsPerPage: totalPages > 0 ? Math.round(totalChars / totalPages) : 0,
    avgWordsPerPage: totalPages > 0 ? Math.round(totalWords / totalPages) : 0,
    qualityScore: scoreTextQuality(extractedPages, totalPages),
  };
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render pages as plain text with optional page headers and separators. */
export function renderPlainText(pages: ExtractedPage[], opts: ExtractOptions): string {
  const total = pages.length;
  const parts: string[] = [];
  for (const p of pages) {
    const block: string[] = [];
    if (opts.includePageNumbers) block.push(generatePageSeparator(p.pageNumber, total));
    const body = normalizeText(p.text, opts.preserveLineBreaks);
    if (isEmptyPage(body)) {
      block.push("[No embedded text — page may be scanned. OCR would need Tesseract.js]");
    } else {
      block.push(body);
    }
    parts.push(block.join("\n"));
  }
  return parts.join("\n\n");
}

/** Render pages as a JSON object: { pages: [{ pageNumber, charCount, wordCount, text }] }. */
export function renderJson(pages: ExtractedPage[], opts: ExtractOptions): string {
  const total = pages.length;
  const data = {
    totalPages: total,
    includePageNumbers: opts.includePageNumbers,
    preserveLineBreaks: opts.preserveLineBreaks,
    pages: pages.map((p) => {
      const stats = computeTextStats(p.text);
      return {
        pageNumber: p.pageNumber,
        label: opts.includePageNumbers ? formatPageHeader(p.pageNumber, total) : undefined,
        charCount: stats.chars,
        wordCount: stats.words,
        empty: isEmptyPage(p.text),
        text: normalizeText(p.text, opts.preserveLineBreaks),
      };
    }),
  };
  return JSON.stringify(data, null, 2);
}

/** Escape a CSV field (quote if needed). */
export function escapeCsvField(s: string): string {
  const str = s ?? "";
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Render pages as CSV — one row per page. */
export function renderCsvPerPage(pages: ExtractedPage[], opts: ExtractOptions): string {
  const lines: string[] = ["page,char_count,word_count,is_empty,text"];
  for (const p of pages) {
    const stats = computeTextStats(p.text);
    const text = normalizeText(p.text, opts.preserveLineBreaks);
    lines.push([
      String(p.pageNumber),
      String(stats.chars),
      String(stats.words),
      String(isEmptyPage(p.text)),
      escapeCsvField(text),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render pages as Markdown with H2 page headings. */
export function renderMarkdown(pages: ExtractedPage[], opts: ExtractOptions): string {
  const total = pages.length;
  const parts: string[] = [];
  for (const p of pages) {
    if (opts.includePageNumbers) {
      parts.push(`## ${formatPageHeader(p.pageNumber, total)}\n`);
    }
    const body = normalizeText(p.text, opts.preserveLineBreaks);
    if (isEmptyPage(body)) {
      parts.push("> _No embedded text — page may be scanned._\n");
    } else {
      parts.push("```\n" + body + "\n```\n");
    }
  }
  return parts.join("\n");
}

/** Dispatch to the renderer matching the chosen format. */
export function renderOutput(pages: ExtractedPage[], opts: ExtractOptions): string {
  switch (opts.outputFormat) {
    case "plain-text": return renderPlainText(pages, opts);
    case "json": return renderJson(pages, opts);
    case "csv-per-page": return renderCsvPerPage(pages, opts);
    case "markdown": return renderMarkdown(pages, opts);
    default: return renderPlainText(pages, opts);
  }
}

/** Build the download filename for a given format and original PDF name. */
export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// Text search & keyword analysis
// ---------------------------------------------------------------------------

/** Search for a query across pages (case-insensitive). */
export function searchText(pages: ExtractedPage[], query: string): SearchResult[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  for (const p of pages) {
    const text = p.text ?? "";
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    while (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 40);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < text.length ? "…" : "";
      const snippet = prefix + text.slice(start, end) + suffix;
      results.push({ pageNumber: p.pageNumber, index: idx, snippet });
      idx = lower.indexOf(q, idx + q.length);
    }
  }
  return results;
}

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "at", "by", "for",
  "with", "about", "to", "in", "on", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "this",
  "that", "these", "those", "it", "its", "as", "from", "we", "you",
  "they", "he", "she", "i", "not", "no", "so", "can", "will", "just",
]);

/** Analyze keyword frequency — top N words longer than 2 chars, excluding stop words. */
export function analyzeKeywords(pages: ExtractedPage[], topN = 20): KeywordFreq[] {
  const counts = new Map<string, number>();
  for (const p of pages) {
    const words = (p.text ?? "").toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
    for (const w of words) {
      if (STOP_WORDS.has(w)) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, Math.max(1, topN));
}

/** Estimate reading time in minutes (default 250 wpm). */
export function estimateReadingTime(words: number, wpm = 250): number {
  if (words <= 0 || wpm <= 0) return 0;
  return Math.max(1, Math.round(words / wpm));
}

// ---------------------------------------------------------------------------
// Language detection (basic)
// ---------------------------------------------------------------------------

const LANGUAGE_MARKERS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "in", "is", "you", "that", "it", "for"],
  es: ["el", "la", "de", "que", "y", "en", "los", "se", "del", "las"],
  fr: ["le", "la", "les", "de", "et", "des", "un", "une", "est", "que"],
  de: ["der", "die", "und", "den", "von", "ist", "zu", "das", "mit", "sich"],
  it: ["il", "di", "che", "la", "per", "un", "in", "una", "sono", "del"],
};

/** Detect language by counting common-word matches. Returns ISO code or "unknown". */
export function detectLanguage(text: string): string {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  const words = new Set(t.match(/[a-zà-ÿ]+/g) ?? []);
  if (words.size === 0) return "unknown";
  let best = "unknown";
  let bestScore = 0;
  for (const [lang, markers] of Object.entries(LANGUAGE_MARKERS)) {
    let score = 0;
    for (const m of markers) if (words.has(m)) score += 1;
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : "unknown";
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-ocr-text-extractor:history";
const HISTORY_MAX = 20;

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
      // ignore quota errors
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_FORMATS = new Set<OutputFormat>(["plain-text", "json", "csv-per-page", "markdown"]);

export function buildShareUrl(opts: ExtractOptions): string {
  const params = new URLSearchParams();
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.outputFormat !== "plain-text") params.set("format", opts.outputFormat);
  if (!opts.includePageNumbers) params.set("pageNumbers", "0");
  if (!opts.preserveLineBreaks) params.set("lineBreaks", "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ExtractOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ExtractOptions> = {};
  const range = params.get("range");
  if (range) out.pageRange = range;
  const format = params.get("format");
  if (format && VALID_FORMATS.has(format as OutputFormat)) out.outputFormat = format as OutputFormat;
  const pageNumbers = params.get("pageNumbers");
  if (pageNumbers !== null) out.includePageNumbers = pageNumbers !== "0";
  const lineBreaks = params.get("lineBreaks");
  if (lineBreaks !== null) out.preserveLineBreaks = lineBreaks !== "0";
  return out;
}

// ---------------------------------------------------------------------------
// Convenience: validate an ExtractOptions object
// ---------------------------------------------------------------------------

export function validateOptions(opts: ExtractOptions, pageCount: number): ToolResult<ExtractOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!OUTPUT_FORMATS.includes(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    // Light validation: ensure range looks like digits/dashes/commas/spaces
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
