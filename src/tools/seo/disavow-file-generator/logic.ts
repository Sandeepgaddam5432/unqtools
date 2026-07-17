/**
 * Disavow File Generator — pure logic.
 *
 * Generate Google Disavow files from URL lists. Supports domain-level and
 * URL-level entries, comments (#), dedup, sort, stats, validation.
 *
 * Google Disavow format spec:
 *   - One URL or domain per line.
 *   - Domain-level: `domain:example.com` (disavows all links from that domain).
 *   - URL-level: `https://example.com/path/page` (disavows links from that URL only).
 *   - Comments start with `#`.
 *   - Empty lines are ignored.
 *
 * Docs: https://support.google.com/webmasters/answer/2648487
 *
 * Pure functions only — no DOM, no network.
 */

export type DisavowMode = "url" | "domain";

export interface ParsedUrl {
  raw: string;
  valid: boolean;
  url?: string;
  domain?: string;
  protocol?: string;
  error?: string;
}

export interface DisavowEntry {
  mode: DisavowMode;
  value: string; // URL for "url", domain for "domain"
  raw: string;   // original input
}

export interface DisavowStats {
  totalLines: number;
  validEntries: number;
  invalidEntries: number;
  duplicatesRemoved: number;
  uniqueUrls: number;
  uniqueDomains: number;
  commentCount: number;
  mode: DisavowMode;
}

export interface DisavowResult {
  entries: DisavowEntry[];
  comments: string[];
  stats: DisavowStats;
  output: string;
  errors: string[];
}

/** Validate a URL — accepts http/https. */
export function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Extract domain (hostname without www) from a URL or bare domain. */
export function extractDomain(input: string): string | null {
  if (!input || !input.trim()) return null;
  const trimmed = input.trim();
  // If it's already a bare domain (no protocol), try parsing directly
  if (!/^https?:\/\//i.test(trimmed)) {
    // Bare domain — accept if it looks like a domain
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
      return stripWww(trimmed.toLowerCase());
    }
    return null;
  }
  try {
    const u = new URL(trimmed);
    return stripWww(u.hostname.toLowerCase());
  } catch {
    return null;
  }
}

function stripWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

/** Parse a single URL input into a ParsedUrl. */
export function parseUrlInput(input: string): ParsedUrl {
  const raw = input.trim();
  if (!raw) {
    return { raw, valid: false, error: "Empty input" };
  }
  if (!isValidUrl(raw)) {
    // Try as a bare domain
    const domain = extractDomain(raw);
    if (domain) {
      return {
        raw,
        valid: true,
        domain,
        url: `http://${domain}/`,
        protocol: "http",
      };
    }
    return { raw, valid: false, error: "Not a valid URL or domain" };
  }
  try {
    const u = new URL(raw);
    return {
      raw,
      valid: true,
      url: u.toString(),
      domain: stripWww(u.hostname.toLowerCase()),
      protocol: u.protocol.replace(":", ""),
    };
  } catch {
    return { raw, valid: false, error: "URL parse error" };
  }
}

/** Parse bulk pasted URL list (one per line, ignoring comments). */
export function parseBulkUrls(text: string): { urls: string[]; comments: string[] } {
  if (!text) return { urls: [], comments: [] };
  const urls: string[] = [];
  const comments: string[] = [];
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      comments.push(trimmed.slice(1).trim());
      continue;
    }
    urls.push(trimmed);
  }
  return { urls, comments };
}

/** Dedup URLs/domains — case-insensitive, returns unique entries preserving order. */
export function dedupEntries(entries: DisavowEntry[]): { entries: DisavowEntry[]; removed: number } {
  const seen = new Set<string>();
  const out: DisavowEntry[] = [];
  let removed = 0;
  for (const e of entries) {
    const key = `${e.mode}:${e.value.toLowerCase()}`;
    if (seen.has(key)) {
      removed++;
      continue;
    }
    seen.add(key);
    out.push(e);
  }
  return { entries: out, removed };
}

/** Sort entries alphabetically by value. */
export function sortEntries(entries: DisavowEntry[]): DisavowEntry[] {
  return entries.slice().sort((a, b) => {
    if (a.mode !== b.mode) {
      return a.mode === "domain" ? -1 : 1; // domains first
    }
    return a.value.toLowerCase().localeCompare(b.value.toLowerCase());
  });
}

/** Format a single entry to disavow line. */
export function formatEntry(entry: DisavowEntry): string {
  if (entry.mode === "domain") {
    return `domain:${entry.value}`;
  }
  return entry.value;
}

/** Validate a disavow entry value. */
export function validateEntry(entry: DisavowEntry): { valid: boolean; error?: string } {
  if (entry.mode === "domain") {
    if (!entry.value || !entry.value.trim()) {
      return { valid: false, error: "Empty domain" };
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(entry.value)) {
      return { valid: false, error: `Invalid domain: ${entry.value}` };
    }
    return { valid: true };
  }
  if (!isValidUrl(entry.value)) {
    return { valid: false, error: `Invalid URL: ${entry.value}` };
  }
  return { valid: true };
}

