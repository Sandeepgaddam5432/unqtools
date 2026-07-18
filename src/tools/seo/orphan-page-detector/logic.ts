/**
 * Orphan Page Detector — pure logic.
 *
 * Pure functions only — no DOM, no network.
 * Given a site's URL inventory + a list of internal links, find pages
 * that receive zero internal links (orphans).
 */

export interface UrlEntry {
  original: string;
  normalized: string;
  count: number;
  isOrphan: boolean;
  anchorTexts: string[];
}

export interface InternalLink {
  raw: string;
  href: string;
  normalized: string;
  anchorText: string;
  isInternal: boolean;
}

export interface OrphanReport {
  totalUrls: number;
  totalLinks: number;
  internalLinks: number;
  orphanCount: number;
  linkedCount: number;
  avgLinksPerUrl: number;
  maxLinks: number;
  entries: UrlEntry[];
  topLinked: UrlEntry[];
  bottomLinked: UrlEntry[];
}

export interface HistoryEntry {
  ts: number;
  totalUrls: number;
  totalLinks: number;
  orphanCount: number;
  linkedCount: number;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:orphan-page-detector:history";
export const HISTORY_MAX = 20;
export const TOP_N = 5;
export const BOTTOM_N = 5;

// ---- Parsing ----

/** Parse a textarea of URLs (one per line) into an array of trimmed non-empty strings. */
export function parseUrlList(input: string): string[] {
  if (!input) return [];
  const out: string[] = [];
  for (const line of input.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    out.push(t);
  }
  return out;
}

/** Extract the href value from an `<a href="...">` or `<a href='...'>` HTML snippet. */
export function extractHref(line: string): string | null {
  if (!line) return null;
  const m = line.match(/<a\s+[^>]*?href\s*=\s*"([^"]+)"/i);
  if (m) return m[1];
  const m2 = line.match(/<a\s+[^>]*?href\s*=\s*'([^']+)'/i);
  if (m2) return m2[1];
  return null;
}

/** Extract anchor text from `<a href="...">text</a>`. */
export function extractAnchorText(line: string): string {
  if (!line) return "";
  const m = line.match(/<a\s+[^>]*>([\s\S]*?)<\/a>/i);
  if (!m) return "";
  // strip inner tags (e.g. <span>, <strong>)
  return m[1].replace(/<[^>]+>/g, "").trim();
}

/** Parse a textarea of internal-link lines (either plain URL or HTML anchor). */
export function parseInternalLinks(input: string): InternalLink[] {
  if (!input) return [];
  const out: InternalLink[] = [];
  for (const line of input.split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    const href = extractHref(t);
    if (href !== null) {
      const anchor = extractAnchorText(t);
      const normalized = normalizeUrl(href);
      out.push({
        raw: t,
        href,
        normalized,
        anchorText: anchor,
        isInternal: isInternalLink(href),
      });
    } else {
      // plain URL
      const normalized = normalizeUrl(t);
      out.push({
        raw: t,
        href: t,
        normalized,
        anchorText: "",
        isInternal: isInternalLink(t),
      });
    }
  }
  return out;
}

/** Aggressive URL normalization: strip fragment, query, trailing slash, lowercase host. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  let u = url.trim();
  // strip fragment
  const hashIdx = u.indexOf("#");
  if (hashIdx !== -1) u = u.slice(0, hashIdx);
  // strip query
  const qIdx = u.indexOf("?");
  if (qIdx !== -1) u = u.slice(0, qIdx);
  // lowercase host if it looks like an absolute URL
  try {
    const parsed = new URL(u);
    parsed.hostname = parsed.hostname.toLowerCase();
    // strip trailing slash from pathname (except root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    u = parsed.toString();
  } catch {
    // relative URL — just strip trailing slash (but preserve a lone "/")
    if (u.length > 1 && u.endsWith("/")) u = u.slice(0, -1);
  }
  return u;
}

/** Determine if a link is internal: relative, or absolute with http(s) scheme (no cross-domain check needed for this tool's purpose). */
export function isInternalLink(href: string): boolean {
  if (!href) return false;
  const t = href.trim().toLowerCase();
  if (t.startsWith("mailto:")) return false;
  if (t.startsWith("tel:")) return false;
  if (t.startsWith("javascript:")) return false;
  if (t.startsWith("#")) return false;
  if (t.startsWith("//")) return true; // protocol-relative
  if (t.startsWith("/")) return true; // absolute path
  if (t.startsWith("./") || t.startsWith("../")) return true;
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  return false;
}

