/**
 * Share of Voice Calculator — pure logic.
 *
 * Compute SEO Share of Voice from keyword rankings + search volumes.
 * Pure functions only — no DOM, no network.
 */

export interface SovInputRow {
  keyword: string;
  searchVolume: number;
  /** Map of domain -> position (1-100). Position 0 or missing = not ranking. */
  positions: Record<string, number>;
}

export interface DomainResult {
  domain: string;
  totalVisibility: number;
  sovPercentage: number; // 0-100
  visibilityScore: number; // 0-100 normalized
  keywordCount: number;
  avgPosition: number | null;
  top3Count: number;
  top10Count: number;
}

export interface KeywordBreakdown {
  keyword: string;
  searchVolume: number;
  leader: string | null; // domain with best (lowest) position
  positions: Record<string, number>;
  visibilityByDomain: Record<string, number>;
}

export interface SovResult {
  domains: DomainResult[];
  keywords: KeywordBreakdown[];
  totalVolume: number;
  totalVisibility: number;
  totalKeywords: number;
}

/** Industry-standard CTR curve approximation. */
export function positionWeight(position: number): number {
  if (!position || position < 1) return 0;
  if (position === 1) return 1.0;
  if (position === 2) return 0.85;
  if (position === 3) return 0.70;
  if (position === 4) return 0.55;
  if (position === 5) return 0.45;
  if (position === 6) return 0.40;
  if (position === 7) return 0.35;
  if (position === 8) return 0.30;
  if (position === 9) return 0.25;
  if (position === 10) return 0.20;
  if (position <= 20) return 0.05;
  if (position <= 30) return 0.03;
  if (position <= 50) return 0.01;
  return 0;
}

/** Normalize a domain string. */
export function normalizeDomain(s: string): string {
  if (!s) return "";
  const cleaned = s.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slash = cleaned.indexOf("/");
  return slash >= 0 ? cleaned.slice(0, slash) : cleaned;
}

/** Normalize a keyword. */
export function normalizeKeyword(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse a CSV row "keyword,volume,domain1:pos1,domain2:pos2,..." or
 *  "keyword,volume,pos1,pos2,pos3" with separate domain list. */
export function parseRow(
  line: string,
  domains: string[],
): { row: SovInputRow | null; error?: string } {
  if (!line || !line.trim()) return { row: null };
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("//")) return { row: null };
  const cols = splitCsvRow(trimmed);
  if (cols.length < 2) return { row: null, error: "need at least keyword + volume" };
  const keyword = normalizeKeyword(cols[0]);
  const volume = parseInt(cols[1], 10);
  if (!keyword) return { row: null, error: "missing keyword" };
  if (!Number.isFinite(volume) || volume < 0) return { row: null, error: "invalid volume" };
  const positions: Record<string, number> = {};
  // If column 2+ contains ":" treat as domain:position pairs
  if (cols.length > 2 && cols[2].includes(":")) {
    for (let i = 2; i < cols.length; i++) {
      const [d, p] = cols[i].split(":");
      const domain = normalizeDomain(d);
      const pos = parseInt(p, 10);
      if (domain && Number.isFinite(pos)) positions[domain] = pos;
    }
  } else {
    // Use provided domain list, fill positions in order
    for (let i = 0; i < domains.length; i++) {
      const posStr = cols[2 + i];
      if (posStr === undefined || posStr === "") continue;
      const pos = parseInt(posStr, 10);
      if (Number.isFinite(pos)) positions[domains[i]] = pos;
    }
  }
  return { row: { keyword, searchVolume: volume, positions } };
}

/** Split a CSV row, handling quoted values. */
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

/** Parse a multi-line CSV with optional domain header. */
export function parseInput(input: string, domainList?: string[]): { rows: SovInputRow[]; domains: string[]; errors: string[] } {
  if (!input || !input.trim()) return { rows: [], domains: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], domains: [], errors: [] };
  // Detect header
  const firstLine = lines[0].toLowerCase();
  let domains = domainList ?? [];
  let startIdx = 0;
  if (/keyword|volume|domain/.test(firstLine)) {
    // Header row — extract domain names from columns 2+
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    if (domains.length === 0) {
      for (let i = 2; i < headers.length; i++) {
        const h = headers[i];
        if (h && h !== "volume" && !h.includes("position")) {
          domains.push(normalizeDomain(h));
        }
      }
    }
    startIdx = 1;
  }
  if (domains.length === 0) domains = ["you"];
  const rows: SovInputRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const { row, error } = parseRow(lines[i], domains);
    if (error) { errors.push(`Row ${i + 1}: ${error}`); continue; }
    if (row) rows.push(row);
  }
  // Auto-add domains discovered in domain:position pairs
  const domainSet = new Set(domains);
  for (const r of rows) {
    for (const d of Object.keys(r.positions)) domainSet.add(d);
  }
  domains = Array.from(domainSet);
  return { rows, domains, errors };
}

