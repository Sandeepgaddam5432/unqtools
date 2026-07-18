/**
 * SSL & HTTPS Checker — pure logic.
 *
 * Check SSL/HTTPS configuration from URL + HTML. Honest about network
 * requirements: this tool does NOT make live HTTPS requests. It analyzes
 * URL structure for protocol, parses HTML for mixed content, validates
 * HSTS header from pasted header data, and generates recommendations.
 *
 * Pure functions only — no DOM, no network.
 */

export type Rating = "pass" | "warn" | "fail";

export interface CheckResult {
  name: string;
  label: string;
  rating: Rating;
  score: number;
  details: string;
  recommendation: string;
}

export interface SslResult {
  url: string;
  protocol: string | null;
  isHttps: boolean;
  isHttp: boolean;
  checks: CheckResult[];
  score: number;
  rating: Rating;
  passCount: number;
  warnCount: number;
  failCount: number;
  recommendations: string[];
  mixedContent: MixedContentItem[];
  hstsInfo: HstsInfo | null;
}

export interface MixedContentItem {
  type: "image" | "script" | "stylesheet" | "iframe" | "audio" | "video" | "other";
  tag: string;
  src: string;
  severity: "active" | "passive";
}

export interface HstsInfo {
  raw: string;
  maxAge: number | null;
  includeSubDomains: boolean;
  preload: boolean;
  valid: boolean;
  issues: string[];
}

/** Parse a URL safely. */
export function parseUrl(input: string): { protocol: string | null; host: string | null; valid: boolean } {
  if (!input || !input.trim()) return { protocol: null, host: null, valid: false };
  try {
    const u = new URL(input.trim());
    return { protocol: u.protocol.replace(":", ""), host: u.host, valid: true };
  } catch {
    // Try with implicit https://
    try {
      const u = new URL(`https://${input.trim()}`);
      return { protocol: u.protocol.replace(":", ""), host: u.host, valid: true };
    } catch {
      return { protocol: null, host: null, valid: false };
    }
  }
}

/** Check if URL uses HTTPS. */
export function isHttps(url: string): boolean {
  const { protocol } = parseUrl(url);
  return protocol === "https";
}

/** Check if URL uses HTTP (not HTTPS). */
export function isHttp(url: string): boolean {
  const { protocol } = parseUrl(url);
  return protocol === "http";
}

/** Estimate the redirect target for an http→https upgrade. */
export function estimateHttpsRedirect(url: string): string {
  if (!url || !url.trim()) return "";
  const trimmed = url.trim();
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) return trimmed.replace(/^http:\/\//i, "https://");
  // Assume bare domain — prepend https://
  return `https://${trimmed}`;
}

/** Parse HSTS header value. */
export function parseHsts(value: string): HstsInfo {
  if (!value || !value.trim()) {
    return { raw: "", maxAge: null, includeSubDomains: false, preload: false, valid: false, issues: ["HSTS header is missing."] };
  }
  const raw = value.trim();
  const issues: string[] = [];
  let maxAge: number | null = null;
  let includeSubDomains = false;
  let preload = false;
  const tokens = raw.split(";").map((t) => t.trim());
  for (const t of tokens) {
    const lower = t.toLowerCase();
    const maxAgeMatch = /^max-age\s*=\s*(\d+)$/i.exec(t);
    if (maxAgeMatch) {
      maxAge = parseInt(maxAgeMatch[1], 10);
    }
    if (lower === "includesubdomains") includeSubDomains = true;
    if (lower === "preload") preload = true;
  }
  if (maxAge === null) {
    issues.push("HSTS is missing max-age directive.");
  } else if (maxAge < 10886400) {
    // 6 months = 15552000, but Google recommends at least 1 year (31536000) for preload
    issues.push(`max-age=${maxAge} is too short. Use at least 31536000 (1 year) for preload eligibility.`);
  }
  if (!includeSubDomains) {
    issues.push("includeSubDomains directive missing — subdomains are not protected.");
  }
  if (!preload) {
    issues.push("preload directive missing — site is not on the HSTS preload list.");
  }
  const valid = issues.length === 0;
  return { raw, maxAge, includeSubDomains, preload, valid, issues };
}

