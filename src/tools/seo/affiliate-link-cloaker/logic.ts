/**
 * Affiliate Link Cloaker — pure logic.
 *
 * Cloak affiliate links into pretty URLs and generate redirect scripts
 * (PHP, JS, HTML meta refresh), .htaccess, nginx, robots.txt rules.
 * Pure functions only — no DOM, no network.
 */

export interface AffiliateLinkRecord {
  slug: string;
  affiliateUrl: string;
}

export interface ValidationIssue {
  field: "slug" | "affiliateUrl";
  message: string;
}

export interface CloakedLink extends AffiliateLinkRecord {
  prettyUrl: string;
  valid: boolean;
  issues: ValidationIssue[];
}

export interface CloakSummaryStats {
  total: number;
  valid: number;
  invalid: number;
  slugConflicts: number;
  urlIssues: number;
  slugFormatIssues: number;
}

export interface HistoryEntry {
  ts: number;
  baseUrl: string;
  linkCount: number;
  validCount: number;
}

export const HISTORY_KEY = "unqtools:affiliate-link-cloaker:history";
export const HISTORY_MAX = 20;

/** Default base URL used in placeholders/presets. */
export const EXAMPLE_BASE_URL = "https://example.com/go/";

/** CSV header expected when parsing the affiliate-links text. */
export const CSV_HEADER = "slug,affiliate_url";

/** Slug pattern: lowercase letters, digits, hyphens only. */
export const SLUG_REGEX = /^[a-z0-9-]+$/;

/** URL shortener length threshold (Bitly, TinyURL). */
export const SHORTENER_MAX_LEN = 30;

/**
 * Normalize the base URL — ensure it ends with a single trailing slash
 * and strip surrounding whitespace.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = (baseUrl || "").trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/**
 * Split a CSV row that may contain quoted values with embedded commas.
 * Mirrors RFC 4180 minimal behaviour.
 */
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

/**
 * Parse a CSV text of `slug,affiliate_url` rows. Blank lines and a
 * leading header row ("slug,affiliate_url") are skipped.
 */
export function parseCsvLinks(csvText: string): AffiliateLinkRecord[] {
  if (!csvText) return [];
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const out: AffiliateLinkRecord[] = [];
  for (const line of lines) {
    // Skip the header row if present.
    if (line.toLowerCase() === CSV_HEADER) continue;
    const parts = splitCsvRow(line);
    if (parts.length < 2) continue;
    const slug = parts[0].trim();
    const affiliateUrl = parts[1].trim();
    if (!slug && !affiliateUrl) continue;
    out.push({ slug, affiliateUrl });
  }
  return out;
}

/** Validate slug format (lowercase letters, digits, hyphens only). */
export function validateSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

/** Validate a URL: must have an http(s) scheme and a hostname. */
export function validateUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname;
  } catch {
    return false;
  }
}

/** Generate the pretty URL for a slug under a base URL. */
export function generatePrettyUrl(baseUrl: string, slug: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}${slug}`;
}

/**
 * Validate each link record. Detects slug format issues, duplicate slugs,
 * and malformed affiliate URLs.
 */
export function validateLinks(
  baseUrl: string,
  records: AffiliateLinkRecord[],
): CloakedLink[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.slug.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return records.map((r) => {
    const issues: ValidationIssue[] = [];
    if (!r.slug) {
      issues.push({ field: "slug", message: "Slug is empty" });
    } else if (!validateSlug(r.slug)) {
      issues.push({
        field: "slug",
        message: "Slug must match [a-z0-9-]+ (lowercase letters, digits, hyphens)",
      });
    }
    const slugCount = counts.get(r.slug.toLowerCase()) ?? 0;
    if (slugCount > 1) {
      issues.push({ field: "slug", message: "Duplicate slug" });
    }
    if (!validateUrl(r.affiliateUrl)) {
      issues.push({
        field: "affiliateUrl",
        message: "Affiliate URL must be a valid http(s) URL",
      });
    }
    return {
      ...r,
      prettyUrl: generatePrettyUrl(baseUrl, r.slug),
      valid: issues.length === 0,
      issues,
    };
  });
}

/** Generate a PHP redirect script for an affiliate URL. */
export function generatePhpRedirect(affiliateUrl: string): string {
  return `<?php
