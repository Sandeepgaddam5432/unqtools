/**
 * Meta Tag Generator — pure logic.
 *
 * All functions are deterministic and side-effect free. No DOM, no network.
 */

export type RobotsDirective =
  | "index, follow"
  | "noindex, follow"
  | "index, nofollow"
  | "noindex, nofollow";

export interface MetaTagInput {
  title: string;
  description: string;
  keywords?: string;
  author?: string;
  robots?: RobotsDirective;
  viewport?: string;
  charset?: string;
  canonical?: string;
  themeColor?: string;
  appleWebApp?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  ogSiteName?: string;
  twitterCard?: "summary" | "summary_large_image";
  twitterSite?: string;
  twitterCreator?: string;
}

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;
/** Approximate average character width for Arial 18-20px. */
const PIXEL_PER_CHAR = 10;

export interface CharacterCount {
  value: number;
  max: number;
  remaining: number;
  isOver: boolean;
  isWarn: boolean;
}

/** HTML-escape a string for safe attribute / text content. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function countCharacters(value: string, max: number): CharacterCount {
  const v = value ?? "";
  const remaining = max - v.length;
  return {
    value: v.length,
    max,
    remaining,
    isOver: v.length > max,
    isWarn: v.length > max * 0.9 && v.length <= max,
  };
}

/** Estimate pixel width of a string at typical SERP / browser title size. */
export function estimatePixelWidth(value: string, charsPerPx = PIXEL_PER_CHAR): number {
  if (!value) return 0;
  let width = 0;
  for (const ch of value) {
    // Wide chars (CJK, emoji) roughly double width
    if (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7A3\u{1F000}-\u{1FAFF}]/u.test(ch)) {
      width += charsPerPx * 2;
    } else if (ch === "i" || ch === "l" || ch === "1" || ch === "|" || ch === ".") {
      width += charsPerPx * 0.5;
    } else if (ch === "W" || ch === "M" || ch === "O" || ch === "0") {
      width += charsPerPx * 1.4;
    } else {
      width += charsPerPx;
    }
  }
  return Math.round(width);
}

export function truncateForPixelLimit(value: string, maxPx: number): string {
  let width = 0;
  let out = "";
  for (const ch of value) {
    const w = estimatePixelWidth(ch);
    if (width + w > maxPx - 12) {
      // reserve space for ellipsis
      return out + "…";
    }
    out += ch;
    width += w;
  }
  return out;
}

/** Validate a URL — accepts http/https/protocol-relative. */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    // Allow protocol-relative
    if (url.startsWith("//") && url.length > 5) return true;
    return false;
  }
}

/** Build the title tag — empty title yields no tag. */
export function buildTitleTag(title: string): string {
  if (!title || !title.trim()) return "";
  return `<title>${escapeHtml(title)}</title>`;
}

export function buildDescriptionTag(description: string): string {
  if (!description || !description.trim()) return "";
  return `<meta name="description" content="${escapeHtml(description)}" />`;
}

export function buildKeywordsTag(keywords: string): string {
  if (!keywords || !keywords.trim()) return "";
  return `<meta name="keywords" content="${escapeHtml(keywords)}" />`;
}

export function buildAuthorTag(author: string): string {
  if (!author || !author.trim()) return "";
  return `<meta name="author" content="${escapeHtml(author)}" />`;
}

export function buildRobotsTag(robots?: RobotsDirective): string {
  if (!robots) return "";
  return `<meta name="robots" content="${robots}" />`;
}

export function buildViewportTag(viewport?: string): string {
  const v = viewport || "width=device-width, initial-scale=1";
  return `<meta name="viewport" content="${escapeHtml(v)}" />`;
}

export function buildCharsetTag(charset?: string): string {
  const c = charset || "UTF-8";
  return `<meta charset="${escapeHtml(c)}" />`;
}

export function buildCanonicalTag(canonical: string): string | null {
  if (!canonical || !canonical.trim()) return null;
  if (!isValidUrl(canonical.trim())) {
    return null;
  }
  return `<link rel="canonical" href="${escapeHtml(canonical.trim())}" />`;
}

export function buildThemeColorTag(themeColor: string): string {
  if (!themeColor || !themeColor.trim()) return "";
  return `<meta name="theme-color" content="${escapeHtml(themeColor)}" />`;
}

export function buildAppleWebAppTags(enabled: boolean): string {
  if (!enabled) return "";
  return [
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
  ].join("\n");
}

export function buildOpenGraphTags(input: MetaTagInput): string {
  const tags: string[] = [];
  if (input.ogTitle || input.title) {
    tags.push(`<meta property="og:title" content="${escapeHtml(input.ogTitle || input.title)}" />`);
  }
  if (input.ogDescription || input.description) {
    tags.push(
      `<meta property="og:description" content="${escapeHtml(input.ogDescription || input.description)}" />`,
    );
  }
  if (input.ogImage) {
    if (!isValidUrl(input.ogImage)) {
      throw new Error("Open Graph image URL is invalid");
    }
    tags.push(`<meta property="og:image" content="${escapeHtml(input.ogImage)}" />`);
  }
  if (input.ogUrl) {
    if (!isValidUrl(input.ogUrl)) {
      throw new Error("Open Graph URL is invalid");
    }
    tags.push(`<meta property="og:url" content="${escapeHtml(input.ogUrl)}" />`);
  }
  const type = input.ogType || "website";
  tags.push(`<meta property="og:type" content="${escapeHtml(type)}" />`);
  if (input.ogSiteName) {
    tags.push(`<meta property="og:site_name" content="${escapeHtml(input.ogSiteName)}" />`);
  }
  return tags.join("\n");
}

