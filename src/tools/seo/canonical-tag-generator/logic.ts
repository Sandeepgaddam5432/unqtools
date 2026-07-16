/**
 * Canonical Tag Generator — pure logic.
 */

export interface CanonicalInput {
  canonicalUrl: string;
  pageUrl?: string; // current page URL (to detect cross-domain)
  prevUrl?: string;
  nextUrl?: string;
  stripTrackingParams?: boolean;
}

export interface CanonicalFinding {
  severity: "high" | "medium" | "low" | "info";
  message: string;
  recommendation: string;
}

export interface CanonicalAnalysis {
  normalizedUrl: string;
  tag: string | null;
  prevTag: string | null;
  nextTag: string | null;
  findings: CanonicalFinding[];
  isAbsolute: boolean;
  isHttps: boolean;
  hasWww: boolean;
  hasTrailingSlash: boolean;
}

const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid", "msclkid", "mc_eid", "mc_cid"];

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** Normalize: lowercase host, strip default port, remove duplicate slashes, optionally strip tracking params. */
export function normalizeUrl(url: string, opts: { stripTrackingParams?: boolean } = {}): string {
  if (!url) return "";
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return url;
  }
  // Lowercase host
  u.hostname = u.hostname.toLowerCase();
  // Strip default port
  if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
    u.port = "";
  }
  // Remove duplicate slashes in pathname (except after protocol)
  let path = u.pathname;
  while (path.includes("//")) {
    path = path.replace(/\/\//g, "/");
  }
  u.pathname = path;
  // Optionally strip tracking params
  if (opts.stripTrackingParams) {
    for (const p of TRACKING_PARAMS) {
      u.searchParams.delete(p);
    }
  }
  return u.toString();
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildCanonicalTag(url: string): string | null {
  if (!url || !url.trim()) return null;
  if (!isValidUrl(url)) return null;
  return `<link rel="canonical" href="${escapeHtml(url)}" />`;
}

export function buildPrevTag(url: string): string | null {
  if (!url || !url.trim()) return null;
  if (!isValidUrl(url)) return null;
  return `<link rel="prev" href="${escapeHtml(url)}" />`;
}

export function buildNextTag(url: string): string | null {
  if (!url || !url.trim()) return null;
  if (!isValidUrl(url)) return null;
  return `<link rel="next" href="${escapeHtml(url)}" />`;
}

export function analyzeCanonical(input: CanonicalInput): CanonicalAnalysis {
  const findings: CanonicalFinding[] = [];
  const normalized = normalizeUrl(input.canonicalUrl, { stripTrackingParams: input.stripTrackingParams ?? false });
  let isAbsolute = false;
  let isHttps = false;
  let hasWww = false;
  let hasTrailingSlash = false;
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(normalized);
    isAbsolute = true;
    isHttps = parsedUrl.protocol === "https:";
    hasWww = parsedUrl.hostname.startsWith("www.");
    hasTrailingSlash = parsedUrl.pathname.endsWith("/");
  } catch {
    // not a valid URL
  }

  if (!input.canonicalUrl || !input.canonicalUrl.trim()) {
    findings.push({
      severity: "high",
      message: "Canonical URL is empty",
      recommendation: "Specify the canonical URL — every page should have one.",
    });
  } else if (!isAbsoluteUrl(input.canonicalUrl)) {
    findings.push({
      severity: "high",
      message: "Canonical URL is relative",
      recommendation: "Canonical URLs should be absolute (start with http:// or https://). Relative URLs are technically allowed but discouraged.",
    });
  } else if (!isValidUrl(input.canonicalUrl)) {
    findings.push({
      severity: "high",
      message: "Canonical URL is malformed",
      recommendation: "Check the URL syntax — must be a valid http(s) URL.",
    });
  }

  if (parsedUrl) {
    if (!isHttps) {
      findings.push({
        severity: "medium",
        message: "Canonical URL is not HTTPS",
        recommendation: "Use HTTPS canonical URLs. Google prefers HTTPS and so should you.",
      });
    }
    if (input.pageUrl) {
      try {
        const page = new URL(input.pageUrl);
        if (page.hostname !== parsedUrl.hostname) {
          findings.push({
            severity: "low",
            message: `Canonical hostname (${parsedUrl.hostname}) differs from page hostname (${page.hostname})`,
            recommendation: "Cross-domain canonical is valid but should be used carefully. Make sure this is intentional.",
          });
        }
        if (page.protocol !== parsedUrl.protocol) {
          findings.push({
            severity: "medium",
            message: "Protocol mismatch between page and canonical",
            recommendation: "Keep the canonical on the same protocol as the page (preferably HTTPS).",
          });
        }
      } catch {
        // ignore page URL parse errors
      }
    }
    // Check for query params
    if (parsedUrl.search && parsedUrl.search.length > 0) {
      const params = Array.from(parsedUrl.searchParams.keys());
      const trackingParamsPresent = params.some((p) => TRACKING_PARAMS.includes(p));
      if (trackingParamsPresent) {
        findings.push({
          severity: "medium",
          message: "Canonical URL contains tracking parameters",
          recommendation: "Strip utm_*, gclid, fbclid from canonical URLs. Enable 'strip tracking params' option.",
        });
      } else {
        findings.push({
          severity: "info",
          message: "Canonical URL contains query parameters",
          recommendation: "Consider whether the query params are necessary. If they don't change content, strip them.",
        });
      }
    }
    // Check trailing slash consistency
    if (input.pageUrl) {
      try {
        const page = new URL(input.pageUrl);
        const pageHasSlash = page.pathname.endsWith("/");
        if (pageHasSlash !== hasTrailingSlash) {
          findings.push({
            severity: "low",
            message: "Trailing slash mismatch between page and canonical",
            recommendation: "Be consistent — either always use trailing slashes or never. Pick one and stick with it site-wide.",
          });
        }
      } catch {
        // ignore
      }
    }
    // Check www consistency
    if (input.pageUrl) {
      try {
        const page = new URL(input.pageUrl);
        const pageHasWww = page.hostname.startsWith("www.");
        if (pageHasWww !== hasWww) {
          findings.push({
            severity: "low",
            message: "www vs non-www mismatch",
            recommendation: "Choose one (www or non-www) and 301-redirect the other to it. Canonical should match the preferred version.",
          });
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    normalizedUrl: normalized,
    tag: buildCanonicalTag(normalized),
    prevTag: input.prevUrl ? buildPrevTag(input.prevUrl) : null,
    nextTag: input.nextUrl ? buildNextTag(input.nextUrl) : null,
    findings,
    isAbsolute,
    isHttps,
    hasWww,
    hasTrailingSlash,
  };
}

/** Batch process multiple URLs. */
export function analyzeBatch(urls: string[]): Array<{ url: string; normalized: string; tag: string | null; findings: CanonicalFinding[] }> {
  return urls.map((u) => {
    const a = analyzeCanonical({ canonicalUrl: u });
    return { url: u, normalized: a.normalizedUrl, tag: a.tag, findings: a.findings };
  });
}

export function buildAllTags(input: CanonicalInput): string {
  const a = analyzeCanonical(input);
  const tags: string[] = [];
  if (a.tag) tags.push(a.tag);
  if (a.prevTag) tags.push(a.prevTag);
  if (a.nextTag) tags.push(a.nextTag);
  return tags.join("\n");
}

// ---- History ----
const HISTORY_KEY = "unqtools:canonical-tag-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  url: string;
  tag: string;
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

export function buildShareUrl(input: CanonicalInput): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") {
      if (v) params.set(k, "1");
    } else {
      params.set(k, String(v));
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<CanonicalInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  const result = out as Partial<CanonicalInput>;
  if (out.stripTrackingParams) {
    result.stripTrackingParams = out.stripTrackingParams === "1" || out.stripTrackingParams === "true";
  }
  return result;
}