/** Detect mixed content in HTML. */
export function detectMixedContent(html: string, baseUrl?: string): MixedContentItem[] {
  if (!html) return [];
  const isBaseHttps = baseUrl ? isHttps(baseUrl) : false;
  const items: MixedContentItem[] = [];
  // Match tags with http:// src/href
  const tagRe = /<(img|script|link|iframe|audio|video|source|embed|object)\b[^>]*(?:src|href)\s*=\s*["']http:\/\/[^"']*["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const tagName = m[1].toLowerCase();
    const srcMatch = /\b(?:src|href)\s*=\s*["']([^"']*)["']/i.exec(tag);
    const src = srcMatch ? srcMatch[1] : "";
    const typeMap: Record<string, MixedContentItem["type"]> = {
      img: "image", source: "image",
      script: "script",
      link: "stylesheet",
      iframe: "iframe", embed: "iframe", object: "iframe",
      audio: "audio", video: "video",
    };
    const itemType = typeMap[tagName] ?? "other";
    // Active mixed content: script, link (stylesheet), iframe; passive: image, audio, video
    const severity: "active" | "passive" = ["script", "stylesheet", "iframe"].includes(itemType) ? "active" : "passive";
    items.push({ type: itemType, tag, src, severity });
  }
  // Only mark as issue if base URL is https (otherwise it's just plain http page, not "mixed")
  if (!isBaseHttps && items.length > 0) {
    // Not mixed content — just plain http page
    return [];
  }
  return items;
}

