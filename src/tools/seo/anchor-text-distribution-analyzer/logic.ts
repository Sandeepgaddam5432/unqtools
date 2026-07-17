/**
 * Anchor Text Distribution Analyzer — pure logic.
 *
 * Categorize backlink anchor text into: exact match, partial match, branded,
 * generic, naked URL, image. Compute distribution %, flag over-optimization
 * (>50% exact match), provide top-N lists.
 *
 * Pure functions only — no DOM, no network.
 */

export type AnchorCategory =
  | "exact-match"
  | "partial-match"
  | "branded"
  | "generic"
  | "naked-url"
  | "image";

export interface Backlink {
  url: string;
  anchor: string;
}

export interface CategorizedBacklink extends Backlink {
  category: AnchorCategory;
}

export interface CategoryStat {
  category: AnchorCategory;
  count: number;
  percentage: number;
}

export interface AnalysisResult {
  total: number;
  perCategory: Record<AnchorCategory, CategoryStat>;
  categorized: CategorizedBacklink[];
  warnings: string[];
  topAnchors: Array<{ anchor: string; count: number }>;
  brandTerm: string;
}

/** Common generic anchor phrases (no keyword value). */
export const GENERIC_ANCHORS = new Set<string>([
  "click here", "here", "read more", "more", "learn more",
  "this article", "this post", "this page", "this link",
  "link", "source", "via", "image", "see more", "view more",
  "check this out", "check it out", "go here", "visit",
  "website", "site", "homepage", "home", "contact",
]);

/** Parse pasted backlink data: "URL | anchor" or "URL\tanchor" per line. */
export function parseBacklinks(text: string): Backlink[] {
  if (!text) return [];
  const out: Backlink[] = [];
  for (const line of text.split(/\n+/).map((l) => l.trim()).filter(Boolean)) {
    // Skip comments
    if (line.startsWith("#")) continue;
    // Split on | or tab
    const parts = line.split(/\||\t/).map((s) => s.trim());
    if (parts.length < 2) continue;
    const [url, anchor] = parts;
    if (!url || !anchor) continue;
    out.push({ url, anchor });
  }
  return out;
}

