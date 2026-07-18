/**
 * Pagination SEO Checker — pure logic.
 *
 * Validate pagination SEO best practices: rel prev/next chain, canonical
 * self-reference, status codes, sequence gaps, duplicate canonicals.
 * Pure functions only — no DOM, no network.
 */

export type Severity = "critical" | "warning" | "info";

export interface PageMeta {
  url: string;
  relPrev?: string;
  relNext?: string;
  canonical?: string;
  statusCode?: number;
}

export interface PageIssue {
  url: string;
  pageNumber: number | null;
  issues: IssueDetail[];
  severity: Severity;
}

export interface IssueDetail {
  code: string;
  message: string;
  severity: Severity;
}

export interface PaginationReport {
  pages: PageIssue[];
  sequenceGaps: number[];
  duplicateCanonicals: { canonical: string; count: number; urls: string[] }[];
  summary: SummaryStats;
  recommendations: Recommendation[];
}

export interface SummaryStats {
  totalPages: number;
  totalPagesDetected: number;
  totalIssues: number;
  critical: number;
  warning: number;
  info: number;
}

export interface Recommendation {
  message: string;
  severity: Severity;
}

export interface HistoryEntry {
  ts: number;
  totalUrls: number;
  totalIssues: number;
  critical: number;
}

export const HISTORY_KEY = "unqtools:pagination-seo-checker:history";
export const HISTORY_MAX = 20;

export const PAGINATION_PATTERNS = [
  /\/page\/(\d+)/i,
  /[?&]page=(\d+)/i,
  /[?&]p=(\d+)/i,
  /\/p\/(\d+)/i,
  /[?&]pg=(\d+)/i,
] as const;

/** Normalize a URL: trim whitespace, strip fragments. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  let u = url.trim();
  if (u.startsWith("#")) return "";
  // Remove fragment
  const hashIdx = u.indexOf("#");
  if (hashIdx >= 0) u = u.slice(0, hashIdx);
  return u;
}

/** Parse URL list (one per line). */
export function parseUrlList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/\r?\n/)
    .map(normalizeUrl)
    .filter(Boolean);
}

