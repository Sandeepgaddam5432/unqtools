/**
 * Broken Link Checker — pure logic.
 *
 * Parse hrefs from HTML, classify internal vs external, detect common
 * issues (empty href, javascript:, # only, missing protocol, mailto/tel),
 * and produce a link report with stats.
 *
 * Pure functions only — no DOM, no network.
 */

export type LinkType = "internal" | "external" | "anchor" | "mailto" | "tel" | "javascript" | "empty" | "relative-no-base";

export interface LinkIssue {
  type: "empty-href" | "javascript-only" | "anchor-only" | "missing-protocol" | "relative-no-base" | "malformed";
  severity: "warning" | "error";
  message: string;
  recommendation: string;
}

export interface LinkInfo {
  href: string;
  text: string;
  type: LinkType;
  issues: LinkIssue[];
  // Resolved against base (if provided)
  resolvedUrl?: string;
  // Has rel="nofollow" / "sponsored" / "ugc"
  relAttributes: string[];
  // Has target="_blank"
  targetBlank: boolean;
}

export interface LinkResult {
  links: LinkInfo[];
  total: number;
  byType: Record<LinkType, number>;
  issuesCount: number;
  linksWithIssues: number;
  uniqueDomains: number;
  topExternalDomains: { domain: string; count: number }[];
}

/** Extract all <a> tags from HTML. */
export function extractAnchorTags(html: string): string[] {
  if (!html) return [];
  // Match <a ...>...</a> — but we only need the opening tag for href parsing
  const matches = html.match(/<a\b[^>]*>/gi);
  return matches ?? [];
}

/** Extract the href attribute value from an <a> tag. */
export function extractHref(anchorTag: string): string | null {
  if (!anchorTag) return null;
  const m = /\bhref\s*=\s*["']([^"']*)["']/i.exec(anchorTag);
  if (m) return m[1];
  // Unquoted href
  const m2 = /\bhref\s*=\s*([^\s>]+)/i.exec(anchorTag);
  return m2 ? m2[1] : null;
}

/** Extract the link text from an <a>...</a> pair in HTML. */
export function extractLinkText(html: string, anchorTag: string): string {
  if (!html || !anchorTag) return "";
  const idx = html.indexOf(anchorTag);
  if (idx < 0) return "";
  const after = html.slice(idx + anchorTag.length);
  const closeMatch = /<\/a>/i.exec(after);
  if (!closeMatch) return "";
  const inner = after.slice(0, closeMatch.index);
  // Strip nested tags
  return inner.replace(/<[^>]*>/g, "").trim();
}

/** Extract rel attribute values. */
export function extractRel(anchorTag: string): string[] {
  if (!anchorTag) return [];
  const m = /\brel\s*=\s*["']([^"']*)["']/i.exec(anchorTag);
  if (!m) return [];
  return m[1].toLowerCase().split(/\s+/).filter(Boolean);
}

