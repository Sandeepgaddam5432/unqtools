/**
 * XML Sitemap Generator — pure logic.
 */

export type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

export const CHANGE_FREQS: ChangeFreq[] = [
  "always", "hourly", "daily", "weekly", "monthly", "yearly", "never",
];

export interface SitemapUrl {
  loc: string;
  lastmod?: string; // YYYY-MM-DD
  changefreq?: ChangeFreq;
  priority?: number; // 0.0 - 1.0
}

export interface SitemapStats {
  urlCount: number;
  byteSize: number;
  isWithinLimits: boolean;
  needsIndex: boolean;
}

export const MAX_URLS_PER_SITEMAP = 50000;
export const MAX_BYTES_PER_SITEMAP = 50 * 1024 * 1024; // 50 MB

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidIsoDate(value: string): boolean {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value);
}

export function isValidPriority(p: number): boolean {
  return typeof p === "number" && p >= 0 && p <= 1;
}

export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Parse a bulk paste of URLs (one per line, with optional | lastmod | changefreq | priority). */
export function parseBulkUrls(bulk: string): SitemapUrl[] {
  if (!bulk || !bulk.trim()) return [];
  const lines = bulk.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: SitemapUrl[] = [];
  for (const line of lines) {
    const parts = line.split(/[|\t,]/).map((p) => p.trim());
    const loc = parts[0];
    if (!isValidUrl(loc)) continue;
    const url: SitemapUrl = { loc };
    if (parts[1] && isValidIsoDate(parts[1])) url.lastmod = parts[1];
    if (parts[2] && (CHANGE_FREQS as string[]).includes(parts[2])) {
      url.changefreq = parts[2] as ChangeFreq;
    }
    if (parts[3]) {
      const p = parseFloat(parts[3]);
      if (isValidPriority(p)) url.priority = p;
    }
    out.push(url);
  }
  return out;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateUrls(urls: SitemapUrl[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (urls.length === 0) {
    errors.push("At least one URL is required");
  }
  const seen = new Set<string>();
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    if (!isValidUrl(u.loc)) {
      errors.push(`URL #${i + 1} is invalid: ${u.loc}`);
    }
    if (seen.has(u.loc)) {
      warnings.push(`Duplicate URL detected: ${u.loc}`);
    }
    seen.add(u.loc);
    if (u.priority !== undefined && !isValidPriority(u.priority)) {
      errors.push(`Priority for ${u.loc} must be between 0.0 and 1.0`);
    }
    if (u.lastmod && !isValidIsoDate(u.lastmod)) {
      errors.push(`lastmod for ${u.loc} must be ISO 8601 (YYYY-MM-DD)`);
    }
  }
  if (urls.length > MAX_URLS_PER_SITEMAP) {
    warnings.push(`More than ${MAX_URLS_PER_SITEMAP} URLs — split into multiple sitemaps + use sitemap index`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function buildUrlEntry(u: SitemapUrl): string {
  const lines: string[] = ["  <url>"];
  lines.push(`    <loc>${escapeXml(u.loc)}</loc>`);
  if (u.lastmod) lines.push(`    <lastmod>${u.lastmod}</lastmod>`);
  if (u.changefreq) lines.push(`    <changefreq>${u.changefreq}</changefreq>`);
  if (u.priority !== undefined) lines.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
  lines.push("  </url>");
  return lines.join("\n");
}

export function generateSitemap(urls: SitemapUrl[]): string {
  const v = validateUrls(urls);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  const body = urls.map(buildUrlEntry).join("\n");
  const footer = `</urlset>`;
  return `${header}\n${body}\n${footer}`;
}

export interface IndexEntry {
  loc: string; // URL of the child sitemap
  lastmod?: string;
}

export function generateSitemapIndex(entries: IndexEntry[]): string {
  if (entries.length === 0) throw new Error("At least one sitemap entry is required");
  const header = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
  const body = entries
    .map((e) => {
      const lines = ["  <sitemap>"];
      lines.push(`    <loc>${escapeXml(e.loc)}</loc>`);
      if (e.lastmod) lines.push(`    <lastmod>${e.lastmod}</lastmod>`);
      lines.push("  </sitemap>");
      return lines.join("\n");
    })
    .join("\n");
  return `${header}\n${body}\n</sitemapindex>`;
}

export function computeStats(xml: string, urlCount: number): SitemapStats {
  const byteSize = new Blob([xml]).size;
  return {
    urlCount,
    byteSize,
    isWithinLimits: urlCount <= MAX_URLS_PER_SITEMAP && byteSize <= MAX_BYTES_PER_SITEMAP,
    needsIndex: urlCount > MAX_URLS_PER_SITEMAP || byteSize > MAX_BYTES_PER_SITEMAP,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function buildRobotsTxtSnippet(sitemapUrl: string): string {
  if (!isValidUrl(sitemapUrl)) return "";
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}`;
}

export function priorityPresets(): { label: string; value: number }[] {
  return [
    { label: "1.0 (highest)", value: 1.0 },
    { label: "0.9", value: 0.9 },
    { label: "0.8 (default)", value: 0.8 },
    { label: "0.7", value: 0.7 },
    { label: "0.5 (medium)", value: 0.5 },
    { label: "0.3", value: 0.3 },
    { label: "0.1 (low)", value: 0.1 },
    { label: "0.0 (do not index)", value: 0.0 },
  ];
}

// ---- History ----
const HISTORY_KEY = "unqtools:xml-sitemap-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  urlCount: number;
  snippet: string;
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
