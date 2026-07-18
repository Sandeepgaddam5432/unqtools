/**
 * Backlink Profile Analyzer — pure logic.
 *
 * Parse CSV/JSON backlink data, compute stats, distributions, top lists, and
 * flag toxic links. Pure functions only — no DOM, no network.
 */

export interface Backlink {
  url: string;
  anchor: string;
  sourceDomain: string;
  da: number; // domain authority 0-100
  linkType: "dofollow" | "nofollow";
}

export interface TopItem {
  key: string;
  count: number;
  percentage: number;
}

export interface AnalysisResult {
  totalBacklinks: number;
  uniqueDomains: number;
  dofollowCount: number;
  nofollowCount: number;
  dofollowPercentage: number;
  nofollowPercentage: number;
  averageDa: number;
  topReferringDomains: TopItem[];
  topAnchorTexts: TopItem[];
  daDistribution: { low: number; medium: number; high: number };
  toxicLinks: Backlink[];
  totalToxic: number;
}

export const DEFAULT_TOXIC_DA_THRESHOLD = 20;
const TOP_LIMIT = 20;

/** Extract domain from a URL or treat input as domain already. */
export function extractDomain(input: string): string {
  if (!input) return "";
  const s = input.trim().toLowerCase();
  // Strip protocol
  const cleaned = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  // Take up to first /
  const slash = cleaned.indexOf("/");
  return slash >= 0 ? cleaned.slice(0, slash) : cleaned;
}

/** Parse a CSV string into backlink rows. */
export function parseCsv(input: string): { backlinks: Backlink[]; errors: string[] } {
  if (!input || !input.trim()) return { backlinks: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { backlinks: [], errors: [] };
  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = /url|anchor|source|da|link_type|type/.test(firstLine);
  const headerRow = hasHeader ? splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim()) : null;
  const startIdx = hasHeader ? 1 : 0;

  // Build column index map
  const colMap: Record<string, number> = {};
  if (headerRow) {
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (h === "url" || h === "target_url") colMap.url = i;
      else if (h === "anchor" || h === "anchor_text") colMap.anchor = i;
      else if (h === "source_domain" || h === "source" || h === "domain" || h === "referring_domain") colMap.sourceDomain = i;
      else if (h === "da" || h === "domain_authority" || h === "dr" || h === "domain_rating") colMap.da = i;
      else if (h === "link_type" || h === "type") colMap.linkType = i;
    }
  } else {
    // Default column order: url, anchor, source_domain, da, link_type
    colMap.url = 0;
    colMap.anchor = 1;
    colMap.sourceDomain = 2;
    colMap.da = 3;
    colMap.linkType = 4;
  }

  const backlinks: Backlink[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const url = (cols[colMap.url] ?? "").trim();
    if (!url) {
      errors.push(`Row ${i + 1}: missing URL — skipped`);
      continue;
    }
    const anchor = (cols[colMap.anchor] ?? "").trim();
    const sourceDomain = extractDomain((cols[colMap.sourceDomain] ?? "").trim());
    const daStr = (cols[colMap.da] ?? "").trim();
    const da = daStr === "" ? 0 : parseFloat(daStr);
    const linkTypeRaw = (cols[colMap.linkType] ?? "").trim().toLowerCase();
    const linkType: Backlink["linkType"] = linkTypeRaw === "nofollow" ? "nofollow" : "dofollow";
    backlinks.push({ url, anchor, sourceDomain, da: isNaN(da) ? 0 : da, linkType });
  }
  return { backlinks, errors };
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

/** Parse JSON (array of backlink objects) into Backlink[]. */
export function parseJson(input: string): { backlinks: Backlink[]; errors: string[] } {
  if (!input || !input.trim()) return { backlinks: [], errors: [] };
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) {
      return { backlinks: [], errors: ["JSON must be an array of backlink objects"] };
    }
    const backlinks: Backlink[] = [];
    const errors: string[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as Record<string, unknown>;
      if (!item || typeof item !== "object") {
        errors.push(`Item ${i}: not an object — skipped`);
        continue;
      }
      const url = String(item.url ?? item.target_url ?? item.targetUrl ?? "").trim();
      if (!url) {
        errors.push(`Item ${i}: missing url — skipped`);
        continue;
      }
      const anchor = String(item.anchor ?? item.anchor_text ?? item.anchorText ?? "").trim();
      const sourceDomain = extractDomain(String(item.source_domain ?? item.sourceDomain ?? item.source ?? item.domain ?? item.referring_domain ?? "").trim());
      const daRaw = item.da ?? item.domain_authority ?? item.domainAuthority ?? item.dr ?? item.domain_rating ?? 0;
      const da = typeof daRaw === "number" ? daRaw : parseFloat(String(daRaw)) || 0;
      const ltRaw = String(item.link_type ?? item.linkType ?? item.type ?? "dofollow").toLowerCase();
      const linkType: Backlink["linkType"] = ltRaw === "nofollow" ? "nofollow" : "dofollow";
      backlinks.push({ url, anchor, sourceDomain, da, linkType });
    }
    return { backlinks, errors };
  } catch (e) {
    return { backlinks: [], errors: [e instanceof Error ? e.message : "Invalid JSON"] };
  }
}

