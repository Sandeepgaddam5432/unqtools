/**
 * Lost & New Backlink Tracker — pure logic.
 *
 * Compare two backlink exports and compute new/lost/kept lists.
 * Pure functions only — no DOM, no network.
 */

export interface Backlink {
  url: string;
  anchor: string;
  sourceDomain: string;
  da: number;
  linkType: "dofollow" | "nofollow";
}

export interface DiffResult {
  newLinks: Backlink[];
  lostLinks: Backlink[];
  keptLinks: { current: Backlink; previous: Backlink }[];
  stats: {
    previousTotal: number;
    currentTotal: number;
    newCount: number;
    lostCount: number;
    keptCount: number;
    newPercentage: number;
    lostPercentage: number;
    netChange: number;
  };
  anchorAnalysis: {
    newAnchors: { anchor: string; count: number }[];
    lostAnchors: { anchor: string; count: number }[];
  };
  topNewByDa: Backlink[];
  topLostByDa: Backlink[];
}

/** Normalize a URL for comparison. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  let s = url.toLowerCase().trim();
  s = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  // Strip trailing slash
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

/** Parse CSV into Backlink[]. */
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

/** Parse JSON array into Backlink[]. */
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

/** Compute the diff between two backlink lists. */
export function diff(previous: Backlink[], current: Backlink[]): DiffResult {
  const prevMap = new Map<string, Backlink>();
  for (const b of previous) prevMap.set(normalizeUrl(b.url), b);
  const currMap = new Map<string, Backlink>();
  for (const b of current) currMap.set(normalizeUrl(b.url), b);
  const newLinks: Backlink[] = [];
  const lostLinks: Backlink[] = [];
  const keptLinks: { current: Backlink; previous: Backlink }[] = [];
  for (const [key, b] of currMap) {
    if (prevMap.has(key)) {
      keptLinks.push({ current: b, previous: prevMap.get(key)! });
    } else {
      newLinks.push(b);
    }
  }
  for (const [key, b] of prevMap) {
    if (!currMap.has(key)) lostLinks.push(b);
  }
  const previousTotal = previous.length;
  const currentTotal = current.length;
  const newCount = newLinks.length;
  const lostCount = lostLinks.length;
  const keptCount = keptLinks.length;
  const newPercentage = previousTotal > 0 ? Math.round((newCount / previousTotal) * 1000) / 10 : 0;
  const lostPercentage = previousTotal > 0 ? Math.round((lostCount / previousTotal) * 1000) / 10 : 0;
  const topNewByDa = [...newLinks].sort((a, b) => b.da - a.da).slice(0, 10);
  const topLostByDa = [...lostLinks].sort((a, b) => b.da - a.da).slice(0, 10);
  return {
    newLinks,
    lostLinks,
    keptLinks,
    stats: {
      previousTotal,
      currentTotal,
      newCount,
      lostCount,
      keptCount,
      newPercentage,
      lostPercentage,
      netChange: newCount - lostCount,
    },
    anchorAnalysis: {
      newAnchors: topAnchors(newLinks),
      lostAnchors: topAnchors(lostLinks),
    },
    topNewByDa,
    topLostByDa,
  };
}

/** Top anchor texts in a list. */
export function topAnchors(links: Backlink[], limit: number = 10): { anchor: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of links) {
    const a = b.anchor || "(empty)";
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([anchor, count]) => ({ anchor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Render result as CSV. */
export function renderCsv(result: DiffResult): string {
  const lines: string[] = [];
  lines.push("# Summary");
  lines.push(`previous_total,${result.stats.previousTotal}`);
  lines.push(`current_total,${result.stats.currentTotal}`);
  lines.push(`new,${result.stats.newCount}`);
  lines.push(`lost,${result.stats.lostCount}`);
  lines.push(`kept,${result.stats.keptCount}`);
  lines.push(`new_percentage,${result.stats.newPercentage}`);
  lines.push(`lost_percentage,${result.stats.lostPercentage}`);
  lines.push(`net_change,${result.stats.netChange}`);
  lines.push("");
  lines.push("# New backlinks");
  lines.push("url,anchor,source_domain,da,link_type");
  for (const b of result.newLinks) {
    lines.push([escapeCsv(b.url), escapeCsv(b.anchor), escapeCsv(b.sourceDomain), b.da, b.linkType].join(","));
  }
  lines.push("");
  lines.push("# Lost backlinks");
  lines.push("url,anchor,source_domain,da,link_type");
  for (const b of result.lostLinks) {
    lines.push([escapeCsv(b.url), escapeCsv(b.anchor), escapeCsv(b.sourceDomain), b.da, b.linkType].join(","));
  }
  return lines.join("\n");
}

/** Render plain-text report. */
export function renderReport(result: DiffResult): string {
  const lines: string[] = [];
  lines.push("Lost & New Backlink Tracker Report");
  lines.push("====================================");
  lines.push("");
  lines.push(`Previous total: ${result.stats.previousTotal}`);
  lines.push(`Current total: ${result.stats.currentTotal}`);
  lines.push(`New: ${result.stats.newCount} (+${result.stats.newPercentage}%)`);
  lines.push(`Lost: ${result.stats.lostCount} (-${result.stats.lostPercentage}%)`);
  lines.push(`Kept: ${result.stats.keptCount}`);
  lines.push(`Net change: ${result.stats.netChange >= 0 ? "+" : ""}${result.stats.netChange}`);
  lines.push("");
  if (result.topNewByDa.length > 0) {
    lines.push("Top new backlinks by DA:");
    for (const b of result.topNewByDa) {
      lines.push(`  [DA ${b.da}] ${b.url} — anchor: ${b.anchor || "(empty)"}`);
    }
  }
  if (result.topLostByDa.length > 0) {
    lines.push("");
    lines.push("Top lost backlinks by DA:");
    for (const b of result.topLostByDa) {
      lines.push(`  [DA ${b.da}] ${b.url} — anchor: ${b.anchor || "(empty)"}`);
    }
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:lost-new-backlink-tracker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  previousTotal: number;
  currentTotal: number;
  newCount: number;
  lostCount: number;
  netChange: number;
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

export function buildShareUrl(previous: string, current: string): string {
  const params = new URLSearchParams();
  if (previous) params.set("prev", previous);
  if (current) params.set("curr", current);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { prev: string; curr: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { prev: "", curr: "" };
  const params = new URLSearchParams(clean);
  return { prev: params.get("prev") ?? "", curr: params.get("curr") ?? "" };
}
