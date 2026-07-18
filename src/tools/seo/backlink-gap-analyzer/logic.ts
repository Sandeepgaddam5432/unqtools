/**
 * Backlink Gap Analyzer — pure logic.
 *
 * Find backlinks competitors have but you don't. Pure functions only —
 * no DOM, no network.
 */

export interface Backlink {
  url: string;
  anchor: string;
  sourceDomain: string;
  da: number;
  linkType: "dofollow" | "nofollow";
}

export interface GapOpportunity {
  url: string;
  sourceDomain: string;
  da: number;
  anchor: string;
  linkType: "dofollow" | "nofollow";
  linkingCompetitors: string[];
  competitorCount: number;
  opportunityScore: number;
}

export interface DomainStat {
  domain: string;
  isYou: boolean;
  totalBacklinks: number;
  uniqueDomains: number;
  averageDa: number;
}

export interface GapResult {
  opportunities: GapOpportunity[];
  sharedBacklinks: Backlink[];
  stats: DomainStat[];
  totalOpportunities: number;
  totalShared: number;
  byCompetitor: Record<string, number>;
}

const MAX_COMPETITORS = 3;
export { MAX_COMPETITORS };

/** Normalize a URL. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  let s = url.toLowerCase().trim();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  s = s.replace(/\/$/, "");
  return s;
}

/** Extract domain from URL. */
export function extractDomain(input: string): string {
  if (!input) return "";
  const s = input.toLowerCase().trim();
  const cleaned = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slash = cleaned.indexOf("/");
  return slash >= 0 ? cleaned.slice(0, slash) : cleaned;
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

/** Parse CSV. */
export function parseCsv(input: string): { backlinks: Backlink[]; errors: string[] } {
  if (!input || !input.trim()) return { backlinks: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { backlinks: [], errors: [] };
  const firstLine = lines[0].toLowerCase();
  const firstCell = splitCsvRow(firstLine)[0]?.trim() ?? "";
  const hasHeader = /^(url|target_url|anchor|source_domain|source|domain|referring_domain|da|domain_authority|dr|link_type|type)$/.test(firstCell);
  let colMap: Record<string, number> | null = null;
  let startIdx = 0;
  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    colMap = {};
    headers.forEach((h, i) => {
      if (h === "url" || h === "target_url") colMap!.url = i;
      else if (h === "anchor" || h === "anchor_text") colMap!.anchor = i;
      else if (h === "source_domain" || h === "source" || h === "domain" || h === "referring_domain") colMap!.sourceDomain = i;
      else if (h === "da" || h === "domain_authority" || h === "dr") colMap!.da = i;
      else if (h === "link_type" || h === "type") colMap!.linkType = i;
    });
    if (colMap.url === undefined) colMap = null;
    startIdx = 1;
  } else {
    colMap = { url: 0, anchor: 1, sourceDomain: 2, da: 3, linkType: 4 };
  }
  const backlinks: Backlink[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const url = (cols[colMap!.url] ?? "").trim();
    if (!url) { errors.push(`Row ${i + 1}: missing url`); continue; }
    backlinks.push({
      url,
      anchor: (cols[colMap!.anchor ?? -1] ?? "").trim(),
      sourceDomain: extractDomain((cols[colMap!.sourceDomain ?? -1] ?? "").trim()),
      da: parseFloat(cols[colMap!.da ?? -1] ?? "0") || 0,
      linkType: (cols[colMap!.linkType ?? -1] ?? "").trim().toLowerCase() === "nofollow" ? "nofollow" : "dofollow",
    });
  }
  return { backlinks, errors };
}

/** Parse JSON array. */
export function parseJson(input: string): { backlinks: Backlink[]; errors: string[] } {
  if (!input || !input.trim()) return { backlinks: [], errors: [] };
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return { backlinks: [], errors: ["JSON must be an array"] };
    const backlinks: Backlink[] = [];
    const errors: string[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as Record<string, unknown>;
      if (!item || typeof item !== "object") { errors.push(`Item ${i}: not an object`); continue; }
      const url = String(item.url ?? item.target_url ?? "").trim();
      if (!url) { errors.push(`Item ${i}: missing url`); continue; }
      backlinks.push({
        url,
        anchor: String(item.anchor ?? item.anchor_text ?? "").trim(),
        sourceDomain: extractDomain(String(item.source_domain ?? item.source ?? item.domain ?? "").trim()),
        da: typeof item.da === "number" ? item.da : parseFloat(String(item.da ?? 0)) || 0,
        linkType: String(item.link_type ?? item.type ?? "dofollow").toLowerCase() === "nofollow" ? "nofollow" : "dofollow",
      });
    }
    return { backlinks, errors };
  } catch (e) {
    return { backlinks: [], errors: [e instanceof Error ? e.message : "Invalid JSON"] };
  }
}

/** Auto-detect format. */
export function parseAuto(input: string): { backlinks: Backlink[]; errors: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { backlinks: [], errors: [] };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseJson(input);
  return parseCsv(input);
}