/** Auto-detect format and parse. */
export function parseAuto(input: string): { backlinks: Backlink[]; errors: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { backlinks: [], errors: [] };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(input);
  }
  return parseCsv(input);
}

/** Count items and compute top-N with percentages. */
export function computeTop(items: string[], limit: number = TOP_LIMIT): TopItem[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const key = it || "(empty)";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = items.length;
  const arr = Array.from(counts.entries());
  arr.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return arr.slice(0, limit).map(([key, count]) => ({
    key,
    count,
    percentage: total > 0 ? (count / total) * 100 : 0,
  }));
}

/** Analyze the backlinks. */
export function analyze(
  backlinks: Backlink[],
  options: { toxicDaThreshold?: number } = {},
): AnalysisResult {
  const toxicThreshold = options.toxicDaThreshold ?? DEFAULT_TOXIC_DA_THRESHOLD;
  const totalBacklinks = backlinks.length;
  if (totalBacklinks === 0) {
    return {
      totalBacklinks: 0,
      uniqueDomains: 0,
      dofollowCount: 0,
      nofollowCount: 0,
      dofollowPercentage: 0,
      nofollowPercentage: 0,
      averageDa: 0,
      topReferringDomains: [],
      topAnchorTexts: [],
      daDistribution: { low: 0, medium: 0, high: 0 },
      toxicLinks: [],
      totalToxic: 0,
    };
  }
  const uniqueDomains = new Set(backlinks.map((b) => b.sourceDomain)).size;
  const dofollowCount = backlinks.filter((b) => b.linkType === "dofollow").length;
  const nofollowCount = totalBacklinks - dofollowCount;
  const averageDa = Math.round(backlinks.reduce((acc, b) => acc + b.da, 0) / totalBacklinks);
  const topReferringDomains = computeTop(backlinks.map((b) => b.sourceDomain));
  const topAnchorTexts = computeTop(backlinks.map((b) => b.anchor));
  const daDistribution = {
    low: backlinks.filter((b) => b.da < 30).length,
    medium: backlinks.filter((b) => b.da >= 30 && b.da < 60).length,
    high: backlinks.filter((b) => b.da >= 60).length,
  };
  const toxicLinks = backlinks
    .filter((b) => b.da < toxicThreshold)
    .sort((a, b) => a.da - b.da);
  return {
    totalBacklinks,
    uniqueDomains,
    dofollowCount,
    nofollowCount,
    dofollowPercentage: (dofollowCount / totalBacklinks) * 100,
    nofollowPercentage: (nofollowCount / totalBacklinks) * 100,
    averageDa,
    topReferringDomains,
    topAnchorTexts,
    daDistribution,
    toxicLinks,
    totalToxic: toxicLinks.length,
  };
}

/** Render a CSV report. */
export function renderCsv(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("# Summary");
  lines.push(`total_backlinks,${result.totalBacklinks}`);
  lines.push(`unique_domains,${result.uniqueDomains}`);
  lines.push(`dofollow_count,${result.dofollowCount}`);
  lines.push(`nofollow_count,${result.nofollowCount}`);
  lines.push(`dofollow_percentage,${result.dofollowPercentage.toFixed(2)}`);
  lines.push(`average_da,${result.averageDa}`);
  lines.push(`total_toxic,${result.totalToxic}`);
  lines.push("");
  lines.push("# Top referring domains");
  lines.push("domain,count,percentage");
  for (const t of result.topReferringDomains) {
    lines.push(`${escapeCsv(t.key)},${t.count},${t.percentage.toFixed(2)}`);
  }
  lines.push("");
  lines.push("# Top anchor texts");
  lines.push("anchor,count,percentage");
  for (const t of result.topAnchorTexts) {
    lines.push(`${escapeCsv(t.key)},${t.count},${t.percentage.toFixed(2)}`);
  }
  lines.push("");
  lines.push("# Toxic links (DA below threshold)");
  lines.push("url,anchor,source_domain,da,link_type");
  for (const b of result.toxicLinks) {
    lines.push(`${escapeCsv(b.url)},${escapeCsv(b.anchor)},${escapeCsv(b.sourceDomain)},${b.da},${b.linkType}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History ----

const HISTORY_KEY = "unqtools:backlink-profile-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalBacklinks: number;
  uniqueDomains: number;
  averageDa: number;
  totalToxic: number;
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

export function buildShareUrl(input: string, format: "csv" | "json" | "auto"): string {
  const params = new URLSearchParams();
  if (input) {
    params.set("data", input);
    params.set("fmt", format);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string; format: "csv" | "json" | "auto" } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "", format: "auto" };
  const params = new URLSearchParams(clean);
  const data = params.get("data") ?? "";
  const fmt = (params.get("fmt") as "csv" | "json" | "auto") ?? "auto";
  return { data, format: fmt };
}
