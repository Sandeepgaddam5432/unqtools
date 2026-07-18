/**
 * Meta Robots & X-Robots-Tag Tester — pure logic.
 *
 * Parse and validate meta robots directives (meta tag + X-Robots-Tag header),
 * detect conflicts, generate recommendations.
 *
 * Pure functions only — no DOM, no network.
 */

export type Directive =
  | "index"
  | "noindex"
  | "follow"
  | "nofollow"
  | "noarchive"
  | "nosnippet"
  | "notranslate"
  | "noimageindex"
  | "unavailable_after"
  | "max-snippet"
  | "max-image-preview"
  | "max-video-preview"
  | "all"
  | "none";

export interface ParsedDirectives {
  directives: Record<string, string | boolean>;
  hasIndex: boolean;
  hasNoindex: boolean;
  hasFollow: boolean;
  hasNofollow: boolean;
  hasNoarchive: boolean;
  hasNosnippet: boolean;
  hasNone: boolean;
  hasAll: boolean;
  unavailableAfter?: string;
  maxSnippet?: number;
  maxImagePreview?: string;
  maxVideoPreview?: number;
}

export interface Conflict {
  type: "warning" | "error";
  message: string;
  recommendation: string;
}

export interface TestResult {
  parsed: ParsedDirectives;
  conflicts: Conflict[];
  recommendations: string[];
  valid: boolean;
  fixedTag: string;
  rawInput: string;
  source: "meta" | "header" | "string";
}

export const DIRECTIVE_REFERENCE: { name: Directive; description: string }[] = [
  { name: "index", description: "Allow the page to be indexed (default)." },
  { name: "noindex", description: "Do not index this page in search results." },
  { name: "follow", description: "Follow links on this page (default)." },
  { name: "nofollow", description: "Do not follow links on this page." },
  { name: "noarchive", description: "Do not show a cached copy in search results." },
  { name: "nosnippet", description: "Do not show a snippet/meta description in search results." },
  { name: "notranslate", description: "Do not offer translation of this page in search results." },
  { name: "noimageindex", description: "Do not index images on this page." },
  { name: "unavailable_after", description: "Stop indexing after a specific date/time. Format: unavailable_after: 25 Jun 2025 00:00:00 PST" },
  { name: "max-snippet", description: "Max characters of snippet to show. Format: max-snippet: 50" },
  { name: "max-image-preview", description: "Max image preview size: none, standard, large." },
  { name: "max-video-preview", description: "Max seconds of video preview. Format: max-video-preview: 30" },
  { name: "all", description: "Equivalent to index, follow (default)." },
  { name: "none", description: "Equivalent to noindex, nofollow." },
];

const TOKEN_RE = /^([a-zA-Z][a-zA-Z_-]*)(?::\s*(.+))?$/;

/** Extract the content attribute value from <meta name="robots" content="...">. */
export function extractMetaRobots(html: string): { content: string | null; tag: string | null } {
  if (!html) return { content: null, tag: null };
  // Match <meta name="robots" content="..."> or <meta name='robots' content='...'>
  const re = /<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*>/gi;
  const match = re.exec(html);
  if (!match) return { content: null, tag: null };
  const tag = match[0];
  const contentMatch = /content\s*=\s*["']([^"']*)["']/i.exec(tag);
  if (!contentMatch) return { content: null, tag };
  return { content: contentMatch[1], tag };
}

/** Parse a meta robots content string into directives. */
export function parseDirectives(content: string): ParsedDirectives {
  const directives: Record<string, string | boolean> = {};
  if (!content || !content.trim()) {
    return {
      directives,
      hasIndex: false,
      hasNoindex: false,
      hasFollow: false,
      hasNofollow: false,
      hasNoarchive: false,
      hasNosnippet: false,
      hasNone: false,
      hasAll: false,
    };
  }
  const tokens = content.split(",").map((t) => t.trim()).filter(Boolean);
  let unavailableAfter: string | undefined;
  let maxSnippet: number | undefined;
  let maxImagePreview: string | undefined;
  let maxVideoPreview: number | undefined;
  for (const tok of tokens) {
    const m = TOKEN_RE.exec(tok);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2]?.trim();
    directives[key] = val !== undefined ? val : true;
    if (key === "index") directives.index = true;
    if (key === "noindex") directives.noindex = true;
    if (key === "follow") directives.follow = true;
    if (key === "nofollow") directives.nofollow = true;
    if (key === "noarchive") directives.noarchive = true;
    if (key === "nosnippet") directives.nosnippet = true;
    if (key === "all") directives.all = true;
    if (key === "none") directives.none = true;
    if (key === "unavailable_after" && val) unavailableAfter = val;
    if (key === "max-snippet" && val) {
      const n = parseInt(val, 10);
      if (Number.isFinite(n)) maxSnippet = n;
    }
    if (key === "max-image-preview" && val) maxImagePreview = val;
    if (key === "max-video-preview" && val) {
      const n = parseInt(val, 10);
      if (Number.isFinite(n)) maxVideoPreview = n;
    }
  }
  return {
    directives,
    hasIndex: !!directives.index,
    hasNoindex: !!directives.noindex,
    hasFollow: !!directives.follow,
    hasNofollow: !!directives.nofollow,
    hasNoarchive: !!directives.noarchive,
    hasNosnippet: !!directives.nosnippet,
    hasNone: !!directives.none,
    hasAll: !!directives.all,
    unavailableAfter,
    maxSnippet,
    maxImagePreview,
    maxVideoPreview,
  };
}