export function buildTwitterCardTags(input: MetaTagInput): string {
  const tags: string[] = [];
  const card = input.twitterCard || "summary";
  tags.push(`<meta name="twitter:card" content="${card}" />`);
  if (input.twitterSite) {
    const site = input.twitterSite.startsWith("@") ? input.twitterSite : `@${input.twitterSite}`;
    tags.push(`<meta name="twitter:site" content="${escapeHtml(site)}" />`);
  }
  if (input.twitterCreator) {
    const creator = input.twitterCreator.startsWith("@")
      ? input.twitterCreator
      : `@${input.twitterCreator}`;
    tags.push(`<meta name="twitter:creator" content="${escapeHtml(creator)}" />`);
  }
  const tTitle = input.ogTitle || input.title;
  if (tTitle) tags.push(`<meta name="twitter:title" content="${escapeHtml(tTitle)}" />`);
  const tDesc = input.ogDescription || input.description;
  if (tDesc) tags.push(`<meta name="twitter:description" content="${escapeHtml(tDesc)}" />`);
  if (input.ogImage) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(input.ogImage)}" />`);
  }
  return tags.join("\n");
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateInput(input: MetaTagInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.title || !input.title.trim()) {
    errors.push("Title is required");
  } else if (input.title.length > TITLE_MAX + 20) {
    warnings.push(`Title is very long (${input.title.length} chars) — may be truncated in SERPs`);
  }
  if (!input.description || !input.description.trim()) {
    warnings.push("Description is empty — strongly recommended for SEO");
  } else if (input.description.length > DESCRIPTION_MAX + 30) {
    warnings.push(
      `Description is very long (${input.description.length} chars) — will be truncated`,
    );
  }
  if (input.canonical && !isValidUrl(input.canonical)) {
    errors.push("Canonical URL is invalid (must be absolute http/https)");
  }
  if (input.ogImage && !isValidUrl(input.ogImage)) {
    errors.push("Open Graph image URL is invalid");
  }
  if (input.ogUrl && !isValidUrl(input.ogUrl)) {
    errors.push("Open Graph URL is invalid");
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Build the full meta tag block, in canonical order. */
export function generateMetaTags(input: MetaTagInput): string {
  const validation = validateInput(input);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }
  const lines: string[] = [];
  const charset = buildCharsetTag(input.charset);
  if (charset) lines.push(charset);
  const viewport = buildViewportTag(input.viewport);
  if (viewport) lines.push(viewport);
  const title = buildTitleTag(input.title);
  if (title) lines.push(title);
  const desc = buildDescriptionTag(input.description);
  if (desc) lines.push(desc);
  const kw = buildKeywordsTag(input.keywords || "");
  if (kw) lines.push(kw);
  const author = buildAuthorTag(input.author || "");
  if (author) lines.push(author);
  const robots = buildRobotsTag(input.robots);
  if (robots) lines.push(robots);
  const canonical = buildCanonicalTag(input.canonical || "");
  if (canonical) lines.push(canonical);
  const themeColor = buildThemeColorTag(input.themeColor || "");
  if (themeColor) lines.push(themeColor);
  const apple = buildAppleWebAppTags(input.appleWebApp || false);
  if (apple) lines.push(apple);
  try {
    const og = buildOpenGraphTags(input);
    if (og) lines.push(og);
  } catch (e) {
    throw new Error((e as Error).message);
  }
  const tw = buildTwitterCardTags(input);
  if (tw) lines.push(tw);
  return lines.join("\n");
}

export interface PreviewData {
  title: string;
  description: string;
  url: string;
  truncatedTitle: string;
  truncatedDescription: string;
}

export function buildPreviewData(input: MetaTagInput): PreviewData {
  const title = input.title || "";
  const description = input.description || "";
  const url = input.canonical || input.ogUrl || "";
  return {
    title,
    description,
    url,
    truncatedTitle: truncateForPixelLimit(title, 600),
    truncatedDescription: truncateForPixelLimit(description, 980),
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:meta-tag-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  description: string;
  snippet: string;
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
  const existing = loadHistory();
  const next = [entry, ...existing].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
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

export function buildShareUrl(input: MetaTagInput): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") {
      if (v) params.set(k, "1");
    } else {
      params.set(k, String(v));
    }
  }
  const fragment = params.toString();
  if (typeof window === "undefined") {
    return `?${fragment}`;
  }
  return `${window.location.origin}${window.location.pathname}#${fragment}`;
}

export function parseShareUrl(hash: string): Partial<MetaTagInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<MetaTagInput> = {};
  for (const [k, v] of params.entries()) {
    if (k === "appleWebApp") {
      (out as Record<string, unknown>)[k] = v === "1" || v === "true";
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