// ---- Counting ----

/** Build a Map of normalized URL → InternalLink[] for fast lookup. */
export function buildLinkIndex(links: InternalLink[]): Map<string, InternalLink[]> {
  const idx = new Map<string, InternalLink[]>();
  for (const l of links) {
    if (!l.normalized) continue;
    if (!idx.has(l.normalized)) idx.set(l.normalized, []);
    idx.get(l.normalized)!.push(l);
  }
  return idx;
}

/** For each URL in the inventory, count how many internal links point to it. */
export function countLinks(urls: string[], links: InternalLink[]): UrlEntry[] {
  const index = buildLinkIndex(links);
  const out: UrlEntry[] = [];
  for (const original of urls) {
    const normalized = normalizeUrl(original);
    const matching = index.get(normalized) ?? [];
    const count = matching.length;
    const anchorTexts = Array.from(
      new Set(matching.map((m) => m.anchorText).filter((a) => a.length > 0)),
    );
    out.push({
      original,
      normalized,
      count,
      isOrphan: count === 0,
      anchorTexts,
    });
  }
  return out;
}

// ---- Report ----

/** Sort entries by count descending and return top N (only entries with count > 0). */
export function topLinkedPages(entries: UrlEntry[], n: number = TOP_N): UrlEntry[] {
  return entries
    .filter((e) => e.count > 0)
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

/** Sort entries by count ascending and return bottom N (orphans first). */
export function bottomLinkedPages(entries: UrlEntry[], n: number = BOTTOM_N): UrlEntry[] {
  return entries
    .slice()
    .sort((a, b) => a.count - b.count)
    .slice(0, n);
}

/** Filter entries to orphans only (count === 0). */
export function filterOrphans(entries: UrlEntry[]): UrlEntry[] {
  return entries.filter((e) => e.isOrphan);
}

/** Build the full orphan-page report. */
export function buildReport(urls: string[], links: InternalLink[]): OrphanReport {
  const entries = countLinks(urls, links);
  const orphanCount = entries.filter((e) => e.isOrphan).length;
  const linkedCount = entries.length - orphanCount;
  const totalLinks = links.length;
  const internalLinks = links.filter((l) => l.isInternal).length;
  const maxLinks = entries.reduce((m, e) => Math.max(m, e.count), 0);
  const avgLinksPerUrl =
    entries.length > 0 ? Math.round((totalLinks / entries.length) * 10) / 10 : 0;
  return {
    totalUrls: entries.length,
    totalLinks,
    internalLinks,
    orphanCount,
    linkedCount,
    avgLinksPerUrl,
    maxLinks,
    entries,
    topLinked: topLinkedPages(entries),
    bottomLinked: bottomLinkedPages(entries),
  };
}

// ---- Rendering ----

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function truncateUrl(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

/** Render the report as an aligned text table. */
export function renderTextTable(entries: UrlEntry[]): string {
  if (entries.length === 0) return "No URLs.";
  const header = ["URL", "LINKS", "STATUS"];
  const rows: string[][] = [header];
  for (const e of entries) {
    rows.push([
      truncateUrl(e.normalized, 80),
      String(e.count),
      e.isOrphan ? "ORPHAN" : "LINKED",
    ]);
  }
  const colWidths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i].length)),
  );
  const lines = rows.map((r) => r.map((c, i) => pad(c, colWidths[i])).join("  "));
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the report as CSV. */
export function renderCsv(entries: UrlEntry[]): string {
  const lines = ["url,link_count,status,anchor_texts"];
  for (const e of entries) {
    lines.push(
      [
        escapeCsv(e.normalized),
        e.count,
        e.isOrphan ? "orphan" : "linked",
        escapeCsv(e.anchorTexts.join(" | ")),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

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

export function buildShareUrl(urls: string, links: string): string {
  const params = new URLSearchParams();
  if (urls) params.set("urls", urls);
  if (links) params.set("links", links);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { urls: string; links: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { urls: "", links: "" };
  const params = new URLSearchParams(clean);
  return {
    urls: params.get("urls") ?? "",
    links: params.get("links") ?? "",
  };
}
