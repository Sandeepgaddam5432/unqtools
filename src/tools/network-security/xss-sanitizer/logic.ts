/**
 * XSS Code Sanitizer — pure logic.
 *
 * Provides context-aware output encoding (HTML/JS/CSS/URL/attribute), tag and
 * attribute allowlists, event-handler removal, javascript: protocol removal,
 * data: URI filtering, severity scoring, and custom allowlist support.
 *
 * Pure only — no DOM. The encoding functions are designed to be safe enough
 * for reflective output, but the UI should still wrap content in proper
 * element-context boundaries.
 */

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type Context = "html" | "js" | "css" | "url" | "attribute";

export interface SanitizeOptions {
  /** Allowlist of tag names (lowercase). */
  allowedTags?: string[];
  /** Allowlist of attribute names (lowercase). */
  allowedAttributes?: string[];
  /** Allow data: URIs in src/href attributes. */
  allowDataUris?: boolean;
  /** Strip inline event handlers (on*). */
  stripEventHandlers?: boolean;
  /** Strip javascript: URLs. */
  stripJavascriptUrls?: boolean;
}

export const DEFAULT_ALLOWED_TAGS = [
  "a", "b", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6",
  "hr", "i", "img", "li", "ol", "p", "pre", "span", "strong", "table", "tbody",
  "td", "th", "thead", "tr", "u", "ul", "blockquote", "q",
];

export const DEFAULT_ALLOWED_ATTRIBUTES = [
  "href", "src", "alt", "title", "class", "id", "width", "height",
  "colspan", "rowspan", "target", "rel", "lang", "dir",
];

