/**
 * Rank Change Visualizer — pure logic.
 *
 * Paste rank history (date, keyword, position) and compute per-keyword
 * changes, timeline, biggest gains/drops, average trend, and stats.
 * Pure functions only — no DOM, no network.
 */

export interface RankRow {
  date: string; // yyyy-mm-dd
  keyword: string;
  position: number;
}

export interface KeywordChange {
  keyword: string;
  firstPosition: number;
  lastPosition: number;
  firstDate: string;
  lastDate: string;
  change: number; // first - last (positive = climbed)
  entryCount: number;
  best: number;
  worst: number;
}

export interface TimelineCell {
  date: string;
  values: Record<string, number | null>; // keyword -> position (null = not tracked)
}

export interface Timeline {
  dates: string[];
  keywords: string[];
  cells: TimelineCell[];
}

export interface DateTrend {
  date: string;
  averagePosition: number;
  trackedKeywords: number;
}

export interface VisualizerStats {
  totalRows: number;
  uniqueKeywords: number;
  uniqueDates: number;
  biggestGains: KeywordChange[];
  biggestDrops: KeywordChange[];
  overallAverageChange: number;
}

export interface DateRange {
  start: string;
  end: string;
}

const CSV_HEADER_RE = /^(date|keyword|position|rank)/i;

/** Normalize keyword. */
export function normalizeKeyword(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Validate yyyy-mm-dd date. */
export function isValidDate(s: string): boolean {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d.getTime());
}

/** Validate position. */
export function isValidPosition(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1000;
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

/** Parse the pasted rank history blob. */
export function parseInput(input: string): { rows: RankRow[]; errors: string[] } {
  if (!input || !input.trim()) return { rows: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], errors: [] };
  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = /date|keyword|position|rank/.test(firstLine) && CSV_HEADER_RE.test(lines[0]);
  const startIdx = hasHeader ? 1 : 0;
  // Build column map if header present
  let colMap: { date: number; keyword: number; position: number } | null = null;
  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    const dateIdx = headers.findIndex((h) => h === "date");
    const kwIdx = headers.findIndex((h) => h === "keyword" || h === "query" || h === "term");
    const posIdx = headers.findIndex((h) => h === "position" || h === "rank" || h === "ranking");
    if (dateIdx >= 0 && kwIdx >= 0 && posIdx >= 0) {
      colMap = { date: dateIdx, keyword: kwIdx, position: posIdx };
    }
  }
  const rows: RankRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    let date: string, keyword: string, position: number;
    if (colMap) {
      date = (cols[colMap.date] ?? "").trim();
      keyword = normalizeKeyword(cols[colMap.keyword] ?? "");
      position = parseInt(cols[colMap.position] ?? "", 10);
    } else {
      // Default: date,keyword,position
      date = (cols[0] ?? "").trim();
      keyword = normalizeKeyword(cols[1] ?? "");
      position = parseInt(cols[2] ?? "", 10);
    }
    if (!date || !keyword) { errors.push(`Row ${i + 1}: missing date or keyword — skipped`); continue; }
    if (!isValidDate(date)) { errors.push(`Row ${i + 1}: invalid date "${date}" — skipped`); continue; }
    if (!isValidPosition(position)) { errors.push(`Row ${i + 1}: invalid position — skipped`); continue; }
    rows.push({ date, keyword, position });
  }
  return { rows, errors };
}

/** Compute per-keyword change summary. */
export function computeChanges(rows: RankRow[]): KeywordChange[] {
  const byKw = new Map<string, RankRow[]>();
  for (const r of rows) {
    if (!byKw.has(r.keyword)) byKw.set(r.keyword, []);
    byKw.get(r.keyword)!.push(r);
  }
  const out: KeywordChange[] = [];
  for (const [keyword, list] of byKw) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const positions = sorted.map((s) => s.position);
    const firstPosition = positions[0];
    const lastPosition = positions[positions.length - 1];
    const change = firstPosition - lastPosition;
    const rankingPositions = positions.filter((p) => p > 0);
    const best = rankingPositions.length > 0 ? Math.min(...rankingPositions) : 0;
    const worst = rankingPositions.length > 0 ? Math.max(...rankingPositions) : 0;
    out.push({
      keyword,
      firstPosition,
      lastPosition,
      firstDate: sorted[0].date,
      lastDate: sorted[sorted.length - 1].date,
      change,
      entryCount: sorted.length,
      best,
      worst,
    });
  }
  out.sort((a, b) => a.keyword.localeCompare(b.keyword));
  return out;
}

/** Build a date-by-keyword timeline. */
export function buildTimeline(rows: RankRow[]): Timeline {
  const dateSet = new Set<string>();
  const kwSet = new Set<string>();
  for (const r of rows) {
    dateSet.add(r.date);
    kwSet.add(r.keyword);
  }
  const dates = Array.from(dateSet).sort();
  const keywords = Array.from(kwSet).sort();
  // Build lookup
  const lookup = new Map<string, number>();
  for (const r of rows) lookup.set(`${r.date}|${r.keyword}`, r.position);
  const cells: TimelineCell[] = dates.map((date) => {
    const values: Record<string, number | null> = {};
    for (const kw of keywords) {
      const key = `${date}|${kw}`;
      values[kw] = lookup.has(key) ? lookup.get(key)! : null;
    }
    return { date, values };
  });
  return { dates, keywords, cells };
}