/** Compute opportunity score 0-100. */
export function opportunityScore(da: number, competitorCount: number, totalCompetitors: number): number {
  let score = Math.min(60, (da / 100) * 60);
  if (competitorCount >= 3) score += 30;
  else if (competitorCount >= 2) score += 20;
  else score += 10;
  // Bonus: if all competitors link, +10
  if (totalCompetitors > 0 && competitorCount === totalCompetitors) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Compute stats per domain. */
export function computeStats(yourBacklinks: Backlink[], competitorBacklinks: { name: string; backlinks: Backlink[] }[]): DomainStat[] {
  const stats: DomainStat[] = [];
  const compute = (b: Backlink[], name: string, isYou: boolean): DomainStat => {
    if (b.length === 0) {
      return { domain: name, isYou, totalBacklinks: 0, uniqueDomains: 0, averageDa: 0 };
    }
    const domains = new Set(b.map((x) => x.sourceDomain));
    const avgDa = Math.round((b.reduce((acc, x) => acc + x.da, 0) / b.length) * 10) / 10;
    return { domain: name, isYou, totalBacklinks: b.length, uniqueDomains: domains.size, averageDa: avgDa };
  };
  stats.push(compute(yourBacklinks, "you", true));
  for (const c of competitorBacklinks) {
    stats.push(compute(c.backlinks, c.name, false));
  }
  return stats;
}

/** Run the full gap analysis. */
export function analyze(
  yourBacklinks: Backlink[],
  competitorBacklinks: { name: string; backlinks: Backlink[] }[],
): GapResult {
  // Build set of your backlink URLs
  const yourUrls = new Set<string>();
  for (const b of yourBacklinks) yourUrls.add(normalizeUrl(b.url));
  // Walk competitor backlinks, collect those NOT in your set
  const opportunityMap = new Map<string, GapOpportunity>();
  const byCompetitor: Record<string, number> = {};
  for (const c of competitorBacklinks) {
    byCompetitor[c.name] = 0;
  }
  for (const c of competitorBacklinks) {
    for (const b of c.backlinks) {
      const key = normalizeUrl(b.url);
      if (yourUrls.has(key)) continue; // you also have this — not a gap
      // Deduplicate by URL
      const existing = opportunityMap.get(key);
      if (existing) {
        if (!existing.linkingCompetitors.includes(c.name)) {
          existing.linkingCompetitors.push(c.name);
          existing.competitorCount += 1;
          existing.opportunityScore = opportunityScore(existing.da, existing.competitorCount, competitorBacklinks.length);
        }
      } else {
        opportunityMap.set(key, {
          url: b.url,
          sourceDomain: b.sourceDomain,
          da: b.da,
          anchor: b.anchor,
          linkType: b.linkType,
          linkingCompetitors: [c.name],
          competitorCount: 1,
          opportunityScore: opportunityScore(b.da, 1, competitorBacklinks.length),
        });
      }
      byCompetitor[c.name] = (byCompetitor[c.name] ?? 0) + 1;
    }
  }
  // Shared backlinks: backlinks present in your set AND at least one competitor
  const sharedBacklinks: Backlink[] = [];
  for (const c of competitorBacklinks) {
    for (const b of c.backlinks) {
      if (yourUrls.has(normalizeUrl(b.url))) {
        if (!sharedBacklinks.some((s) => normalizeUrl(s.url) === normalizeUrl(b.url))) {
          sharedBacklinks.push(b);
        }
      }
    }
  }
  const opportunities = Array.from(opportunityMap.values()).sort((a, b) => {
    // Sort by opportunity score desc, then by DA desc
    if (b.opportunityScore !== a.opportunityScore) return b.opportunityScore - a.opportunityScore;
    return b.da - a.da;
  });
  const stats = computeStats(yourBacklinks, competitorBacklinks);
  return {
    opportunities,
    sharedBacklinks,
    stats,
    totalOpportunities: opportunities.length,
    totalShared: sharedBacklinks.length,
    byCompetitor,
  };
}

/** Render result as CSV. */
export function renderCsv(result: GapResult): string {
  const lines: string[] = [];
  lines.push("# Stats");
  lines.push("domain,is_you,total_backlinks,unique_domains,average_da");
  for (const s of result.stats) {
    lines.push([s.domain, s.isYou ? 1 : 0, s.totalBacklinks, s.uniqueDomains, s.averageDa].join(","));
  }
  lines.push("");
  lines.push("# Opportunities (competitors have, you don't)");
  lines.push("url,anchor,source_domain,da,link_type,competitor_count,linking_competitors,opportunity_score");
  for (const o of result.opportunities) {
    lines.push([
      escapeCsv(o.url),
      escapeCsv(o.anchor),
      escapeCsv(o.sourceDomain),
      o.da,
      o.linkType,
      o.competitorCount,
      escapeCsv(o.linkingCompetitors.join("; ")),
      o.opportunityScore,
    ].join(","));
  }
  lines.push("");
  lines.push("# Shared backlinks (you + competitor)");
  lines.push("url,anchor,source_domain,da,link_type");
  for (const b of result.sharedBacklinks) {
    lines.push([escapeCsv(b.url), escapeCsv(b.anchor), escapeCsv(b.sourceDomain), b.da, b.linkType].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:backlink-gap-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  opportunities: number;
  shared: number;
  topScore: number;
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

export function buildShareUrl(yours: string, competitors: { name: string; data: string }[]): string {
  const params = new URLSearchParams();
  if (yours) params.set("you", yours);
  competitors.forEach((c, i) => {
    if (c.data) {
      params.set(`c${i}_name`, c.name);
      params.set(`c${i}_data`, c.data);
    }
  });
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { you: string; competitors: { name: string; data: string }[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { you: "", competitors: [] };
  const params = new URLSearchParams(clean);
  const you = params.get("you") ?? "";
  const competitors: { name: string; data: string }[] = [];
  for (let i = 0; i < MAX_COMPETITORS; i++) {
    const name = params.get(`c${i}_name`);
    const data = params.get(`c${i}_data`);
    if (name && data) competitors.push({ name, data });
  }
  return { you, competitors };
}