/** HTML-encode a string for safe insertion into HTML text content. */
export function encodeHtml(input: string): string {
  return (input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Encode for an HTML attribute value (double-quoted context). */
export function encodeAttribute(input: string): string {
  return encodeHtml(input);
}

/** Encode for JavaScript string literal context. */
export function encodeJs(input: string): string {
  return (input || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, "\\\"")
    .replace(/`/g, "\\`")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/** Encode for CSS context (string or property value). */
export function encodeCss(input: string): string {
  return (input || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, "\\\"")
    .replace(/'/g, "\\'")
    .replace(/</g, "\\3c ")
    .replace(/>/g, "\\3e ")
    .replace(/&/g, "\\26 ")
    .replace(/{/g, "\\7b ")
    .replace(/}/g, "\\7d ");
}

/** Encode for URL context (percent-encoding). */
export function encodeUrl(input: string): string {
  try {
    return encodeURIComponent(input || "");
  } catch {
    return "";
  }
}

/** Encode a string for a specific output context. */
export function encodeForContext(input: string, ctx: Context): string {
  switch (ctx) {
    case "html": return encodeHtml(input);
    case "attribute": return encodeAttribute(input);
    case "js": return encodeJs(input);
    case "css": return encodeCss(input);
    case "url": return encodeUrl(input);
  }
}

/** Remove inline event handler attributes (onclick, onload, onerror, ...). */
export function removeEventHandlers(html: string): string {
  return html.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/** Remove javascript: URLs from href/src attributes. */
export function removeJavascriptUrls(html: string): string {
  return html.replace(/(href|src|action|formaction)\s*=\s*(['"])javascript:[^'"]*\2/gi, "$1=$2#$2");
}

/** Filter data: URIs in src/href (keep only image types). */
export function filterDataUris(html: string, allowDataUris = false): string {
  if (allowDataUris) {
    // Allow only image data URIs
    return html.replace(/(src|href)\s*=\s*(['"])data:([^'"]*)\2/gi, (match, attr, quote, payload) => {
      if (/^image\//i.test(payload)) return match;
      return `${attr}=${quote}#${quote}`;
    });
  }
  return html.replace(/(src|href)\s*=\s*(['"])data:[^'"]*\2/gi, "$1=$2#$2");
}

/** Strip tags not in the allowlist. Plain string-based — safe for reflective use. */
export function stripDisallowedTags(html: string, allowedTags: string[]): string {
  const allowed = new Set(allowedTags.map((t) => t.toLowerCase()));
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g, (match, tagName) => {
    if (allowed.has(tagName.toLowerCase())) return match;
    return "";
  });
}

/** Strip attributes not in the allowlist from each tag. */
export function stripDisallowedAttributes(html: string, allowedAttrs: string[]): string {
  const allowed = new Set(allowedAttrs.map((a) => a.toLowerCase()));
  return html.replace(/<([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*)?)>/g, (match, tagName, attrs) => {
    const cleaned = attrs.replace(/\s+([a-zA-Z-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (m, name) => {
      return allowed.has(name.toLowerCase()) ? m : "";
    });
    return `<${tagName}${cleaned}>`;
  });
}

export interface SanitizeResult {
  sanitized: string;
  removedTags: number;
  removedAttributes: number;
  removedEventHandlers: number;
  removedJavascriptUrls: number;
  removedDataUris: number;
  severity: Severity;
  warnings: string[];
}

/** Full sanitization pipeline. */
export function sanitize(html: string, opts: SanitizeOptions = {}): SanitizeResult {
  const warnings: string[] = [];
  const allowedTags = opts.allowedTags ?? DEFAULT_ALLOWED_TAGS;
  const allowedAttrs = opts.allowedAttributes ?? DEFAULT_ALLOWED_ATTRIBUTES;
  const stripEvents = opts.stripEventHandlers ?? true;
  const stripJs = opts.stripJavascriptUrls ?? true;

  let removedTags = 0;
  let removedAttributes = 0;
  let removedEventHandlers = 0;
  let removedJavascriptUrls = 0;
  let removedDataUris = 0;

  let s = html;
  if (stripEvents) {
    const before = s.length;
    s = removeEventHandlers(s);
    removedEventHandlers = before > s.length ? 1 : 0;
  }
  if (stripJs) {
    const before = s.length;
    s = removeJavascriptUrls(s);
    removedJavascriptUrls = before > s.length ? 1 : 0;
  }
  {
    const before = s;
    s = filterDataUris(s, opts.allowDataUris ?? false);
    if (before !== s) removedDataUris = 1;
  }
  {
    const before = s;
    s = stripDisallowedTags(s, allowedTags);
    const beforeTags = before.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) || [];
    const afterTags = s.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) || [];
    removedTags = beforeTags.length - afterTags.length;
  }
  {
    const before = s;
    s = stripDisallowedAttributes(s, allowedAttrs);
    if (before !== s) removedAttributes = 1;
  }

  if (removedEventHandlers) warnings.push("Inline event handlers (on*) removed.");
  if (removedJavascriptUrls) warnings.push("javascript: URLs neutralised.");
  if (removedDataUris) warnings.push("Unsafe data: URIs filtered.");

  const severity = computeSeverity({ removedEventHandlers, removedJavascriptUrls, removedDataUris, removedTags });

  return { sanitized: s, removedTags, removedAttributes, removedEventHandlers, removedJavascriptUrls, removedDataUris, severity, warnings };
}

/** Compute a severity level from counts of removed patterns. */
export function computeSeverity(counts: {
  removedEventHandlers: number; removedJavascriptUrls: number;
  removedDataUris: number; removedTags: number;
}): Severity {
  const { removedEventHandlers, removedJavascriptUrls, removedDataUris, removedTags } = counts;
  if (removedJavascriptUrls) return "critical";
  if (removedEventHandlers) return "high";
  if (removedDataUris) return "medium";
  if (removedTags > 0) return "low";
  return "info";
}

export interface SanitizeJob {
  html: string;
  opts?: SanitizeOptions;
}

/** Batch sanitize multiple HTML snippets. */
export function sanitizeBatch(jobs: SanitizeJob[]): SanitizeResult[] {
  return jobs.map((j) => sanitize(j.html, j.opts));
}

export interface BatchStats {
  count: number;
  bySeverity: Record<Severity, number>;
  totalRemoved: number;
}

/** Aggregate stats from a batch of sanitize results. */
export function batchStats(results: SanitizeResult[]): BatchStats {
  const bySeverity: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  let totalRemoved = 0;
  for (const r of results) {
    bySeverity[r.severity]++;
    totalRemoved += r.removedTags + r.removedAttributes + r.removedEventHandlers + r.removedJavascriptUrls + r.removedDataUris;
  }
  return { count: results.length, bySeverity, totalRemoved };
}

/** Render a CSV from a batch result. */
export function renderBatchCsv(results: SanitizeResult[]): string {
  const lines = ["index,severity,removed_tags,removed_attrs,removed_events,removed_js_urls,removed_data_uris"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), r.severity, r.removedTags, r.removedAttributes,
      r.removedEventHandlers, r.removedJavascriptUrls, r.removedDataUris].join(","));
  });
  return lines.join("\n");
}

/** Render a plain-text report for a single sanitize result. */
export function renderReport(r: SanitizeResult): string {
  const lines: string[] = [];
  lines.push("XSS Sanitization Report");
  lines.push("=".repeat(40));
  lines.push(`Severity: ${r.severity}`);
  lines.push(`Removed tags: ${r.removedTags}`);
  lines.push(`Removed attributes: ${r.removedAttributes}`);
  lines.push(`Removed event handlers: ${r.removedEventHandlers}`);
  lines.push(`Removed javascript: URLs: ${r.removedJavascriptUrls}`);
  lines.push(`Removed data: URIs: ${r.removedDataUris}`);
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  lines.push(""); lines.push("Sanitized output:");
  lines.push(r.sanitized);
  return lines.join("\n");
}

/** Severity color mapping for UI badges. */
export const SEVERITY_COLOR: Record<Severity, string> = {
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  critical: "bg-red-500/15 text-red-700 dark:text-red-300",
};

export function getDefaults() {
  return {
    allowedTags: [...DEFAULT_ALLOWED_TAGS],
    allowedAttributes: [...DEFAULT_ALLOWED_ATTRIBUTES],
  };
}
