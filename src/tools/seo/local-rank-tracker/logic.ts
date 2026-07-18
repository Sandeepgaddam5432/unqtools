/**
 * Local Rank Tracker — pure logic.
 *
 * Track local SEO rankings across keyword x location combinations.
 * Pure functions only — no DOM, no network.
 */

export type LocalPackCategory = "top-pack" | "below-pack" | "unranked";
export type OrganicCategory = "page-1" | "page-2" | "off-page" | "unranked";
export type FilterMode = "all" | "top-pack" | "page-1";

export interface RankEntry {
  keyword: string;
  location: string;
  /** Local pack position (1-3 = top pack, 4+ = below pack). null = not ranked. */
  localPackPosition: number | null;
  /** Organic position. 1-10 = page 1, 11-20 = page 2, > 20 = off page. null = not ranked. */
  organicPosition: number | null;
  /** ISO date YYYY-MM-DD */
  date: string;
}

export interface RankEntryWithScore extends RankEntry {
  localPackScore: number; // 0-100
  organicScore: number; // 0-100
  visibilityScore: number; // weighted 0-100
  localPackCategory: LocalPackCategory;
  organicCategory: OrganicCategory;
}

export interface KeywordAvg {
  keyword: string;
  avgVisibility: number;
  count: number;
  topPackCount: number;
}

export interface LocationAvg {
  location: string;
  avgVisibility: number;
  count: number;
  topPackCount: number;
}

export interface SummaryStats {
  totalTracked: number;
  avgVisibility: number;
  topPackCount: number;
  page1Count: number;
  bestCombo: RankEntryWithScore | null;
  worstCombo: RankEntryWithScore | null;
}

/** Default date today (UTC) as YYYY-MM-DD. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Normalize a keyword. */
export function normalizeKeyword(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Normalize a location: preserve case (e.g. "Austin, TX"). */
export function normalizeLocation(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Parse keywords (one per line or comma-separated). */
export function parseKeywords(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map(normalizeKeyword)
    .filter(Boolean);
}

/** Parse locations (one per line). Commas inside a line are part of the location. */
export function parseLocations(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n]+/)
    .map(normalizeLocation)
    .filter(Boolean);
}

/** Convert a position to a 0-100 score: 1=100, 2=90, ... 10=10, >10=0, null/0=0. */
export function positionToScore(pos: number | null): number {
  if (pos === null || pos <= 0) return 0;
  if (pos > 10) return 0;
  return (11 - pos) * 10;
}

/** Categorize a local pack position. */
export function categorizeLocalPack(pos: number | null): LocalPackCategory {
  if (pos === null || pos <= 0) return "unranked";
  if (pos <= 3) return "top-pack";
  return "below-pack";
}

/** Categorize an organic position. */
export function categorizeOrganic(pos: number | null): OrganicCategory {
  if (pos === null || pos <= 0) return "unranked";
  if (pos <= 10) return "page-1";
  if (pos <= 20) return "page-2";
  return "off-page";
}

/** Weighted visibility score: 60% local pack + 40% organic. */
export function computeVisibility(
  localPackPos: number | null,
  organicPos: number | null,
): number {
  const lp = positionToScore(localPackPos);
  const org = positionToScore(organicPos);
  return Math.round(lp * 0.6 + org * 0.4);
}

/** Score a single entry. */
export function scoreEntry(entry: RankEntry): RankEntryWithScore {
  return {
    ...entry,
    localPackScore: positionToScore(entry.localPackPosition),
    organicScore: positionToScore(entry.organicPosition),
    visibilityScore: computeVisibility(entry.localPackPosition, entry.organicPosition),
    localPackCategory: categorizeLocalPack(entry.localPackPosition),
    organicCategory: categorizeOrganic(entry.organicPosition),
  };
}

/** Score all entries. */
export function scoreAll(entries: RankEntry[]): RankEntryWithScore[] {
  return entries.map(scoreEntry);
}

/** Generate tracking matrix (every keyword x location). Empty positions. */
export function generateMatrix(
  keywords: string[],
  locations: string[],
  date: string = todayIso(),
): RankEntry[] {
  const out: RankEntry[] = [];
  for (const kw of keywords) {
    for (const loc of locations) {
      out.push({
        keyword: kw,
        location: loc,
        localPackPosition: null,
        organicPosition: null,
        date,
      });
    }
  }
  return out;
}