/** Check if a string looks like a URL (used for naked-URL detection). */
export function looksLikeUrl(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  // bare domain
  if (/^[a-z0-9.-]+\.[a-z]{2,}([/?#].*)?$/i.test(trimmed)) return true;
  return false;
}

/** Check if anchor text contains the brand term (case-insensitive). */
export function isBranded(anchor: string, brand: string): boolean {
  if (!anchor || !brand) return false;
  const a = anchor.toLowerCase();
  const b = brand.toLowerCase().trim();
  return a.includes(b);
}

/** Check if anchor text is the exact keyword (case-insensitive whole match). */
export function isExactMatch(anchor: string, keyword: string): boolean {
  if (!anchor || !keyword) return false;
  return anchor.toLowerCase().trim() === keyword.toLowerCase().trim();
}

/** Check if anchor contains the keyword (partial match). */
export function isPartialMatch(anchor: string, keyword: string): boolean {
  if (!anchor || !keyword) return false;
  return anchor.toLowerCase().includes(keyword.toLowerCase().trim());
}

/** Check if anchor is image-based (starts with image indicator). */
export function isImageAnchor(anchor: string): boolean {
  if (!anchor) return false;
  const a = anchor.trim().toLowerCase();
  return a.startsWith("image:") || a === "(image)" || a === "[image]" || a === "<image>";
}

/** Check if anchor is a generic phrase. */
export function isGenericAnchor(anchor: string): boolean {
  if (!anchor) return false;
  return GENERIC_ANCHORS.has(anchor.toLowerCase().trim());
}

/** Categorize a single backlink. */
export function categorizeBacklink(
  backlink: Backlink,
  options: { keyword?: string; brand?: string },
): AnchorCategory {
  const { keyword = "", brand = "" } = options;
  const anchor = backlink.anchor;
  // Image first (most specific)
  if (isImageAnchor(anchor)) return "image";
  // Naked URL
  if (looksLikeUrl(anchor)) return "naked-url";
  // Exact match (whole anchor == keyword)
  if (keyword && isExactMatch(anchor, keyword)) return "exact-match";
  // Partial match (anchor contains keyword, but not exact)
  if (keyword && isPartialMatch(anchor, keyword)) return "partial-match";
  // Branded (anchor contains brand term)
  if (brand && isBranded(anchor, brand)) return "branded";
  // Generic
  if (isGenericAnchor(anchor)) return "generic";
  // Default to generic if nothing else matches
  return "generic";
}

/** Run the full analysis on a list of backlinks. */
export function analyze(
  backlinks: Backlink[],
  options: { keyword?: string; brand?: string; dedup?: boolean } = {},
): AnalysisResult {
  const { keyword = "", brand = "", dedup = true } = options;
  let workingBacklinks = backlinks;
  if (dedup) {
    const seen = new Set<string>();
    workingBacklinks = [];
    for (const b of backlinks) {
      const key = `${b.url.toLowerCase()}|${b.anchor.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      workingBacklinks.push(b);
    }
  }
  const total = workingBacklinks.length;
  const categorized: CategorizedBacklink[] = workingBacklinks.map((b) => ({
    ...b,
    category: categorizeBacklink(b, { keyword, brand }),
  }));

  const categories: AnchorCategory[] = [
    "exact-match", "partial-match", "branded", "generic", "naked-url", "image",
  ];
  const perCategory = {} as Record<AnchorCategory, CategoryStat>;
  for (const c of categories) {
    const count = categorized.filter((b) => b.category === c).length;
    perCategory[c] = {
      category: c,
      count,
      percentage: total === 0 ? 0 : (count / total) * 100,
    };
  }

  const warnings: string[] = [];
  if (total > 0) {
    const exactPct = perCategory["exact-match"].percentage;
    if (exactPct > 50) {
      warnings.push(
        `Over-optimization risk: ${exactPct.toFixed(1)}% of anchors are exact-match (over 50% threshold). Google may flag this as unnatural.`,
      );
    } else if (exactPct > 30) {
      warnings.push(
        `High exact-match anchor ratio (${exactPct.toFixed(1)}%). Consider diversifying — aim for <30% exact-match.`,
      );
    }
    const genericPct = perCategory["generic"].percentage;
    if (genericPct > 30) {
      warnings.push(
        `High generic anchor ratio (${genericPct.toFixed(1)}%). Generic anchors like "click here" don't pass keyword relevance.`,
      );
    }
    const brandedPct = perCategory["branded"].percentage;
    if (brandedPct < 10 && brand) {
      warnings.push(
        `Low branded anchor ratio (${brandedPct.toFixed(1)}%). Healthy backlink profiles typically have 30-50%+ branded anchors.`,
      );
    }
  }

  // Top anchors by frequency
  const freq = new Map<string, number>();
  for (const b of categorized) {
    const key = b.anchor.toLowerCase().trim();
    freq.set(key, (freq.get(key) || 0) + 1);
  }
  const topAnchors = Array.from(freq.entries())
    .map(([anchor, count]) => ({ anchor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    total,
    perCategory,
    categorized,
    warnings,
    topAnchors,
    brandTerm: brand,
  };
}

/** Render analysis as CSV. */
export function renderCsv(result: AnalysisResult): string {
  const lines: string[] = ["url,anchor,category"];
  for (const b of result.categorized) {
    lines.push(`${escapeCsv(b.url)},${escapeCsv(b.anchor)},${b.category}`);
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build chart data for distribution visualization. */
export function buildChartData(result: AnalysisResult): Array<{ category: AnchorCategory; percentage: number; color: string }> {
  const colors: Record<AnchorCategory, string> = {
    "exact-match": "#ef4444",
    "partial-match": "#f59e0b",
    "branded": "#10b981",
    "generic": "#6b7280",
    "naked-url": "#3b82f6",
    "image": "#8b5cf6",
  };
  return (Object.keys(result.perCategory) as AnchorCategory[]).map((category) => ({
    category,
    percentage: result.perCategory[category].percentage,
    color: colors[category],
  }));
}

/** Healthy profile reference (rough industry benchmarks). */
export const HEALTHY_PROFILE: Record<AnchorCategory, { min: number; max: number; note: string }> = {
  "branded": { min: 30, max: 60, note: "Most natural profiles are brand-heavy" },
  "generic": { min: 5, max: 20, note: "Some generic anchors are normal" },
  "naked-url": { min: 5, max: 20, note: "URL-as-anchor is common" },
  "partial-match": { min: 5, max: 20, note: "Keyword variations are fine in moderation" },
  "exact-match": { min: 0, max: 10, note: "Keep under 10% to avoid over-optimization" },
  "image": { min: 0, max: 20, note: "Image links are common" },
};

// ---- History ----

const HISTORY_KEY = "unqtools:anchor-text-distribution-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  total: number;
  exactPct: number;
  brandedPct: number;
  warningCount: number;
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
  keyword: string;
  brand: string;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("text", state.text);
  params.set("keyword", state.keyword);
  params.set("brand", state.brand);
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
  const keyword = params.get("keyword");
  if (keyword !== null) out.keyword = keyword;
  const brand = params.get("brand");
  if (brand !== null) out.brand = brand;
  return out;
}
