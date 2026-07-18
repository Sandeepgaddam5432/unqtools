/**
 * Keyword Rank Tracker — pure logic.
 *
 * Track keyword rankings over time from user input (keyword + position + date).
 * Pure functions only — no DOM, no network.
 */

export interface RankEntry {
  keyword: string;
  position: number; // 1+ (lower = better). 0 / -1 used as "not ranking" by callers.
  date: string; // ISO yyyy-mm-dd
  url?: string;
}

export interface KeywordHistory {
  keyword: string;
  entries: { date: string; position: number; url?: string }[];
  latest: number | null;
  previous: number | null;
  change: number | null; // previous - latest (positive = climbed, negative = dropped)
  best: number | null;
  worst: number | null;
  average: number | null;
  entriesCount: number;
}

export interface TrackerStats {
  keywordsTracked: number;
  totalEntries: number;
  bestMover: { keyword: string; change: number } | null;
  biggestDrop: { keyword: string; change: number } | null;
  overallAverage: number | null;
}

export type SortField = "keyword" | "latest" | "change" | "best";
export type SortDir = "asc" | "desc";

const KEYWORD_SPLIT_RE = /[\n,;\t]+/;

/** Normalize a keyword string. */
export function normalizeKeyword(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Validate a date string is yyyy-mm-dd. */
export function isValidDate(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

/** Validate a position is a positive integer (or 0 for "not ranking"). */
export function isValidPosition(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1000;
}

/** Parse a single line "keyword,position,date[,url]" into a RankEntry. */
export function parseLine(line: string): RankEntry | null {
  if (!line) return null;
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Skip comment lines
  if (trimmed.startsWith("#") || trimmed.startsWith("//")) return null;
  const cols = splitCsvRow(trimmed);
  if (cols.length < 3) return null;
  const keyword = normalizeKeyword(cols[0]);
  const position = parseInt(cols[1], 10);
  const date = cols[2].trim();
  const url = cols[3] ? cols[3].trim() : undefined;
  if (!keyword) return null;
  if (!isValidPosition(position)) return null;
  if (!isValidDate(date)) return null;
  return { keyword, position, date, url };
}

/** Split a CSV row, handling quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

/** Parse a CSV/TSV blob into RankEntry[] (auto-detects header). */
export function parseCsv(input: string): { entries: RankEntry[]; errors: string[] } {
  if (!input || !input.trim()) return { entries: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { entries: [], errors: [] };
  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = /keyword|position|date|rank/.test(firstLine);
  const startIdx = hasHeader ? 1 : 0;
  const entries: RankEntry[] = [];
  // Build column map from header if present
  let colMap: Record<string, number> | null = null;
  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    colMap = {};
    headers.forEach((h, i) => {
      if (h === "keyword" || h === "query" || h === "term") colMap!.keyword = i;
      else if (h === "position" || h === "rank" || h === "ranking") colMap!.position = i;
      else if (h === "date") colMap!.date = i;
      else if (h === "url") colMap!.url = i;
    });
    if (colMap.keyword === undefined || colMap.position === undefined || colMap.date === undefined) {
      colMap = null;
    }
  }
  for (let i = startIdx; i < lines.length; i++) {
    if (colMap) {
      const cols = splitCsvRow(lines[i]);
      const keyword = normalizeKeyword(cols[colMap.keyword] ?? "");
      const position = parseInt(cols[colMap.position] ?? "", 10);
      const date = (cols[colMap.date] ?? "").trim();
      const url = colMap.url !== undefined ? (cols[colMap.url] ?? "").trim() : undefined;
      if (!keyword) { errors.push(`Row ${i + 1}: missing keyword — skipped`); continue; }
      if (!isValidPosition(position)) { errors.push(`Row ${i + 1}: invalid position — skipped`); continue; }
      if (!isValidDate(date)) { errors.push(`Row ${i + 1}: invalid date — skipped`); continue; }
      entries.push({ keyword, position, date, url: url || undefined });
    } else {
      const e = parseLine(lines[i]);
      if (!e) { errors.push(`Row ${i + 1}: could not parse — skipped`); continue; }
      entries.push(e);
    }
  }
  return { entries, errors };
}

/** Add an entry to an entries list (returns a new list). */
export function addEntry(entries: RankEntry[], entry: RankEntry): RankEntry[] {
  if (!isValidPosition(entry.position)) return entries;
  if (!isValidDate(entry.date)) return entries;
  if (!entry.keyword) return entries;
  return [...entries, { ...entry, keyword: normalizeKeyword(entry.keyword) }];
}

/** Remove all entries for a keyword. */
export function removeKeyword(entries: RankEntry[], keyword: string): RankEntry[] {
  const k = normalizeKeyword(keyword);
  return entries.filter((e) => e.keyword !== k);
}

/** Build per-keyword history with stats. */
export function buildHistory(entries: RankEntry[]): KeywordHistory[] {
  const byKw = new Map<string, RankEntry[]>();
  for (const e of entries) {
    if (!byKw.has(e.keyword)) byKw.set(e.keyword, []);
    byKw.get(e.keyword)!.push(e);
  }
  const out: KeywordHistory[] = [];
  for (const [keyword, list] of byKw) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const positions = sorted.map((s) => s.position);
    const latest = positions.length > 0 ? positions[positions.length - 1] : null;
    const previous = positions.length > 1 ? positions[positions.length - 2] : null;
    const change = latest !== null && previous !== null ? previous - latest : null;
    const rankingPositions = positions.filter((p) => p > 0);
    const best = rankingPositions.length > 0 ? Math.min(...rankingPositions) : null;
    const worst = rankingPositions.length > 0 ? Math.max(...rankingPositions) : null;
    const average = rankingPositions.length > 0
      ? Math.round((rankingPositions.reduce((a, b) => a + b, 0) / rankingPositions.length) * 10) / 10
      : null;
    out.push({
      keyword,
      entries: sorted.map((s) => ({ date: s.date, position: s.position, url: s.url })),
      latest,
      previous,
      change,
      best,
      worst,
      average,
      entriesCount: sorted.length,
    });
  }
  out.sort((a, b) => a.keyword.localeCompare(b.keyword));
  return out;
}

/** Filter history by a search string (case-insensitive substring). */
export function filterHistory(history: KeywordHistory[], query: string): KeywordHistory[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return history;
  return history.filter((h) => h.keyword.includes(q));
}

/** Sort history by a chosen field. */
export function sortHistory(
  history: KeywordHistory[],
  field: SortField = "keyword",
  dir: SortDir = "asc",
): KeywordHistory[] {
  const sorted = [...history];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (field === "keyword") cmp = a.keyword.localeCompare(b.keyword);
    else if (field === "latest") cmp = (a.latest ?? 9999) - (b.latest ?? 9999);
    else if (field === "change") cmp = (a.change ?? -9999) - (b.change ?? -9999);
    else if (field === "best") cmp = (a.best ?? 9999) - (b.best ?? 9999);
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/** Compute summary stats over the whole history. */
export function computeStats(history: KeywordHistory[]): TrackerStats {
  if (history.length === 0) {
    return {
      keywordsTracked: 0,
      totalEntries: 0,
      bestMover: null,
      biggestDrop: null,
      overallAverage: null,
    };
  }
  const totalEntries = history.reduce((acc, h) => acc + h.entriesCount, 0);
  const movers = history.filter((h) => h.change !== null);
  let bestMover: { keyword: string; change: number } | null = null;
  let biggestDrop: { keyword: string; change: number } | null = null;
  for (const h of movers) {
    const change = h.change as number;
    if (!bestMover || change > bestMover.change) bestMover = { keyword: h.keyword, change };
    if (!biggestDrop || change < biggestDrop.change) biggestDrop = { keyword: h.keyword, change };
  }
  const allAverages = history.map((h) => h.average).filter((a): a is number => a !== null);
  const overallAverage = allAverages.length > 0
    ? Math.round((allAverages.reduce((a, b) => a + b, 0) / allAverages.length) * 10) / 10
    : null;
  return {
    keywordsTracked: history.length,
    totalEntries,
    bestMover,
    biggestDrop,
    overallAverage,
  };
}

/** Build chart-ready data per keyword (sorted date/position pairs). */
export function chartData(history: KeywordHistory[]): { keyword: string; points: { x: string; y: number }[] }[] {
  return history.map((h) => ({
    keyword: h.keyword,
    points: h.entries.map((e) => ({ x: e.date, y: e.position })),
  }));
}

/** Render entries as CSV. */
export function renderCsv(entries: RankEntry[]): string {
  const lines = ["keyword,position,date,url"];
  for (const e of entries) {
    lines.push([escapeCsv(e.keyword), e.position, e.date, escapeCsv(e.url ?? "")].join(","));
  }
  return lines.join("\n");
}

/** Render history summary as CSV. */
export function renderSummaryCsv(history: KeywordHistory[]): string {
  const lines = ["keyword,latest,previous,change,best,worst,average,entries"];
  for (const h of history) {
    lines.push([
      escapeCsv(h.keyword),
      h.latest ?? "",
      h.previous ?? "",
      h.change ?? "",
      h.best ?? "",
      h.worst ?? "",
      h.average ?? "",
      h.entriesCount,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:keyword-rank-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  keywordsTracked: number;
  totalEntries: number;
  overallAverage: number | null;
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

// ---- Shareable URL ----

export function buildShareUrl(payload: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "" };
}