/** Split CSV row with quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Parse manual CSV entries (header optional). */
export function parseManualEntries(csv: string): RankEntry[] {
  if (!csv) return [];
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const out: RankEntry[] = [];
  let startIdx = 0;
  // Detect header
  const firstCells = splitCsvRow(lines[0]).map((c) => c.trim().toLowerCase());
  if (
    firstCells.includes("keyword") &&
    firstCells.includes("location") &&
    (firstCells.includes("local_pack_pos") || firstCells.includes("local_pack_position"))
  ) {
    startIdx = 1;
  }
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    if (cells.length < 2) continue;
    const keyword = normalizeKeyword(cells[0] ?? "");
    const location = normalizeLocation(cells[1] ?? "");
    if (!keyword || !location) continue;
    const lpRaw = (cells[2] ?? "").trim();
    const orgRaw = (cells[3] ?? "").trim();
    const dateRaw = (cells[4] ?? "").trim();
    const localPackPosition = lpRaw === "" || lpRaw === "-" ? null : Number(lpRaw);
    const organicPosition = orgRaw === "" || orgRaw === "-" ? null : Number(orgRaw);
    const date = dateRaw || todayIso();
    out.push({
      keyword,
      location,
      localPackPosition: Number.isFinite(localPackPosition as number) ? localPackPosition : null,
      organicPosition: Number.isFinite(organicPosition as number) ? organicPosition : null,
      date,
    });
  }
  return out;
}

/** Average visibility per keyword. */
export function averagePerKeyword(entries: RankEntryWithScore[]): KeywordAvg[] {
  const map = new Map<string, RankEntryWithScore[]>();
  for (const e of entries) {
    if (!map.has(e.keyword)) map.set(e.keyword, []);
    map.get(e.keyword)!.push(e);
  }
  const out: KeywordAvg[] = [];
  for (const [keyword, list] of map) {
    const avg = list.reduce((s, e) => s + e.visibilityScore, 0) / list.length;
    const topPackCount = list.filter((e) => e.localPackCategory === "top-pack").length;
    out.push({
      keyword,
      avgVisibility: Math.round(avg * 10) / 10,
      count: list.length,
      topPackCount,
    });
  }
  out.sort((a, b) => b.avgVisibility - a.avgVisibility);
  return out;
}

/** Average visibility per location. */
export function averagePerLocation(entries: RankEntryWithScore[]): LocationAvg[] {
  const map = new Map<string, RankEntryWithScore[]>();
  for (const e of entries) {
    if (!map.has(e.location)) map.set(e.location, []);
    map.get(e.location)!.push(e);
  }
  const out: LocationAvg[] = [];
  for (const [location, list] of map) {
    const avg = list.reduce((s, e) => s + e.visibilityScore, 0) / list.length;
    const topPackCount = list.filter((e) => e.localPackCategory === "top-pack").length;
    out.push({
      location,
      avgVisibility: Math.round(avg * 10) / 10,
      count: list.length,
      topPackCount,
    });
  }
  out.sort((a, b) => b.avgVisibility - a.avgVisibility);
  return out;
}

/** Best and worst performing combos (by visibility score). */
export function bestAndWorstCombos(
  entries: RankEntryWithScore[],
): { best: RankEntryWithScore | null; worst: RankEntryWithScore | null } {
  if (entries.length === 0) return { best: null, worst: null };
  let best = entries[0];
  let worst = entries[0];
  for (const e of entries) {
    if (e.visibilityScore > best.visibilityScore) best = e;
    if (e.visibilityScore < worst.visibilityScore) worst = e;
  }
  return { best, worst };
}

/** Filter entries by mode. */
export function filterEntries(
  entries: RankEntryWithScore[],
  mode: FilterMode,
): RankEntryWithScore[] {
  if (mode === "all") return entries;
  if (mode === "top-pack") return entries.filter((e) => e.localPackCategory === "top-pack");
  if (mode === "page-1") return entries.filter((e) => e.organicCategory === "page-1");
  return entries;
}

