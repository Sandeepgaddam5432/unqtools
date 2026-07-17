/**
 * SEO Slug Generator — pure logic.
 *
 * All functions are deterministic and side-effect free. No DOM, no network.
 */

export type Separator = "-" | "_";

export interface SlugOptions {
  separator?: Separator;
  maxLength?: number;
  removeStopWords?: boolean;
  lower?: boolean;
  stripDiacritics?: boolean;
}

export interface SlugStats {
  length: number;
  wordCount: number;
  alphaCount: number;
  digitCount: number;
  sepCount: number;
  isLowercase: boolean;
  hasInvalidChars: boolean;
}

/** Common English stop words kept short to avoid noisy slugs. */
export const STOP_WORDS = new Set<string>([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "for", "on", "with",
  "as", "by", "at", "from", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "it", "we", "you", "they", "i", "he", "she", "my", "your",
  "our", "their", "its", "what", "which", "who", "whom", "where", "when", "why",
  "how", "all", "any", "more", "most", "other", "some", "such", "no", "not",
  "only", "own", "same", "so", "than", "too", "very", "just", "also",
]);

/** Map accented characters to ASCII equivalents. */
export function stripDiacritics(input: string): string {
  if (!input) return "";
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

/** Tokenize into words (lowercased, alphanumerics only). */
export function tokenize(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[^a-zA-Z0-9]+/)
    .map((w) => w.trim())
    .filter(Boolean);
}

/** Remove stop words from a token list. */
export function filterStopWords(words: string[]): string[] {
  return words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
}

/** Generate a slug from a single title. */
export function generateSlug(input: string, options: SlugOptions = {}): string {
  if (!input) return "";
  const {
    separator = "-",
    maxLength = 75,
    removeStopWords = true,
    lower = true,
    stripDiacritics: strip = true,
  } = options;

  let text = strip ? stripDiacritics(input) : input;
  if (lower) text = text.toLowerCase();
  let words = tokenize(text);
  if (removeStopWords) words = filterStopWords(words);
  if (words.length === 0) return "";

  // Join with separator
  let slug = words.join(separator);

  // Trim to max length without cutting a word in half
  if (maxLength > 0 && slug.length > maxLength) {
    const slice = slug.slice(0, maxLength);
    const lastSep = slice.lastIndexOf(separator);
    slug = lastSep > 0 ? slice.slice(0, lastSep) : slice;
  }

  // Trim trailing separators
  slug = slug.replace(new RegExp(`[${separator}]+$`), "");
  slug = slug.replace(new RegExp(`^[${separator}]+`), "");

  return slug;
}

/** Validate that a slug is URL-safe: lowercase, a-z 0-9, single separators only. */
export function validateSlug(slug: string): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  if (!slug) {
    issues.push("Slug is empty");
    return { ok: false, issues };
  }
  if (/[A-Z]/.test(slug)) issues.push("Contains uppercase letters");
  if (/[^\w-]/.test(slug)) issues.push("Contains special characters");
  if (/\s/.test(slug)) issues.push("Contains whitespace");
  if (/--|__|_-|-_/.test(slug)) issues.push("Contains consecutive or mixed separators");
  if (/^-|-$/.test(slug)) issues.push("Starts or ends with a separator");
  if (slug.length > 75) issues.push("Longer than 75 chars");
  return { ok: issues.length === 0, issues };
}

/** Compute statistics about a slug. */
export function computeStats(slug: string): SlugStats {
  return {
    length: slug.length,
    wordCount: slug ? slug.split(/[-_]/).filter(Boolean).length : 0,
    alphaCount: (slug.match(/[a-z]/g) || []).length,
    digitCount: (slug.match(/[0-9]/g) || []).length,
    sepCount: (slug.match(/[-_]/g) || []).length,
    isLowercase: !/[A-Z]/.test(slug),
    hasInvalidChars: /[^\w-]/.test(slug),
  };
}

/** Build a live URL preview by combining a domain with the slug. */
export function buildUrlPreview(slug: string, domain: string, trailingSlash: boolean): string {
  if (!slug) return "";
  const d = (domain || "https://example.com").trim();
  const base = d.replace(/\/+$/, "");
  return `${base}/${slug}${trailingSlash ? "/" : ""}`;
}

/** Batch generate slugs from one-per-line input. */
export function generateBatch(
  input: string,
  options: SlugOptions = {},
): Array<{ title: string; slug: string }> {
  if (!input) return [];
  return input
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((title) => ({ title, slug: generateSlug(title, options) }));
}

/** Render batch as a CSV (title,slug). */
export function renderBatchCsv(
  rows: Array<{ title: string; slug: string }>,
): string {
  const lines = ["title,slug"];
  for (const r of rows) {
    lines.push(`${escapeCsv(r.title)},${escapeCsv(r.slug)}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:seo-slug-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  slug: string;
  separator: Separator;
  maxLength: number;
  removeStopWords: boolean;
}

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
      // ignore quota
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

export function buildShareUrl(input: {
  title: string;
  domain: string;
  options: SlugOptions;
  trailingSlash?: boolean;
}): string {
  const params = new URLSearchParams();
  params.set("title", input.title);
  params.set("domain", input.domain);
  if (input.options.separator) params.set("separator", input.options.separator);
  if (input.options.maxLength !== undefined) params.set("maxLength", String(input.options.maxLength));
  if (input.options.removeStopWords) params.set("removeStopWords", "1");
  if (input.options.lower === false) params.set("lower", "0");
  if (input.options.stripDiacritics === false) params.set("stripDiacritics", "0");
  if (input.trailingSlash) params.set("trailingSlash", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  title: string;
  domain: string;
  options: SlugOptions;
  trailingSlash: boolean;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const out = {
    title: "",
    domain: "",
    options: {} as SlugOptions,
    trailingSlash: false,
  };
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  out.title = params.get("title") ?? "";
  out.domain = params.get("domain") ?? "";
  const sep = params.get("separator");
  if (sep === "-" || sep === "_") out.options.separator = sep;
  const ml = params.get("maxLength");
  if (ml !== null) {
    const n = parseInt(ml, 10);
    if (!Number.isNaN(n)) out.options.maxLength = n;
  }
  out.options.removeStopWords = params.get("removeStopWords") === "1";
  out.options.lower = params.get("lower") !== "0";
  out.options.stripDiacritics = params.get("stripDiacritics") !== "0";
  out.trailingSlash = params.get("trailingSlash") === "1";
  return out;
}