export interface GenerateOptions {
  mode: DisavowMode;
  dedup?: boolean;
  sort?: boolean;
  comment?: string;
}

/** Generate a disavow file from a URL list. */
export function generateDisavowFile(
  text: string,
  options: GenerateOptions,
): DisavowResult {
  const { mode, dedup = true, sort = false, comment } = options;
  const errors: string[] = [];
  const { urls, comments: parsedComments } = parseBulkUrls(text);

  const entries: DisavowEntry[] = [];
  let invalidCount = 0;

  for (const raw of urls) {
    const parsed = parseUrlInput(raw);
    if (!parsed.valid || (!parsed.url && !parsed.domain)) {
      invalidCount++;
      errors.push(`Invalid URL: ${raw}`);
      continue;
    }
    if (mode === "domain") {
      if (!parsed.domain) {
        invalidCount++;
        errors.push(`Could not extract domain: ${raw}`);
        continue;
      }
      entries.push({ mode: "domain", value: parsed.domain, raw });
    } else {
      if (!parsed.url) {
        invalidCount++;
        errors.push(`Could not extract URL: ${raw}`);
        continue;
      }
      entries.push({ mode: "url", value: parsed.url, raw });
    }
  }

  let duplicatesRemoved = 0;
  let finalEntries = entries;
  if (dedup) {
    const dedupResult = dedupEntries(finalEntries);
    finalEntries = dedupResult.entries;
    duplicatesRemoved = dedupResult.removed;
  }
  if (sort) {
    finalEntries = sortEntries(finalEntries);
  }

  const allComments = [...parsedComments];
  if (comment && comment.trim()) {
    allComments.unshift(comment.trim());
  }

  const lines: string[] = [];
  // Header comment
  lines.push("# Disavow file generated by UnQTools Disavow File Generator");
  lines.push(`# Mode: ${mode === "domain" ? "Domain-level" : "URL-level"}`);
  lines.push(`# Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");
  for (const c of allComments) {
    lines.push(`# ${c}`);
  }
  if (allComments.length > 0) lines.push("");
  for (const e of finalEntries) {
    lines.push(formatEntry(e));
  }

  const uniqueUrls = new Set(
    finalEntries.filter((e) => e.mode === "url").map((e) => e.value.toLowerCase()),
  ).size;
  const uniqueDomains = new Set(
    finalEntries.filter((e) => e.mode === "domain").map((e) => e.value.toLowerCase()),
  ).size;

  const stats: DisavowStats = {
    totalLines: urls.length + parsedComments.length,
    validEntries: finalEntries.length,
    invalidEntries: invalidCount,
    duplicatesRemoved,
    uniqueUrls,
    uniqueDomains,
    commentCount: allComments.length,
    mode,
  };

  return {
    entries: finalEntries,
    comments: allComments,
    stats,
    output: lines.join("\n"),
    errors,
  };
}

/** Parse an existing disavow file back into entries. */
export function parseDisavowFile(text: string): {
  entries: DisavowEntry[];
  comments: string[];
  errors: string[];
} {
  const entries: DisavowEntry[] = [];
  const comments: string[] = [];
  const errors: string[] = [];
  if (!text) return { entries, comments, errors };
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      comments.push(trimmed.slice(1).trim());
      continue;
    }
    if (trimmed.startsWith("domain:")) {
      const domain = trimmed.slice("domain:".length).trim();
      if (domain) {
        entries.push({ mode: "domain", value: domain, raw: trimmed });
      }
      continue;
    }
    if (isValidUrl(trimmed)) {
      entries.push({ mode: "url", value: trimmed, raw: trimmed });
    } else {
      errors.push(`Unrecognized line: ${trimmed}`);
    }
  }
  return { entries, comments, errors };
}

/** Google Disavow documentation URL. */
export const GOOGLE_DISAVOW_DOCS_URL =
  "https://support.google.com/webmasters/answer/2648487";

// ---- History ----

const HISTORY_KEY = "unqtools:disavow-file-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mode: DisavowMode;
  entryCount: number;
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

// ---- Shareable URL ----

export interface ShareState {
  text: string;
  mode: DisavowMode;
  dedup: boolean;
  sort: boolean;
  comment: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("text", state.text);
  params.set("mode", state.mode);
  params.set("dedup", state.dedup ? "1" : "0");
  params.set("sort", state.sort ? "1" : "0");
  if (state.comment) params.set("comment", state.comment);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const text = params.get("text");
  if (text !== null) out.text = text;
  const mode = params.get("mode");
  if (mode === "url" || mode === "domain") out.mode = mode;
  const dedup = params.get("dedup");
  if (dedup !== null) out.dedup = dedup === "1";
  const sort = params.get("sort");
  if (sort !== null) out.sort = sort === "1";
  const comment = params.get("comment");
  if (comment !== null) out.comment = comment;
  return out;
}