/** Detect conflicts in directives. */
export function detectConflicts(parsed: ParsedDirectives): Conflict[] {
  const out: Conflict[] = [];
  // index + noindex
  if (parsed.hasIndex && parsed.hasNoindex) {
    out.push({
      type: "error",
      message: "Conflicting directives: index and noindex are mutually exclusive.",
      recommendation: "Remove noindex if you want the page indexed, otherwise remove index.",
    });
  }
  // follow + nofollow
  if (parsed.hasFollow && parsed.hasNofollow) {
    out.push({
      type: "error",
      message: "Conflicting directives: follow and nofollow are mutually exclusive.",
      recommendation: "Remove nofollow if you want links followed, otherwise remove follow.",
    });
  }
  // all + none
  if (parsed.hasAll && parsed.hasNone) {
    out.push({
      type: "error",
      message: "Conflicting directives: all and none are opposites.",
      recommendation: "Remove one — all = (index, follow), none = (noindex, nofollow).",
    });
  }
  // all + any other restrictive directive
  if (parsed.hasAll && (parsed.hasNoindex || parsed.hasNofollow || parsed.hasNoarchive || parsed.hasNosnippet)) {
    out.push({
      type: "warning",
      message: "all is redundant when combined with restrictive directives.",
      recommendation: "Remove 'all' — it's the default and conflicts with the restrictive directives.",
    });
  }
  // none + any permissive directive
  if (parsed.hasNone && (parsed.hasIndex || parsed.hasFollow)) {
    out.push({
      type: "error",
      message: "Conflicting directives: none means (noindex, nofollow) — cannot combine with index or follow.",
      recommendation: "Remove 'none' or remove the permissive directives.",
    });
  }
  // noarchive without noindex is fine (just no cache), but flag if combined with unavailable_after without date
  if (parsed.unavailableAfter !== undefined && !parsed.unavailableAfter.trim()) {
    out.push({
      type: "error",
      message: "unavailable_after directive requires a date value.",
      recommendation: "Provide a date in the format: unavailable_after: 25 Jun 2025 00:00:00 PST",
    });
  }
  // max-snippet negative
  if (parsed.maxSnippet !== undefined && parsed.maxSnippet < 0) {
    out.push({
      type: "warning",
      message: `max-snippet is negative (${parsed.maxSnippet}). -1 means no limit; 0 means no snippet.`,
      recommendation: "Use -1 for unlimited, 0 for no snippet, or a positive number to cap characters.",
    });
  }
  // max-image-preview invalid value
  if (parsed.maxImagePreview !== undefined && !["none", "standard", "large"].includes(parsed.maxImagePreview)) {
    out.push({
      type: "error",
      message: `max-image-preview value '${parsed.maxImagePreview}' is invalid.`,
      recommendation: "Use one of: none, standard, large.",
    });
  }
  return out;
}

/** Generate recommendations based on directives. */
export function generateRecommendations(parsed: ParsedDirectives): string[] {
  const out: string[] = [];
  if (parsed.hasNone) {
    out.push("Directive 'none' is equivalent to 'noindex, nofollow'. Use the explicit form for clarity.");
  }
  if (parsed.hasAll) {
    out.push("Directive 'all' is the default behavior and is redundant. You can safely remove it.");
  }
  if (parsed.hasNoindex && !parsed.hasNofollow) {
    out.push("noindex without nofollow: links on this page are still crawled (link equity passes). Usually intentional — keep if so.");
  }
  if (parsed.hasNofollow && !parsed.hasNoindex) {
    out.push("nofollow without noindex: page is indexed but links are not followed. Common for sponsored/UGC content.");
  }
  if (parsed.hasNoarchive) {
    out.push("noarchive prevents Google from showing a cached copy in results. Useful for frequently-updated content.");
  }
  if (parsed.hasNosnippet) {
    out.push("nosnippet suppresses snippets in search results. This can reduce CTR — verify it's intentional.");
  }
  if (parsed.hasNoindex && parsed.hasNoarchive) {
    out.push("noindex + noarchive: very restrictive. Consider if both are needed; usually noindex alone is sufficient.");
  }
  if (!parsed.hasIndex && !parsed.hasNoindex && !parsed.hasAll && !parsed.hasNone) {
    out.push("No index/noindex directive: defaults to 'index' (page can be indexed). This is the expected state for most pages.");
  }
  if (parsed.unavailableAfter) {
    out.push(`unavailable_after set to '${parsed.unavailableAfter}'. Google will stop indexing after this date. Make sure the date is valid and in the future.`);
  }
  return out;
}