/** Compute summary stats. */
export function computeSummaryStats(entries: RankEntryWithScore[]): SummaryStats {
  if (entries.length === 0) {
    return {
      totalTracked: 0,
      avgVisibility: 0,
      topPackCount: 0,
      page1Count: 0,
      bestCombo: null,
      worstCombo: null,
    };
  }
  const total = entries.reduce((s, e) => s + e.visibilityScore, 0);
  const topPackCount = entries.filter((e) => e.localPackCategory === "top-pack").length;
  const page1Count = entries.filter((e) => e.organicCategory === "page-1").length;
  const { best, worst } = bestAndWorstCombos(entries);
  return {
    totalTracked: entries.length,
    avgVisibility: Math.round((total / entries.length) * 10) / 10,
    topPackCount,
    page1Count,
    bestCombo: best,
    worstCombo: worst,
  };
}

/** Render entries as a human-readable text report. */
export function renderText(entries: RankEntryWithScore[]): string {
  if (entries.length === 0) return "(no entries)";
  const lines: string[] = [];
  lines.push("LOCAL RANK TRACKER REPORT");
  lines.push("=".repeat(60));
  const stats = computeSummaryStats(entries);
  lines.push(`Total tracked: ${stats.totalTracked}`);
  lines.push(`Average visibility: ${stats.avgVisibility}`);
  lines.push(`Top-pack entries: ${stats.topPackCount}`);
  lines.push(`Page-1 organic entries: ${stats.page1Count}`);
  if (stats.bestCombo) {
    lines.push(
      `Best: ${stats.bestCombo.keyword} @ ${stats.bestCombo.location} = ${stats.bestCombo.visibilityScore}`,
    );
  }
  if (stats.worstCombo) {
    lines.push(
      `Worst: ${stats.worstCombo.keyword} @ ${stats.worstCombo.location} = ${stats.worstCombo.visibilityScore}`,
    );
  }
  lines.push("");
  lines.push("ENTRIES");
  lines.push("-".repeat(60));
  for (const e of entries) {
    const lp = e.localPackPosition === null ? "-" : String(e.localPackPosition);
    const org = e.organicPosition === null ? "-" : String(e.organicPosition);
    lines.push(
      `${e.keyword} | ${e.location} | LP=${lp} | Org=${org} | Vis=${e.visibilityScore} | ${e.date}`,
    );
  }
  const kwAvgs = averagePerKeyword(entries);
  if (kwAvgs.length > 0) {
    lines.push("");
    lines.push("PER KEYWORD");
    lines.push("-".repeat(60));
    for (const k of kwAvgs) {
      lines.push(`${k.keyword}: avg=${k.avgVisibility} (n=${k.count}, top-pack=${k.topPackCount})`);
    }
  }
  const locAvgs = averagePerLocation(entries);
  if (locAvgs.length > 0) {
    lines.push("");
    lines.push("PER LOCATION");
    lines.push("-".repeat(60));
    for (const l of locAvgs) {
      lines.push(`${l.location}: avg=${l.avgVisibility} (n=${l.count}, top-pack=${l.topPackCount})`);
    }
  }
  return lines.join("\n");
}

/** Render entries as CSV. */
export function renderCsv(entries: RankEntryWithScore[]): string {
  const lines = ["keyword,location,local_pack_pos,organic_pos,visibility_score,date"];
  for (const e of entries) {
    const lp = e.localPackPosition === null ? "" : String(e.localPackPosition);
    const org = e.organicPosition === null ? "" : String(e.organicPosition);
    lines.push([
      escapeCsv(e.keyword),
      escapeCsv(e.location),
      lp,
      org,
      String(e.visibilityScore),
      escapeCsv(e.date),
    ].join(","));
  }
  return lines.join("\n");
}

/** Generate an empty CSV template for users to fill in. */
export function generateTemplate(
  keywords: string[],
  locations: string[],
  date: string = todayIso(),
): string {
  const lines = ["keyword,location,local_pack_pos,organic_pos,date"];
  for (const kw of keywords) {
    for (const loc of locations) {
      lines.push([escapeCsv(kw), escapeCsv(loc), "", "", date].join(","));
    }
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:local-rank-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  keywords: string[];
  locations: string[];
  totalEntries: number;
  avgVisibility: number;
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

export function buildShareUrl(keywords: string, locations: string, manual: string): string {
  const params = new URLSearchParams();
  if (keywords) params.set("kw", keywords);
  if (locations) params.set("loc", locations);
  if (manual) params.set("csv", manual);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  keywords: string;
  locations: string;
  manual: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { keywords: "", locations: "", manual: "" };
  const params = new URLSearchParams(clean);
  return {
    keywords: params.get("kw") ?? "",
    locations: params.get("loc") ?? "",
    manual: params.get("csv") ?? "",
  };
}