header("Location: ${affiliateUrl}");
exit;
?>`;
}

/** Generate a JavaScript redirect script for an affiliate URL. */
export function generateJsRedirect(affiliateUrl: string): string {
  return `<script>
window.location.href = "${affiliateUrl}";
</script>`;
}

/** Generate an HTML meta-refresh redirect for an affiliate URL. */
export function generateHtmlMetaRefresh(affiliateUrl: string): string {
  return `<meta http-equiv="refresh" content="0; url=${affiliateUrl}">`;
}

/**
 * Generate an .htaccess RewriteRule for one slug → affiliate URL.
 * Uses [R=301,L] flags (permanent redirect, last rule).
 */
export function generateHtaccessRule(slug: string, affiliateUrl: string): string {
  return `RewriteRule ^${slug}/?$ ${affiliateUrl} [R=301,L]`;
}

/** Generate nginx rewrite rule for one slug → affiliate URL. */
export function generateNginxRule(slug: string, affiliateUrl: string): string {
  return `location = /go/${slug} { return 301 ${affiliateUrl}; }`;
}

/**
 * Generate the full .htaccess block (header + rules).
 */
export function generateHtaccessBlock(
  baseUrl: string,
  records: CloakedLink[],
): string {
  const lines: string[] = [
    "# Affiliate link cloaker — .htaccess",
    "RewriteEngine On",
    `# Base: ${normalizeBaseUrl(baseUrl)}`,
    "",
  ];
  for (const r of records) {
    if (r.valid) {
      lines.push(generateHtaccessRule(r.slug, r.affiliateUrl));
    }
  }
  return lines.join("\n");
}

/**
 * Generate the full nginx server-block snippet.
 */
export function generateNginxBlock(
  baseUrl: string,
  records: CloakedLink[],
): string {
  const lines: string[] = [
    "# Affiliate link cloaker — nginx config",
    `# Base: ${normalizeBaseUrl(baseUrl)}`,
    "location /go/ {",
  ];
  for (const r of records) {
    if (r.valid) {
      lines.push("  " + generateNginxRule(r.slug, r.affiliateUrl));
    }
  }
  lines.push("}");
  return lines.join("\n");
}

/** Generate robots.txt Disallow entry to block the /go/ directory. */
export function generateRobotsTxt(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  let path = "/go/";
  try {
    const u = new URL(base);
    // Use only the path portion (everything after the host).
    if (u.pathname && u.pathname !== "/") {
      path = u.pathname.endsWith("/") ? u.pathname : `${u.pathname}/`;
    }
  } catch {
    // ignore — fallback to /go/
  }
  return `User-agent: *\nDisallow: ${path}`;
}

/**
 * Auto-generate a slug from an affiliate URL's hostname.
 * E.g. https://awesomeservice.com/?ref=123 → "awesomeservice"
 */
export function generateSlugFromUrl(affiliateUrl: string): string {
  if (!affiliateUrl) return "";
  try {
    const u = new URL(affiliateUrl);
    let host = u.hostname.toLowerCase();
    // Strip leading www.
    if (host.startsWith("www.")) host = host.slice(4);
    // Take only the first label (before the first dot).
    const firstLabel = host.split(".")[0] || host;
    // Lowercase + strip anything outside [a-z0-9-].
    return firstLabel.replace(/[^a-z0-9-]/g, "");
  } catch {
    return "";
  }
}

/**
 * Build a tracking URL by appending query params to a pretty URL.
 * E.g. prettyUrl + { src: "newsletter", utm_medium: "email" }
 * → prettyUrl?src=newsletter&utm_medium=email
 */
export function buildTrackingUrl(
  prettyUrl: string,
  params: Record<string, string>,
): string {
  const entries = Object.entries(params).filter(([k, v]) => k && v);
  if (entries.length === 0) return prettyUrl;
  const search = new URLSearchParams(entries.map(([k, v]) => [k, v]));
  const sep = prettyUrl.includes("?") ? "&" : "?";
  return `${prettyUrl}${sep}${search.toString()}`;
}