/** Compute visibility for one row across all domains. */
export function computeRowVisibility(row: SovInputRow, domains: string[]): { byDomain: Record<string, number>; leader: string | null } {
  const byDomain: Record<string, number> = {};
  let leader: string | null = null;
  let leaderPos = Infinity;
  for (const d of domains) {
    const pos = row.positions[d] ?? 0;
    const visibility = row.searchVolume * positionWeight(pos);
    byDomain[d] = visibility;
    if (pos > 0 && pos < leaderPos) {
      leaderPos = pos;
      leader = d;
    }
  }
  return { byDomain, leader };
}

/** Run the full SOV calculation. */
export function calculate(rows: SovInputRow[], domains: string[]): SovResult {
  if (rows.length === 0) {
    return { domains: [], keywords: [], totalVolume: 0, totalVisibility: 0, totalKeywords: 0 };
  }
  const totalVolume = rows.reduce((acc, r) => acc + r.searchVolume, 0);
  // Per-domain cumulative visibility + position stats
  const agg: Record<string, {
    visibility: number;
    keywordCount: number;
    positionSum: number;
    top3: number;
    top10: number;
  }> = {};
  for (const d of domains) {
    agg[d] = { visibility: 0, keywordCount: 0, positionSum: 0, top3: 0, top10: 0 };
  }
  const keywords: KeywordBreakdown[] = [];
  for (const r of rows) {
    const { byDomain, leader } = computeRowVisibility(r, domains);
    for (const d of domains) {
      const pos = r.positions[d] ?? 0;
      if (pos > 0) {
        agg[d].visibility += byDomain[d];
        agg[d].keywordCount += 1;
        agg[d].positionSum += pos;
        if (pos <= 3) agg[d].top3 += 1;
        if (pos <= 10) agg[d].top10 += 1;
      }
    }
    keywords.push({
      keyword: r.keyword,
      searchVolume: r.searchVolume,
      leader,
      positions: r.positions,
      visibilityByDomain: byDomain,
    });
  }
  const totalVisibility = Object.values(agg).reduce((acc, a) => acc + a.visibility, 0);
  // Max visibility for normalization (per-keyword max possible = totalVolume)
  const maxPossible = totalVolume;
  const domainResults: DomainResult[] = domains.map((d) => {
    const a = agg[d];
    const sovPercentage = totalVisibility > 0 ? (a.visibility / totalVisibility) * 100 : 0;
    const visibilityScore = maxPossible > 0 ? Math.min(100, (a.visibility / maxPossible) * 100) : 0;
    const avgPosition = a.keywordCount > 0 ? Math.round((a.positionSum / a.keywordCount) * 10) / 10 : null;
    return {
      domain: d,
      totalVisibility: Math.round(a.visibility * 100) / 100,
      sovPercentage: Math.round(sovPercentage * 100) / 100,
      visibilityScore: Math.round(visibilityScore * 100) / 100,
      keywordCount: a.keywordCount,
      avgPosition,
      top3Count: a.top3,
      top10Count: a.top10,
    };
  });
  domainResults.sort((a, b) => b.sovPercentage - a.sovPercentage);
  return {
    domains: domainResults,
    keywords,
    totalVolume,
    totalVisibility: Math.round(totalVisibility * 100) / 100,
    totalKeywords: rows.length,
  };
}

/** Render result as CSV. */
export function renderCsv(result: SovResult): string {
  const lines: string[] = [];
  lines.push("# Per-domain summary");
  lines.push("domain,total_visibility,sov_percentage,visibility_score,keywords,avg_position,top3,top10");
  for (const d of result.domains) {
    lines.push([
      d.domain,
      d.totalVisibility,
      d.sovPercentage,
      d.visibilityScore,
      d.keywordCount,
      d.avgPosition ?? "",
      d.top3Count,
      d.top10Count,
    ].join(","));
  }
  lines.push("");
  lines.push("# Per-keyword breakdown");
  const header = ["keyword,search_volume,leader"];
  for (const d of result.domains) header.push(`${d.domain}_pos`, `${d.domain}_vis`);
  lines.push(header.join(","));
  for (const k of result.keywords) {
    const row = [escapeCsv(k.keyword), k.searchVolume, k.leader ?? ""];
    for (const d of result.domains) {
      row.push(k.positions[d.domain] ?? "", Math.round((k.visibilityByDomain[d.domain] ?? 0) * 100) / 100);
    }
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:share-of-voice-calculator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalKeywords: number;
  totalVolume: number;
  topDomain: string;
  topSov: number;
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