/** Detect page number from URL using 5 patterns. */
export function detectPageNumber(url: string): number | null {
  if (!url) return null;
  for (const re of PAGINATION_PATTERNS) {
    const m = url.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
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

/** Parse metadata CSV. Header: url,rel_prev,rel_next,canonical,status_code. */
export function parseMetadataCsv(input: string): PageMeta[] {
  if (!input) return [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = splitCsvRow(lines[0]).map((s) => s.trim().toLowerCase());
  // Validate header has url column
  const urlIdx = header.findIndex((h) => h === "url");
  if (urlIdx === -1) return [];
  const relPrevIdx = header.findIndex((h) => h === "rel_prev" || h === "relprev");
  const relNextIdx = header.findIndex((h) => h === "rel_next" || h === "relnext");
  const canonicalIdx = header.findIndex((h) => h === "canonical");
  const statusIdx = header.findIndex((h) => h === "status_code" || h === "status");
  const out: PageMeta[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const url = (cols[urlIdx] ?? "").trim();
    if (!url) continue;
    const meta: PageMeta = { url };
    if (relPrevIdx >= 0 && cols[relPrevIdx]) meta.relPrev = cols[relPrevIdx].trim();
    if (relNextIdx >= 0 && cols[relNextIdx]) meta.relNext = cols[relNextIdx].trim();
    if (canonicalIdx >= 0 && cols[canonicalIdx]) meta.canonical = cols[canonicalIdx].trim();
    if (statusIdx >= 0 && cols[statusIdx]) {
      const code = parseInt(cols[statusIdx].trim(), 10);
      if (!isNaN(code)) meta.statusCode = code;
    }
    out.push(meta);
  }
  return out;
}

/** Build URL → PageMeta lookup. */
export function buildMetaLookup(metadata: PageMeta[]): Map<string, PageMeta> {
  const map = new Map<string, PageMeta>();
  for (const m of metadata) {
    if (m.url) map.set(m.url, m);
  }
  return map;
}

/** Detect sequence gaps in URLs (by page number). */
export function detectSequenceGaps(urls: string[]): number[] {
  const nums = urls
    .map((u) => detectPageNumber(u))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (nums.length < 2) return [];
  const gaps: number[] = [];
  const uniq = [...new Set(nums)];
  for (let i = 0; i < uniq.length - 1; i++) {
    const curr = uniq[i];
    const next = uniq[i + 1];
    if (next - curr > 1) {
      for (let g = curr + 1; g < next; g++) gaps.push(g);
    }
  }
  return gaps;
}

/** Detect duplicate canonicals (multiple URLs canonicalized to same target). */
export function detectDuplicateCanonicals(
  urls: string[],
  lookup: Map<string, PageMeta>,
): { canonical: string; count: number; urls: string[] }[] {
  const byCanonical = new Map<string, string[]>();
  for (const u of urls) {
    const meta = lookup.get(u);
    if (!meta?.canonical) continue;
    if (!byCanonical.has(meta.canonical)) byCanonical.set(meta.canonical, []);
    byCanonical.get(meta.canonical)!.push(u);
  }
  const out: { canonical: string; count: number; urls: string[] }[] = [];
  for (const [canonical, list] of byCanonical) {
    if (list.length > 1) {
      out.push({ canonical, count: list.length, urls: list });
    }
  }
  return out;
}

/** Validate rel prev/next chain. */
export function validateChain(
  urls: string[],
  lookup: Map<string, PageMeta>,
): IssueDetail[] {
  const issues: IssueDetail[] = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const meta = lookup.get(url);
    if (!meta) continue;
    const pageNum = detectPageNumber(url);
    // Page 1 should not have rel_prev
    if (pageNum === 1 && meta.relPrev) {
      issues.push({
        code: "page1-has-rel-prev",
        message: `Page 1 should not have rel=prev (found: ${meta.relPrev})`,
        severity: "warning",
      });
    }
    // Last page should not have rel_next
    if (i === urls.length - 1 && meta.relNext) {
      issues.push({
        code: "last-page-has-rel-next",
        message: `Last page should not have rel=next (found: ${meta.relNext})`,
        severity: "warning",
      });
    }
    // Missing rel_prev (except page 1)
    if (pageNum && pageNum > 1 && !meta.relPrev) {
      issues.push({
        code: "missing-rel-prev",
        message: `Missing rel=prev on page ${pageNum}`,
        severity: "critical",
      });
    }
    // Missing rel_next (except last page)
    if (i < urls.length - 1 && !meta.relNext) {
      issues.push({
        code: "missing-rel-next",
        message: `Missing rel=next on page ${pageNum ?? i + 1}`,
        severity: "critical",
      });
    }
    // rel_prev should point to previous URL
    if (i > 0 && meta.relPrev) {
      const prevUrl = urls[i - 1];
      if (meta.relPrev !== prevUrl && !urlsAreSamePage(meta.relPrev, prevUrl)) {
        issues.push({
          code: "broken-rel-prev",
          message: `rel=prev points to ${meta.relPrev} but expected ${prevUrl}`,
          severity: "critical",
        });
      }
    }
    // rel_next should point to next URL
    if (i < urls.length - 1 && meta.relNext) {
      const nextUrl = urls[i + 1];
      if (meta.relNext !== nextUrl && !urlsAreSamePage(meta.relNext, nextUrl)) {
        issues.push({
          code: "broken-rel-next",
          message: `rel=next points to ${meta.relNext} but expected ${nextUrl}`,
          severity: "critical",
        });
      }
    }
  }
  return issues;
}

/** Compare URLs ignoring trailing slashes + protocol. */
export function urlsAreSamePage(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = a.replace(/^https?:/, "").replace(/\/$/, "");
  const nb = b.replace(/^https?:/, "").replace(/\/$/, "");
  return na === nb;
}

/** Validate canonical points to self, not page 1. */
export function validateCanonical(
  urls: string[],
  lookup: Map<string, PageMeta>,
): IssueDetail[] {
  const issues: IssueDetail[] = [];
  for (const url of urls) {
    const meta = lookup.get(url);
    if (!meta) continue;
    if (!meta.canonical) {
      issues.push({
        code: "missing-canonical",
        message: `Missing canonical tag`,
        severity: "warning",
      });
      continue;
    }
    // Canonical should point to self
    if (!urlsAreSamePage(meta.canonical, url)) {
      const pageNum = detectPageNumber(url);
      // Check if canonical points to page 1 (common mistake)
      const canonicalPage = detectPageNumber(meta.canonical);
      if (pageNum && pageNum > 1 && (canonicalPage === 1 || canonicalPage === null)) {
        issues.push({
          code: "canonical-to-page1",
          message: `Canonical points to ${meta.canonical} instead of self — this collapses pagination`,
          severity: "critical",
        });
      } else {
        issues.push({
          code: "canonical-not-self",
          message: `Canonical points to ${meta.canonical} instead of self`,
          severity: "warning",
        });
      }
    }
  }
  return issues;
}

/** Validate status codes are 200. */
export function validateStatusCodes(
  urls: string[],
  lookup: Map<string, PageMeta>,
): IssueDetail[] {
  const issues: IssueDetail[] = [];
  for (const url of urls) {
    const meta = lookup.get(url);
    if (!meta) continue;
    if (meta.statusCode === undefined) {
      issues.push({
        code: "missing-status",
        message: `Missing status code`,
        severity: "info",
      });
      continue;
    }
    if (meta.statusCode !== 200) {
      const sev: Severity =
        meta.statusCode >= 500 ? "critical"
        : meta.statusCode >= 400 ? "critical"
        : meta.statusCode >= 300 ? "warning"
        : "info";
      issues.push({
        code: "non-200-status",
        message: `Status code ${meta.statusCode} (expected 200)`,
        severity: sev,
      });
    }
  }
  return issues;
}

/** Determine overall severity for a page from its issues. */
export function rollupSeverity(issues: IssueDetail[]): Severity {
  if (issues.some((i) => i.severity === "critical")) return "critical";
  if (issues.some((i) => i.severity === "warning")) return "warning";
  if (issues.length > 0) return "info";
  return "info";
}

/** Build full report. */
export function buildReport(urls: string[], metadata: PageMeta[]): PaginationReport {
  const lookup = buildMetaLookup(metadata);
  const sequenceGaps = detectSequenceGaps(urls);
  const duplicateCanonicals = detectDuplicateCanonicals(urls, lookup);
  const chainIssues = validateChain(urls, lookup);
  const canonicalIssues = validateCanonical(urls, lookup);
  const statusIssues = validateStatusCodes(urls, lookup);

  // Group issues per URL
  const issuesByUrl = new Map<string, IssueDetail[]>();
  // Chain issues: each has url property via lookup of position
  // We need to re-associate per-URL — rewrite to track URL context
  // Easier: rebuild per-URL issue list directly
  const pages: PageIssue[] = urls.map((url, i) => {
    const meta = lookup.get(url);
    const pageNum = detectPageNumber(url);
    const issues: IssueDetail[] = [];
    if (!meta) {
      // No metadata — informational only
      issues.push({
        code: "no-metadata",
        message: "No metadata provided for this URL",
        severity: "info",
      });
    } else {
      // Page 1 should not have rel_prev
      if (pageNum === 1 && meta.relPrev) {
        issues.push({
          code: "page1-has-rel-prev",
          message: `Page 1 should not have rel=prev (found: ${meta.relPrev})`,
          severity: "warning",
        });
      }
      // Last page should not have rel_next
      if (i === urls.length - 1 && meta.relNext) {
        issues.push({
          code: "last-page-has-rel-next",
          message: `Last page should not have rel=next (found: ${meta.relNext})`,
          severity: "warning",
        });
      }
      // Missing rel_prev (except page 1)
      if (pageNum && pageNum > 1 && !meta.relPrev) {
        issues.push({
          code: "missing-rel-prev",
          message: `Missing rel=prev on page ${pageNum}`,
          severity: "critical",
        });
      }
      // Missing rel_next (except last page)
      if (i < urls.length - 1 && !meta.relNext) {
        issues.push({
          code: "missing-rel-next",
          message: `Missing rel=next on page ${pageNum ?? i + 1}`,
          severity: "critical",
        });
      }
      // rel_prev should point to previous URL
      if (i > 0 && meta.relPrev) {
        const prevUrl = urls[i - 1];
        if (!urlsAreSamePage(meta.relPrev, prevUrl)) {
          issues.push({
            code: "broken-rel-prev",
            message: `rel=prev points to ${meta.relPrev} but expected ${prevUrl}`,
            severity: "critical",
          });
        }
      }
      // rel_next should point to next URL
      if (i < urls.length - 1 && meta.relNext) {
        const nextUrl = urls[i + 1];
        if (!urlsAreSamePage(meta.relNext, nextUrl)) {
          issues.push({
            code: "broken-rel-next",
            message: `rel=next points to ${meta.relNext} but expected ${nextUrl}`,
            severity: "critical",
          });
        }
      }
      // Canonical checks
      if (!meta.canonical) {
        issues.push({
          code: "missing-canonical",
          message: `Missing canonical tag`,
          severity: "warning",
        });
      } else if (!urlsAreSamePage(meta.canonical, url)) {
        const canonicalPage = detectPageNumber(meta.canonical);
        if (pageNum && pageNum > 1 && (canonicalPage === 1 || canonicalPage === null)) {
          issues.push({
            code: "canonical-to-page1",
            message: `Canonical points to ${meta.canonical} instead of self — this collapses pagination`,
            severity: "critical",
          });
        } else {
          issues.push({
            code: "canonical-not-self",
            message: `Canonical points to ${meta.canonical} instead of self`,
            severity: "warning",
          });
        }
      }
      // Status code checks
      if (meta.statusCode === undefined) {
        issues.push({
          code: "missing-status",
          message: `Missing status code`,
          severity: "info",
        });
      } else if (meta.statusCode !== 200) {
        const sev: Severity =
          meta.statusCode >= 400 ? "critical"
          : meta.statusCode >= 300 ? "warning"
          : "info";
        issues.push({
          code: "non-200-status",
          message: `Status code ${meta.statusCode} (expected 200)`,
          severity: sev,
        });
      }
    }
    // Sequence gap context — flag pages adjacent to gap
    if (pageNum && sequenceGaps.length > 0) {
      const nextExpected = pageNum + 1;
      if (sequenceGaps.includes(nextExpected)) {
        issues.push({
          code: "adjacent-sequence-gap",
          message: `Page ${nextExpected} is missing from the sequence`,
          severity: "warning",
        });
      }
    }
    return {
      url,
      pageNumber: pageNum,
      issues,
      severity: rollupSeverity(issues),
    };
  });

  const totalIssues = pages.reduce((sum, p) => sum + p.issues.length, 0);
  const critical = pages.reduce(
    (sum, p) => sum + p.issues.filter((i) => i.severity === "critical").length, 0);
  const warning = pages.reduce(
    (sum, p) => sum + p.issues.filter((i) => i.severity === "warning").length, 0);
  const info = pages.reduce(
    (sum, p) => sum + p.issues.filter((i) => i.severity === "info").length, 0);

  const totalPagesDetected = pages.filter((p) => p.pageNumber !== null).length;

  const summary: SummaryStats = {
    totalPages: pages.length,
    totalPagesDetected,
    totalIssues,
    critical,
    warning,
    info,
  };

  const recommendations = generateRecommendations(pages, sequenceGaps, duplicateCanonicals);

  // suppress unused-variable lint by referencing chain/canonical/status issues
  void chainIssues; void canonicalIssues; void statusIssues;

  return {
    pages,
    sequenceGaps,
    duplicateCanonicals,
    summary,
    recommendations,
  };
}

/** Generate recommendations. */
export function generateRecommendations(
  pages: PageIssue[],
  gaps: number[],
  dupes: { canonical: string; count: number; urls: string[] }[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  const missingRelNext = pages.filter((p) =>
    p.issues.some((i) => i.code === "missing-rel-next"));
  if (missingRelNext.length > 0) {
    recs.push({
      message: `Add rel=next to ${missingRelNext.length} page(s): ${missingRelNext.slice(0, 3).map((p) => p.url).join(", ")}${missingRelNext.length > 3 ? "…" : ""}`,
      severity: "critical",
    });
  }

  const missingRelPrev = pages.filter((p) =>
    p.issues.some((i) => i.code === "missing-rel-prev"));
  if (missingRelPrev.length > 0) {
    recs.push({
      message: `Add rel=prev to ${missingRelPrev.length} page(s)`,
      severity: "critical",
    });
  }

  const canonicalToPage1 = pages.filter((p) =>
    p.issues.some((i) => i.code === "canonical-to-page1"));
  if (canonicalToPage1.length > 0) {
    recs.push({
      message: `Fix ${canonicalToPage1.length} canonical(s) pointing to page 1 — set each canonical to its own URL`,
      severity: "critical",
    });
  }

  if (gaps.length > 0) {
    recs.push({
      message: `Fill ${gaps.length} sequence gap(s): missing page(s) ${gaps.slice(0, 5).join(", ")}${gaps.length > 5 ? "…" : ""}`,
      severity: "warning",
    });
  }

  if (dupes.length > 0) {
    recs.push({
      message: `Resolve ${dupes.length} duplicate canonical group(s) — each page should have a unique canonical`,
      severity: "warning",
    });
  }

  const non200 = pages.filter((p) =>
    p.issues.some((i) => i.code === "non-200-status"));
  if (non200.length > 0) {
    recs.push({
      message: `Fix ${non200.length} page(s) with non-200 status codes`,
      severity: "critical",
    });
  }

  if (recs.length === 0) {
    recs.push({
      message: "Pagination SEO looks good — rel prev/next chain, canonicals, and status codes all validated.",
      severity: "info",
    });
  }
  return recs;
}

/** Filter pages by severity. */
export function filterBySeverity(pages: PageIssue[], sev: Severity | "all"): PageIssue[] {
  if (sev === "all") return pages;
  return pages.filter((p) => p.severity === sev);
}

/** Render as text report. */
export function renderTextReport(report: PaginationReport): string {
  const lines: string[] = [];
  lines.push("=== Pagination SEO Checker Report ===");
  lines.push("");
  lines.push("SUMMARY");
  lines.push(`  Total URLs:           ${report.summary.totalPages}`);
  lines.push(`  Pages with detected page numbers: ${report.summary.totalPagesDetected}`);
  lines.push(`  Total issues:         ${report.summary.totalIssues}`);
  lines.push(`  Critical:             ${report.summary.critical}`);
  lines.push(`  Warning:              ${report.summary.warning}`);
  lines.push(`  Info:                 ${report.summary.info}`);
  if (report.sequenceGaps.length > 0) {
    lines.push(`  Sequence gaps:        ${report.sequenceGaps.join(", ")}`);
  }
  if (report.duplicateCanonicals.length > 0) {
    lines.push(`  Duplicate canonicals: ${report.duplicateCanonicals.length} group(s)`);
  }
  lines.push("");
  lines.push("PER-URL ISSUES");
  for (const p of report.pages) {
    const pageLabel = p.pageNumber !== null ? ` [page ${p.pageNumber}]` : "";
    lines.push(`  ${p.url}${pageLabel} (${p.severity.toUpperCase()})`);
    if (p.issues.length === 0) {
      lines.push("    ✓ no issues");
    } else {
      for (const issue of p.issues) {
        lines.push(`    [${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
      }
    }
  }
  lines.push("");
  lines.push("RECOMMENDATIONS");
  for (const r of report.recommendations) {
    lines.push(`  [${r.severity.toUpperCase()}] ${r.message}`);
  }
  lines.push("");
  lines.push("--- Generated by UnQTools Pagination SEO Checker (100% client-side) ---");
  return lines.join("\n");
}

/** Render as CSV: url, page_num, issues, severity. */
export function renderCsv(report: PaginationReport): string {
  const lines: string[] = [];
  lines.push("url,page_num,issues,severity");
  for (const p of report.pages) {
    const issueSummary = p.issues.length === 0
      ? "none"
      : p.issues.map((i) => `${i.code}:${i.severity}`).join(" | ");
    lines.push([
      escapeCsv(p.url),
      p.pageNumber ?? "",
      escapeCsv(issueSummary),
      p.severity,
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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

export function buildShareUrl(urlsText: string, metaText: string): string {
  const params = new URLSearchParams();
  if (urlsText) params.set("urls", urlsText);
  if (metaText) params.set("meta", metaText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { urls: string; meta: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { urls: "", meta: "" };
  const params = new URLSearchParams(clean);
  return {
    urls: params.get("urls") ?? "",
    meta: params.get("meta") ?? "",
  };
}