/** Check for target="_blank". */
export function hasTargetBlank(anchorTag: string): boolean {
  return /\btarget\s*=\s*["']_blank["']/i.test(anchorTag);
}

/** Extract domain from URL. */
export function extractDomain(input: string): string {
  if (!input) return "";
  let s = input.toLowerCase().trim();
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.replace(/^\/\/+/, "");
  s = s.replace(/[/?#].*$/, "");
  s = s.replace(/:\d+$/, "");
  return s;
}

/** Classify link type. */
export function classifyLink(href: string, baseUrl?: string): LinkType {
  if (!href || !href.trim()) return "empty";
  const trimmed = href.trim().toLowerCase();
  if (trimmed.startsWith("javascript:")) return "javascript";
  if (trimmed.startsWith("mailto:")) return "mailto";
  if (trimmed.startsWith("tel:")) return "tel";
  if (trimmed.startsWith("#")) return "anchor";
  if (/^[a-z]+:\/\//.test(trimmed)) {
    // Has protocol — check if external
    if (baseUrl) {
      const baseDomain = extractDomain(baseUrl);
      const linkDomain = extractDomain(href);
      return baseDomain && linkDomain && baseDomain === linkDomain ? "internal" : "external";
    }
    return "external";
  }
  if (trimmed.startsWith("//")) {
    return baseUrl ? "external" : "relative-no-base";
  }
  if (trimmed.startsWith("/") || trimmed.startsWith("./") || trimmed.startsWith("../") || /^[^.]/.test(trimmed)) {
    // Relative — internal if base is provided, otherwise warn
    return baseUrl ? "internal" : "relative-no-base";
  }
  return "relative-no-base";
}

/** Resolve a relative URL against a base URL. */
export function resolveUrl(href: string, baseUrl?: string): string | undefined {
  if (!baseUrl) return undefined;
  // Reject obviously invalid hrefs that `new URL` is too permissive about.
  if (!href || /(^|\s)%%|\s/.test(href)) return undefined;
  try {
    const u = new URL(href, baseUrl);
    // `new URL` happily accepts some malformed inputs (e.g. "%%" relative to
    // a base). Re-check the result for the same characters we rejected above.
    if (u.toString().includes("%%")) return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

/** Detect issues with a link. */
export function detectIssues(href: string, type: LinkType): LinkIssue[] {
  const issues: LinkIssue[] = [];
  if (type === "empty") {
    issues.push({
      type: "empty-href",
      severity: "error",
      message: "Empty href attribute.",
      recommendation: "Provide a valid href or remove the link.",
    });
  }
  if (type === "javascript") {
    issues.push({
      type: "javascript-only",
      severity: "warning",
      message: "Uses javascript: in href — not crawlable by search engines.",
      recommendation: "Use a real URL with progressive enhancement; bind JS via addEventListener.",
    });
  }
  if (type === "anchor" || type === "anchor-only") {
    issues.push({
      type: "anchor-only",
      severity: "warning",
      message: "Anchor-only link (#...). Useful for in-page navigation but carries no link equity.",
      recommendation: "Ensure the anchor target exists. Avoid using # as a placeholder for buttons.",
    });
  }
  if (type === "relative-no-base") {
    issues.push({
      type: "relative-no-base",
      severity: "warning",
      message: "Relative URL with no base URL provided for resolution.",
      recommendation: "Provide a base URL or use absolute URLs.",
    });
  }
  if (type === "external") {
    if (!/^https?:\/\//i.test(href)) {
      issues.push({
        type: "missing-protocol",
        severity: "error",
        message: "External URL without explicit protocol.",
        recommendation: "Use https:// explicitly.",
      });
    }
    // Check for spaces or invalid characters
    if (/\s/.test(href)) {
      issues.push({
        type: "malformed",
        severity: "error",
        message: "URL contains whitespace.",
        recommendation: "URL-encode spaces (%20) or remove them.",
      });
    }
  }
  return issues;
}

/** Parse a single <a> tag into a LinkInfo. */
export function parseAnchor(anchorTag: string, html: string, baseUrl?: string): LinkInfo {
  const href = extractHref(anchorTag) ?? "";
  const text = extractLinkText(html, anchorTag);
  const type = classifyLink(href, baseUrl);
  const issues = detectIssues(href, type);
  const resolvedUrl = resolveUrl(href, baseUrl);
  const relAttributes = extractRel(anchorTag);
  const targetBlank = hasTargetBlank(anchorTag);
  return { href, text, type, issues, resolvedUrl, relAttributes, targetBlank };
}

/** Parse all links from HTML. */
export function parseAll(html: string, baseUrl?: string): LinkInfo[] {
  const tags = extractAnchorTags(html);
  return tags.map((tag) => parseAnchor(tag, html, baseUrl));
}

/** Analyze all links and produce a summary. */
export function analyze(html: string, baseUrl?: string): LinkResult {
  const links = parseAll(html, baseUrl);
  const byType: Record<LinkType, number> = {
    internal: 0,
    external: 0,
    anchor: 0,
    mailto: 0,
    tel: 0,
    javascript: 0,
    empty: 0,
    "relative-no-base": 0,
  };
  for (const l of links) byType[l.type] += 1;
  const issuesCount = links.reduce((acc, l) => acc + l.issues.length, 0);
  const linksWithIssues = links.filter((l) => l.issues.length > 0).length;
  // Unique external domains
  const domainMap = new Map<string, number>();
  for (const l of links) {
    if (l.type === "external") {
      const d = extractDomain(l.resolvedUrl ?? l.href);
      if (d) domainMap.set(d, (domainMap.get(d) ?? 0) + 1);
    }
  }
  const topExternalDomains = [...domainMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    links,
    total: links.length,
    byType,
    issuesCount,
    linksWithIssues,
    uniqueDomains: domainMap.size,
    topExternalDomains,
  };
}

/** Render CSV export. */
export function renderCsv(result: LinkResult): string {
  const lines: string[] = [];
  lines.push("# Summary");
  lines.push(`total,${result.total}`);
  lines.push(`internal,${result.byType.internal}`);
  lines.push(`external,${result.byType.external}`);
  lines.push(`issues,${result.issuesCount}`);
  lines.push(`links_with_issues,${result.linksWithIssues}`);
  lines.push(`unique_external_domains,${result.uniqueDomains}`);
  lines.push("");
  lines.push("# Links");
  lines.push("href,text,type,issues,target_blank,rel");
  for (const l of result.links) {
    lines.push([
      escapeCsv(l.href),
      escapeCsv(l.text),
      l.type,
      escapeCsv(l.issues.map((i) => i.type).join("; ")),
      l.targetBlank ? 1 : 0,
      escapeCsv(l.relAttributes.join(" ")),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render a plain-text report. */
export function renderReport(result: LinkResult): string {
  const lines: string[] = [];
  lines.push("Broken Link Checker Report");
  lines.push("==========================");
  lines.push(`Total links: ${result.total}`);
  lines.push(`Internal: ${result.byType.internal}`);
  lines.push(`External: ${result.byType.external}`);
  lines.push(`Anchor (#): ${result.byType.anchor}`);
  lines.push(`Mailto: ${result.byType.mailto}`);
  lines.push(`Tel: ${result.byType.tel}`);
  lines.push(`JavaScript: ${result.byType.javascript}`);
  lines.push(`Empty: ${result.byType.empty}`);
  lines.push(`Relative (no base): ${result.byType["relative-no-base"]}`);
  lines.push(`Total issues: ${result.issuesCount}`);
  lines.push(`Links with issues: ${result.linksWithIssues}`);
  lines.push(`Unique external domains: ${result.uniqueDomains}`);
  if (result.topExternalDomains.length > 0) {
    lines.push("");
    lines.push("Top external domains:");
    for (const d of result.topExternalDomains.slice(0, 5)) {
      lines.push(`  ${d.domain} (${d.count} link${d.count !== 1 ? "s" : ""})`);
    }
  }
  if (result.linksWithIssues > 0) {
    lines.push("");
    lines.push("Links with issues:");
    for (const l of result.links.filter((x) => x.issues.length > 0).slice(0, 20)) {
      lines.push(`  [${l.type}] ${l.href || "(empty)"}`);
      for (const i of l.issues) {
        lines.push(`    [${i.severity}] ${i.message}`);
      }
    }
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:broken-link-checker:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  total: number;
  internal: number;
  external: number;
  issuesCount: number;
  linksWithIssues: number;
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

export function buildShareUrl(payload: string, baseUrl?: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (baseUrl) params.set("base", baseUrl);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string; base: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "", base: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "", base: params.get("base") ?? "" };
}