/** Run all checks. */
export function analyze(url: string, html?: string, hstsHeader?: string): SslResult {
  const parsed = parseUrl(url);
  const urlChecks: CheckResult[] = [];
  const isHttpsUrl = parsed.protocol === "https";
  const isHttpUrl = parsed.protocol === "http";
  let protocolScore = 0;
  if (!parsed.valid) {
    urlChecks.push({
      name: "url",
      label: "URL parsing",
      rating: "fail",
      score: 0,
      details: "Could not parse URL.",
      recommendation: "Provide a valid URL like https://example.com",
    });
  } else {
    // Protocol check
    if (isHttpsUrl) {
      urlChecks.push({
        name: "protocol",
        label: "HTTPS protocol",
        rating: "pass",
        score: 30,
        details: `URL uses HTTPS (host: ${parsed.host}).`,
        recommendation: "HTTPS is correctly configured.",
      });
      protocolScore = 30;
    } else if (isHttpUrl) {
      urlChecks.push({
        name: "protocol",
        label: "HTTPS protocol",
        rating: "fail",
        score: 0,
        details: `URL uses HTTP (host: ${parsed.host}). HTTPS is required.`,
        recommendation: `Upgrade to HTTPS: ${estimateHttpsRedirect(url)}`,
      });
    } else {
      urlChecks.push({
        name: "protocol",
        label: "HTTPS protocol",
        rating: "warn",
        score: 10,
        details: `URL uses non-HTTP protocol: ${parsed.protocol}.`,
        recommendation: "Use https:// protocol for web pages.",
      });
      protocolScore = 10;
    }
  }

  // Mixed content check (requires HTML)
  let mixedContent: MixedContentItem[] = [];
  if (html && html.trim()) {
    mixedContent = detectMixedContent(html, url);
    const activeCount = mixedContent.filter((m) => m.severity === "active").length;
    const passiveCount = mixedContent.filter((m) => m.severity === "passive").length;
    if (isHttpsUrl && mixedContent.length > 0) {
      urlChecks.push({
        name: "mixed-content",
        label: "Mixed content",
        rating: activeCount > 0 ? "fail" : "warn",
        score: activeCount > 0 ? 0 : 10,
        details: `${mixedContent.length} mixed-content item(s) found: ${activeCount} active (blocked by browser), ${passiveCount} passive (warning shown).`,
        recommendation: activeCount > 0
          ? "URGENT: Replace all http:// URLs in scripts/stylesheets/iframes with https://. Active mixed content is blocked by browsers."
          : "Replace http:// URLs in images/audio/video with https:// to avoid browser warnings.",
      });
    } else if (isHttpsUrl) {
      urlChecks.push({
        name: "mixed-content",
        label: "Mixed content",
        rating: "pass",
        score: 20,
        details: "No mixed content detected — all resources use HTTPS.",
        recommendation: "Mixed content is clean.",
      });
    } else {
      urlChecks.push({
        name: "mixed-content",
        label: "Mixed content",
        rating: "warn",
        score: 10,
        details: "Page is served over HTTP — mixed content not applicable, but page itself is insecure.",
        recommendation: "Upgrade page to HTTPS first, then re-check for mixed content.",
      });
    }
  }

  // HSTS check (requires header)
  let hstsInfo: HstsInfo | null = null;
  if (hstsHeader !== undefined && hstsHeader.trim()) {
    hstsInfo = parseHsts(hstsHeader);
    if (hstsInfo.valid) {
      urlChecks.push({
        name: "hsts",
        label: "HSTS header",
        rating: "pass",
        score: 20,
        details: `HSTS configured: max-age=${hstsInfo.maxAge}, includeSubDomains=${hstsInfo.includeSubDomains}, preload=${hstsInfo.preload}.`,
        recommendation: "HSTS is properly configured.",
      });
    } else {
      urlChecks.push({
        name: "hsts",
        label: "HSTS header",
        rating: "warn",
        score: 5,
        details: `HSTS present but with issues: ${hstsInfo.issues.join("; ")}`,
        recommendation: "Fix HSTS: max-age=31536000; includeSubDomains; preload",
      });
    }
  } else if (isHttpsUrl) {
    urlChecks.push({
      name: "hsts",
      label: "HSTS header",
      rating: "warn",
      score: 5,
      details: "HSTS header not provided. Paste the Strict-Transport-Security header value to test.",
      recommendation: "Add HSTS header: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    });
  }

  const totalScore = urlChecks.reduce((acc, c) => acc + c.score, 0);
  const maxScore = 70; // protocol 30 + mixed 20 + hsts 20
  const score = Math.min(100, Math.round((totalScore / maxScore) * 100));
  const passCount = urlChecks.filter((c) => c.rating === "pass").length;
  const warnCount = urlChecks.filter((c) => c.rating === "warn").length;
  const failCount = urlChecks.filter((c) => c.rating === "fail").length;
  let rating: Rating;
  if (failCount > 0) rating = "fail";
  else if (warnCount > 0) rating = "warn";
  else rating = "pass";
  const recommendations = urlChecks
    .filter((c) => c.rating !== "pass")
    .map((c) => `[${c.label}] ${c.recommendation}`);

  return {
    url: url.trim(),
    protocol: parsed.protocol,
    isHttps: isHttpsUrl,
    isHttp: isHttpUrl,
    checks: urlChecks,
    score,
    rating,
    passCount,
    warnCount,
    failCount,
    recommendations,
    mixedContent,
    hstsInfo,
  };
}

/** Render a plain-text report. */
export function renderReport(result: SslResult): string {
  const lines: string[] = [];
  lines.push("SSL & HTTPS Check Report");
  lines.push("=========================");
  lines.push(`URL: ${result.url}`);
  lines.push(`Protocol: ${result.protocol ?? "(invalid)"}`);
  lines.push(`Score: ${result.score}/100 (${result.rating})`);
  lines.push("");
  lines.push("Checks:");
  for (const c of result.checks) {
    lines.push(`  [${c.rating.toUpperCase()}] ${c.label}: ${c.details}`);
  }
  if (result.mixedContent.length > 0) {
    lines.push("");
    lines.push("Mixed content items:");
    for (const m of result.mixedContent) {
      lines.push(`  [${m.severity}] ${m.type}: ${m.src}`);
    }
  }
  if (result.hstsInfo) {
    lines.push("");
    lines.push(`HSTS: max-age=${result.hstsInfo.maxAge}, includeSubDomains=${result.hstsInfo.includeSubDomains}, preload=${result.hstsInfo.preload}`);
  }
  if (result.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of result.recommendations) {
      lines.push(`  - ${r}`);
    }
  }
  lines.push("");
  lines.push("NOTE: This tool does NOT make live HTTPS requests. It analyzes URL");
  lines.push("structure, mixed content in pasted HTML, and HSTS from pasted header data.");
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:ssl-https-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  url: string;
  score: number;
  rating: string;
  isHttps: boolean;
  mixedContentCount: number;
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

export interface ShareState {
  url: string;
  html: string;
  hsts: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.url) params.set("url", state.url);
  if (state.html) params.set("html", state.html);
  if (state.hsts) params.set("hsts", state.hsts);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const url = params.get("url");
  if (url !== null) out.url = url;
  const html = params.get("html");
  if (html !== null) out.html = html;
  const hsts = params.get("hsts");
  if (hsts !== null) out.hsts = hsts;
  return out;
}