/** Generate a fixed meta robots tag. */
export function generateFixedTag(parsed: ParsedDirectives): string {
  const parts: string[] = [];
  // Resolve conflicts: if both, prefer the restrictive (noindex over index)
  if (parsed.hasNoindex || parsed.hasNone) parts.push("noindex");
  else if (parsed.hasIndex || parsed.hasAll) parts.push("index");
  if (parsed.hasNofollow || parsed.hasNone) parts.push("nofollow");
  else if (parsed.hasFollow || parsed.hasAll) parts.push("follow");
  if (parsed.hasNoarchive) parts.push("noarchive");
  if (parsed.hasNosnippet) parts.push("nosnippet");
  if (parsed.directives.notranslate) parts.push("notranslate");
  if (parsed.directives.noimageindex) parts.push("noimageindex");
  if (parsed.unavailableAfter) parts.push(`unavailable_after: ${parsed.unavailableAfter}`);
  if (parsed.maxSnippet !== undefined) parts.push(`max-snippet: ${parsed.maxSnippet}`);
  if (parsed.maxImagePreview) parts.push(`max-image-preview: ${parsed.maxImagePreview}`);
  if (parsed.maxVideoPreview !== undefined) parts.push(`max-video-preview: ${parsed.maxVideoPreview}`);
  const content = parts.length > 0 ? parts.join(", ") : "index, follow";
  return `<meta name="robots" content="${content}">`;
}

/** Test the input (auto-detect meta tag, X-Robots-Tag header, or raw string). */
export function testInput(input: string): TestResult {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return {
      parsed: parseDirectives(""),
      conflicts: [],
      recommendations: [],
      valid: false,
      fixedTag: "",
      rawInput: input,
      source: "string",
    };
  }
  let source: "meta" | "header" | "string" = "string";
  let contentStr = trimmed;

  // Detect HTML meta tag
  if (/<meta\s+/i.test(trimmed) && /name\s*=\s*["']robots["']/i.test(trimmed)) {
    source = "meta";
    const { content } = extractMetaRobots(trimmed);
    contentStr = content ?? "";
  } else if (/^x-robots-tag\s*:/i.test(trimmed) || /^robots\s*:/i.test(trimmed)) {
    // X-Robots-Tag header: "X-Robots-Tag: noindex, nofollow"
    source = "header";
    const idx = trimmed.indexOf(":");
    contentStr = idx >= 0 ? trimmed.slice(idx + 1).trim() : trimmed;
  }

  const parsed = parseDirectives(contentStr);
  const conflicts = detectConflicts(parsed);
  const recommendations = generateRecommendations(parsed);
  const fixedTag = generateFixedTag(parsed);
  const valid = conflicts.filter((c) => c.type === "error").length === 0;

  return {
    parsed,
    conflicts,
    recommendations,
    valid,
    fixedTag,
    rawInput: input,
    source,
  };
}

/** Render a plain-text report. */
export function renderReport(result: TestResult): string {
  const lines: string[] = [];
  lines.push("Meta Robots Test Report");
  lines.push("=======================");
  lines.push(`Source: ${result.source}`);
  lines.push(`Valid: ${result.valid ? "yes" : "no"}`);
  lines.push("");
  lines.push("Parsed directives:");
  for (const [k, v] of Object.entries(result.parsed.directives)) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push("");
  if (result.conflicts.length > 0) {
    lines.push("Conflicts:");
    for (const c of result.conflicts) {
      lines.push(`  [${c.type}] ${c.message}`);
      lines.push(`    → ${c.recommendation}`);
    }
  }
  if (result.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of result.recommendations) {
      lines.push(`  - ${r}`);
    }
  }
  lines.push("");
  lines.push("Fixed tag:");
  lines.push(`  ${result.fixedTag}`);
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:meta-robots-tester:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  source: string;
  valid: boolean;
  conflictCount: number;
  fixedTag: string;
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

export function buildShareUrl(payload: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "" };
}