/**
 * Check whether the pretty URL is compatible with short URL length limits
 * (≤30 characters — Bitly/TinyURL custom alias max).
 */
export function checkUrlShortenerCompat(prettyUrl: string): {
  compatible: boolean;
  length: number;
  maxLength: number;
} {
  return {
    compatible: prettyUrl.length <= SHORTENER_MAX_LEN,
    length: prettyUrl.length,
    maxLength: SHORTENER_MAX_LEN,
  };
}

/** Compute summary statistics from the cloaked-link list. */
export function computeSummaryStats(links: CloakedLink[]): CloakSummaryStats {
  const total = links.length;
  let valid = 0;
  let slugConflicts = 0;
  let urlIssues = 0;
  let slugFormatIssues = 0;
  const slugSeen = new Map<string, number>();
  for (const l of links) {
    if (l.valid) valid++;
    let hasSlugFormat = false;
    let hasUrlIssue = false;
    let hasConflict = false;
    for (const issue of l.issues) {
      if (issue.field === "slug") {
        if (issue.message === "Duplicate slug") hasConflict = true;
        else hasSlugFormat = true;
      } else if (issue.field === "affiliateUrl") {
        hasUrlIssue = true;
      }
    }
    // Count duplicates only once per slug string (use slug lowercased).
    if (l.slug) {
      const key = l.slug.toLowerCase();
      slugSeen.set(key, (slugSeen.get(key) ?? 0) + 1);
    }
    if (hasConflict) slugConflicts++;
    if (hasUrlIssue) urlIssues++;
    if (hasSlugFormat) slugFormatIssues++;
  }
  // Re-count conflicts more accurately: count distinct slug strings that
  // appear more than once.
  let distinctConflicts = 0;
  for (const count of slugSeen.values()) {
    if (count > 1) distinctConflicts++;
  }
  return {
    total,
    valid,
    invalid: total - valid,
    slugConflicts: distinctConflicts,
    urlIssues,
    slugFormatIssues,
  };
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render the full text report (PHP, JS, meta, .htaccess, nginx, robots). */
export function renderTextReport(
  baseUrl: string,
  links: CloakedLink[],
): string {
  const valid = links.filter((l) => l.valid);
  const lines: string[] = [
    "=== Affiliate Link Cloaker — Report ===",
    `Base URL: ${normalizeBaseUrl(baseUrl)}`,
    `Total links: ${links.length} (valid: ${valid.length})`,
    "",
    "## Pretty URLs",
    ...valid.map((l) => `${l.slug}\t${l.prettyUrl}\t→ ${l.affiliateUrl}`),
    "",
    "## PHP redirects",
    ...valid.map((l) => `# ${l.slug}\n${generatePhpRedirect(l.affiliateUrl)}`),
    "",
    "## JavaScript redirects",
    ...valid.map((l) => `# ${l.slug}\n${generateJsRedirect(l.affiliateUrl)}`),
    "",
    "## HTML meta refresh",
    ...valid.map((l) => `# ${l.slug}\n${generateHtmlMetaRefresh(l.affiliateUrl)}`),
    "",
    "## .htaccess",
    generateHtaccessBlock(baseUrl, valid),
    "",
    "## nginx",
    generateNginxBlock(baseUrl, valid),
    "",
    "## robots.txt",
    generateRobotsTxt(baseUrl),
  ];
  return lines.join("\n");
}

/** Render the links as CSV: slug, affiliate_url, pretty_url. */
export function renderCsv(links: CloakedLink[]): string {
  const lines = [CSV_HEADER];
  for (const l of links) {
    lines.push([
      escapeCsv(l.slug),
      escapeCsv(l.affiliateUrl),
      escapeCsv(l.prettyUrl),
    ].join(","));
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

export function buildShareUrl(baseUrl: string, csvText: string): string {
  const params = new URLSearchParams();
  if (baseUrl) params.set("base", baseUrl);
  if (csvText) params.set("links", csvText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { baseUrl: string; csvText: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { baseUrl: "", csvText: "" };
  const params = new URLSearchParams(clean);
  return {
    baseUrl: params.get("base") ?? "",
    csvText: params.get("links") ?? "",
  };
}