/** Compute average position trend per date. */
export function averageTrend(rows: RankRow[]): DateTrend[] {
  const byDate = new Map<string, number[]>();
  for (const r of rows) {
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date)!.push(r.position);
  }
  const out: DateTrend[] = [];
  for (const [date, positions] of byDate) {
    const ranking = positions.filter((p) => p > 0);
    const avg = ranking.length > 0
      ? Math.round((ranking.reduce((a, b) => a + b, 0) / ranking.length) * 10) / 10
      : 0;
    out.push({ date, averagePosition: avg, trackedKeywords: positions.length });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Filter rows by keyword substring. */
export function filterByKeyword(rows: RankRow[], query: string): RankRow[] {
  const q = (query || "").toLowerCase().trim();
  if (!q) return rows;
  return rows.filter((r) => r.keyword.includes(q));
}

/** Filter rows by date range. */
export function filterByDateRange(rows: RankRow[], range?: DateRange): RankRow[] {
  if (!range || (!range.start && !range.end)) return rows;
  return rows.filter((r) => {
    if (range.start && r.date < range.start) return false;
    if (range.end && r.date > range.end) return false;
    return true;
  });
}

/** Compute summary stats. */
export function computeStats(changes: KeywordChange[]): VisualizerStats {
  if (changes.length === 0) {
    return {
      totalRows: 0,
      uniqueKeywords: 0,
      uniqueDates: 0,
      biggestGains: [],
      biggestDrops: [],
      overallAverageChange: 0,
    };
  }
  const gains = [...changes].filter((c) => c.change > 0).sort((a, b) => b.change - a.change).slice(0, 10);
  const drops = [...changes].filter((c) => c.change < 0).sort((a, b) => a.change - b.change).slice(0, 10);
  const totalChange = changes.reduce((acc, c) => acc + c.change, 0);
  return {
    totalRows: changes.reduce((acc, c) => acc + c.entryCount, 0),
    uniqueKeywords: changes.length,
    uniqueDates: 0, // filled by caller
    biggestGains: gains,
    biggestDrops: drops,
    overallAverageChange: Math.round((totalChange / changes.length) * 10) / 10,
  };
}

/** Render the report as Markdown. */
export function renderMarkdown(rows: RankRow[], changes: KeywordChange[], stats: VisualizerStats, timeline: Timeline): string {
  const lines: string[] = [];
  lines.push("# Rank Change Report");
  lines.push("");
  lines.push(`- **Total rows:** ${stats.totalRows}`);
  lines.push(`- **Unique keywords:** ${stats.uniqueKeywords}`);
  lines.push(`- **Unique dates:** ${timeline.dates.length}`);
  lines.push(`- **Overall average change:** ${stats.overallAverageChange > 0 ? "+" : ""}${stats.overallAverageChange}`);
  lines.push("");
  lines.push("## Biggest gains");
  if (stats.biggestGains.length === 0) {
    lines.push("_No gains detected._");
  } else {
    lines.push("| Keyword | First | Last | Change |");
    lines.push("| --- | --- | --- | --- |");
    for (const g of stats.biggestGains) {
      lines.push(`| ${g.keyword} | ${g.firstPosition} | ${g.lastPosition} | +${g.change} |`);
    }
  }
  lines.push("");
  lines.push("## Biggest drops");
  if (stats.biggestDrops.length === 0) {
    lines.push("_No drops detected._");
  } else {
    lines.push("| Keyword | First | Last | Change |");
    lines.push("| --- | --- | --- | --- |");
    for (const d of stats.biggestDrops) {
      lines.push(`| ${d.keyword} | ${d.firstPosition} | ${d.lastPosition} | ${d.change} |`);
    }
  }
  lines.push("");
  lines.push("## Timeline (date × keyword)");
  const header = ["date", ...timeline.keywords].join(" | ");
  const divider = ["---", ...timeline.keywords.map(() => "---")].join(" | ");
  lines.push(`| ${header} |`);
  lines.push(`| ${divider} |`);
  for (const cell of timeline.cells) {
    const cells = [cell.date, ...timeline.keywords.map((k) => cell.values[k] ?? "")].join(" | ");
    lines.push(`| ${cells} |`);
  }
  return lines.join("\n");
}

/** Render timeline as CSV. */
export function renderCsv(timeline: Timeline): string {
  const lines = [["date", ...timeline.keywords].join(",")];
  for (const cell of timeline.cells) {
    lines.push([cell.date, ...timeline.keywords.map((k) => cell.values[k] ?? "")].join(","));
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:rank-change-visualizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalRows: number;
  uniqueKeywords: number;
  overallAverageChange: number;
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
