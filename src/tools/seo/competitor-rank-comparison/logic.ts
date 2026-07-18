/**
 * Competitor Rank Comparison — pure logic.
 *
 * Compare your keyword rankings against up to 5 competitors. Pure functions
 * only — no DOM, no network.
 */

export interface ComparisonRow {
  keyword: string;
  positions: Record<string, number>; // domain -> position (0 = not ranking)
}

export interface Opportunity {
  keyword: string;
  yourPosition: number;
  competitor: string;
  competitorPosition: number;
  gap: number; // your - competitor (positive = you're behind)
}

export interface DomainStats {
  domain: string;
  isYou: boolean;
  keywordCount: number;
  avgPosition: number | null;
  top3Count: number;
  top10Count: number;
  winsCount: number; // keywords where this domain has the best position
}

export interface ComparisonResult {
  rows: ComparisonRow[];
  domains: string[];
  yourDomain: string;
  competitors: string[];
  stats: DomainStats[];
  opportunities: Opportunity[];
  overlap: number; // keywords where ALL domains have a position
  totalKeywords: number;
  leaderboard: DomainStats[];
}

const MAX_COMPETITORS = 5;

export { MAX_COMPETITORS };

/** Normalize a domain. */
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

/** Parse a multi-line CSV input. Returns rows + ordered domain list. */
export function parseInput(
  input: string,
  yourDomain: string,
  competitorDomains: string[],
): { rows: ComparisonRow[]; domains: string[]; errors: string[] } {
  if (!input || !input.trim()) return { rows: [], domains: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { rows: [], domains: [], errors: [] };
  const you = normalizeDomain(yourDomain) || "you";
  const competitors = competitorDomains.map(normalizeDomain).filter(Boolean).slice(0, MAX_COMPETITORS);
  const domains = [you, ...competitors];
  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = /keyword|position|rank/.test(firstLine);
  const startIdx = hasHeader ? 1 : 0;
  const rows: ComparisonRow[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cols = splitCsvRow(trimmed);
    if (cols.length < 2) { errors.push(`Row ${i + 1}: too few columns`); continue; }
    const keyword = normalizeKeyword(cols[0]);
    if (!keyword) { errors.push(`Row ${i + 1}: missing keyword`); continue; }
    const positions: Record<string, number> = {};
    for (let j = 0; j < domains.length; j++) {
      const posStr = cols[1 + j];
      if (posStr === undefined || posStr === "") continue;
      const pos = parseInt(posStr, 10);
      if (Number.isFinite(pos) && pos >= 0) positions[domains[j]] = pos;
    }
    rows.push({ keyword, positions });
  }
  return { rows, domains, errors };
}

/** Compute stats per domain. */
export function computeStats(
  rows: ComparisonRow[],
  domains: string[],
  yourDomain: string,
): DomainStats[] {
  const stats: DomainStats[] = domains.map((d) => ({
    domain: d,
    isYou: d === yourDomain,
    keywordCount: 0,
    avgPosition: null as number | null,
    top3Count: 0,
    top10Count: 0,
    winsCount: 0,
  }));
  for (const row of rows) {
    // Find winner
    let winner: string | null = null;
    let winnerPos = Infinity;
    for (const d of domains) {
      const pos = row.positions[d];
      if (pos && pos > 0 && pos < winnerPos) {
        winnerPos = pos;
        winner = d;
      }
    }
    for (const d of domains) {
      const pos = row.positions[d];
      if (pos && pos > 0) {
        const s = stats.find((x) => x.domain === d)!;
        s.keywordCount += 1;
        s.top3Count += pos <= 3 ? 1 : 0;
        s.top10Count += pos <= 10 ? 1 : 0;
        if (winner === d) s.winsCount += 1;
      }
    }
  }
  // Compute avg position per domain
  for (const s of stats) {
    let sum = 0;
    let count = 0;
    for (const row of rows) {
      const pos = row.positions[s.domain];
      if (pos && pos > 0) { sum += pos; count += 1; }
    }
    s.avgPosition = count > 0 ? Math.round((sum / count) * 10) / 10 : null;
  }
  return stats;
}

/** Identify opportunities (where you rank worse than a competitor). */
export function findOpportunities(rows: ComparisonRow[], yourDomain: string, competitors: string[]): Opportunity[] {
  const out: Opportunity[] = [];
  for (const row of rows) {
    const yourPos = row.positions[yourDomain] ?? 0;
    for (const comp of competitors) {
      const compPos = row.positions[comp] ?? 0;
      // Opportunity: competitor ranks, you don't; OR you rank worse
      if (compPos > 0 && (yourPos === 0 || yourPos > compPos)) {
        out.push({
          keyword: row.keyword,
          yourPosition: yourPos,
          competitor: comp,
          competitorPosition: compPos,
          gap: yourPos > 0 ? yourPos - compPos : 100,
        });
      }
    }
  }
  out.sort((a, b) => b.gap - a.gap);
  return out;
}

/** Count keyword overlap (keywords where all domains have a position). */
export function computeOverlap(rows: ComparisonRow[], domains: string[]): number {
  if (domains.length === 0) return 0;
  let count = 0;
  for (const row of rows) {
    if (domains.every((d) => row.positions[d] && row.positions[d]! > 0)) count += 1;
  }
  return count;
}

/** Run the full comparison. */
export function compare(
  rows: ComparisonRow[],
  domains: string[],
  yourDomain: string,
  competitors: string[],
): ComparisonResult {
  const stats = computeStats(rows, domains, yourDomain);
  const opportunities = findOpportunities(rows, yourDomain, competitors);
  const overlap = computeOverlap(rows, domains);
  const leaderboard = [...stats].sort((a, b) => {
    // Sort by wins desc, then by avgPosition asc (nulls last)
    if (b.winsCount !== a.winsCount) return b.winsCount - a.winsCount;
    const ap = a.avgPosition ?? 999;
    const bp = b.avgPosition ?? 999;
    return ap - bp;
  });
  return {
    rows,
    domains,
    yourDomain,
    competitors,
    stats,
    opportunities,
    overlap,
    totalKeywords: rows.length,
    leaderboard,
  };
}

/** Render result as CSV. */
export function renderCsv(result: ComparisonResult): string {
  const lines: string[] = [];
  lines.push("# Domain stats");
  lines.push("domain,is_you,keywords,avg_position,top3,top10,wins");
  for (const s of result.stats) {
    lines.push([s.domain, s.isYou ? 1 : 0, s.keywordCount, s.avgPosition ?? "", s.top3Count, s.top10Count, s.winsCount].join(","));
  }
  lines.push("");
  lines.push("# Side-by-side rankings");
  const header = ["keyword", ...result.domains];
  lines.push(header.join(","));
  for (const row of result.rows) {
    lines.push([escapeCsv(row.keyword), ...result.domains.map((d) => row.positions[d] ?? "")].join(","));
  }
  lines.push("");
  lines.push("# Opportunities (you rank worse)");
  lines.push("keyword,your_position,competitor,competitor_position,gap");
  for (const o of result.opportunities) {
    lines.push([escapeCsv(o.keyword), o.yourPosition, o.competitor, o.competitorPosition, o.gap].join(","));
  }
  return lines.join("\n");
}

/** Render a plain-text report. */
export function renderReport(result: ComparisonResult): string {
  const lines: string[] = [];
  lines.push("Competitor Rank Comparison Report");
  lines.push("==================================");
  lines.push("");
  lines.push(`Your domain: ${result.yourDomain}`);
  lines.push(`Competitors: ${result.competitors.join(", ")}`);
  lines.push(`Total keywords: ${result.totalKeywords}`);
  lines.push(`Overlap (all domains rank): ${result.overlap}`);
  lines.push("");
  lines.push("Leaderboard (by wins):");
  for (const s of result.leaderboard) {
    lines.push(`  ${s.domain}${s.isYou ? " (you)" : ""}: ${s.winsCount} wins, avg ${s.avgPosition ?? "n/a"}, top10 ${s.top10Count}`);
  }
  lines.push("");
  lines.push(`Opportunities (${result.opportunities.length}):`);
  for (const o of result.opportunities.slice(0, 20)) {
    lines.push(`  ${o.keyword}: you ${o.yourPosition || "n/a"} vs ${o.competitor} ${o.competitorPosition} (gap ${o.gap})`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:competitor-rank-comparison:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalKeywords: number;
  opportunities: number;
  yourWins: number;
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

export function buildShareUrl(input: string, yourDomain: string, competitors: string[]): string {
  const params = new URLSearchParams();
  if (input) params.set("data", input);
  if (yourDomain) params.set("you", yourDomain);
  if (competitors.length > 0) params.set("comp", competitors.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string; you: string; comp: string[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "", you: "", comp: [] };
  const params = new URLSearchParams(clean);
  const compStr = params.get("comp") ?? "";
  return {
    data: params.get("data") ?? "",
    you: params.get("you") ?? "",
    comp: compStr ? compStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
  };
}
