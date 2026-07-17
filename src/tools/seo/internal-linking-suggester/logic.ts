/**
 * Internal Linking Suggester — pure logic.
 *
 * Pure functions only — no DOM, no network.
 */

export interface TargetPage {
  url: string;
  keywords: string[]; // comma-separated phrases
}

export interface LinkSuggestion {
  url: string;
  keyword: string;
  anchor: string; // suggested anchor text (default = keyword)
  count: number; // number of occurrences
  firstOccurrencePct: number; // position in content as percentage
  relevance: number; // 0-100
}

export interface AnalysisResult {
  suggestions: LinkSuggestion[];
  totalPages: number;
  matchedPages: number;
  totalMatches: number;
  deduped: number;
}

/** Parse one-per-line "url,keyword1,keyword2,..." entries. */
export function parsePages(input: string): TargetPage[] {
  if (!input) return [];
  const pages: TargetPage[] = [];
  for (const line of input.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(",");
    const url = parts[0]?.trim();
    if (!url) continue;
    const keywords = parts
      .slice(1)
      .map((k) => k.trim())
      .filter(Boolean);
    pages.push({ url, keywords });
  }
  return pages;
}

/** Validate URL format. */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** HTML-escape. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Count case-insensitive occurrences of a phrase in content. */
export function countOccurrences(content: string, phrase: string): number {
  if (!content || !phrase) return 0;
  const lower = content.toLowerCase();
  const p = phrase.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(p, idx)) !== -1) {
    count++;
    idx += p.length;
  }
  return count;
}

/** Position (0-100) of first occurrence, or -1 if not found. */
export function firstOccurrencePct(content: string, phrase: string): number {
  if (!content || !phrase) return -1;
  const idx = content.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return -1;
  return Math.round((idx / Math.max(1, content.length)) * 100);
}

/** Compute relevance score 0-100 for a match. */
export function computeRelevance(
  count: number,
  firstPct: number,
  phrase: string,
): number {
  let score = 60;
  // density sweet spot
  if (count >= 2 && count <= 5) score += 20;
  else if (count > 5) score += 10;
  else if (count === 1) score += 5;
  // position bonus
  if (firstPct >= 0 && firstPct <= 33) score += 10;
  else if (firstPct >= 0 && firstPct <= 66) score += 5;
  // longer anchor preferred
  if (phrase.trim().split(/\s+/).length >= 2) score += 10;
  return Math.max(0, Math.min(100, score));
}

/** Find all link suggestions from content + pages. */
export function findSuggestions(
  content: string,
  pages: TargetPage[],
  options: { minRelevance?: number } = {},
): LinkSuggestion[] {
  const minRelevance = options.minRelevance ?? 30;
  if (!content || pages.length === 0) return [];
  const out: LinkSuggestion[] = [];
  for (const page of pages) {
    if (!isValidUrl(page.url)) continue;
    for (const kw of page.keywords) {
      const count = countOccurrences(content, kw);
      if (count === 0) continue;
      const firstPct = firstOccurrencePct(content, kw);
      const relevance = computeRelevance(count, firstPct, kw);
      if (relevance < minRelevance) continue;
      out.push({
        url: page.url,
        keyword: kw,
        anchor: kw,
        count,
        firstOccurrencePct: firstPct,
        relevance,
      });
    }
  }
  // Sort by relevance desc
  out.sort((a, b) => b.relevance - a.relevance || b.count - a.count);
  return out;
}

/** Dedup suggestions: keep only the highest-relevance entry per URL+anchor pair. */
export function dedupSuggestions(suggestions: LinkSuggestion[]): LinkSuggestion[] {
  const seen = new Map<string, LinkSuggestion>();
  let deduped = 0;
  for (const s of suggestions) {
    const key = `${s.url}::${s.anchor.toLowerCase()}`;
    const existing = seen.get(key);
    if (existing) {
      deduped++;
      if (s.relevance > existing.relevance) seen.set(key, s);
    } else {
      seen.set(key, s);
    }
  }
  return Array.from(seen.values());
}

/** Build full analysis with stats and dedup. */
export function analyze(
  content: string,
  pages: TargetPage[],
  options: { minRelevance?: number } = {},
): AnalysisResult {
  const raw = findSuggestions(content, pages, options);
  const deduped = dedupSuggestions(raw);
  const matchedUrls = new Set(deduped.map((s) => s.url));
  return {
    suggestions: deduped,
    totalPages: pages.length,
    matchedPages: matchedUrls.size,
    totalMatches: deduped.length,
    deduped: raw.length - deduped.length,
  };
}

/** Export suggestions as HTML anchor tags. */
export function exportHtml(suggestions: LinkSuggestion[]): string {
  return suggestions
    .map((s) => `<a href="${escapeHtml(s.url)}">${escapeHtml(s.anchor)}</a>`)
    .join("\n");
}

/** Export suggestions as Markdown links. */
export function exportMarkdown(suggestions: LinkSuggestion[]): string {
  return suggestions.map((s) => `[${s.anchor}](${s.url})`).join("\n");
}

/** Export suggestions as CSV. */
export function exportCsv(suggestions: LinkSuggestion[]): string {
  const lines = ["url,anchor,count,relevance,first_occurrence_pct"];
  for (const s of suggestions) {
    lines.push(
      `${escapeCsv(s.url)},${escapeCsv(s.anchor)},${s.count},${s.relevance},${s.firstOccurrencePct}`,
    );
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:internal-linking-suggester:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalPages: number;
  matchedPages: number;
  totalMatches: number;
  snippet: string;
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

export function buildShareUrl(input: { content: string; pages: string }): string {
  const params = new URLSearchParams();
  if (input.content) params.set("content", input.content);
  if (input.pages) params.set("pages", input.pages);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { content: string; pages: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const out = { content: "", pages: "" };
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  return {
    content: params.get("content") ?? "",
    pages: params.get("pages") ?? "",
  };
}
