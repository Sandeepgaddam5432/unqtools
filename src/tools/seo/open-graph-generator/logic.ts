/**
 * Open Graph Generator — pure logic.
 */

export type TwitterCardType = "summary" | "summary_large_image" | "player" | "app";
export type OgType = "website" | "article" | "product" | "profile" | "book" | "video.movie" | "music.song";

export interface OgInput {
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageAlt?: string;
  ogUrl: string;
  ogType?: OgType;
  ogSiteName?: string;
  ogLocale?: string;
  twitterCard?: TwitterCardType;
  twitterSite?: string;
  twitterCreator?: string;
  // Article-specific
  articlePublishedTime?: string;
  articleAuthor?: string;
  // App / player extras
  appId?: string;
}

export const OG_TITLE_MAX = 60;
export const OG_DESCRIPTION_MAX = 160;
export const TWITTER_TITLE_MAX = 70;
export const TWITTER_DESCRIPTION_MAX = 168;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    if (url.startsWith("//") && url.length > 5) return true;
    return false;
  }
}

export function isImageUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}

export function normalizeHandle(handle: string): string {
  const trimmed = (handle || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

export interface CharCount {
  value: number;
  max: number;
  remaining: number;
  isOver: boolean;
  isWarn: boolean;
}

export function countChars(value: string, max: number): CharCount {
  const v = value ?? "";
  return {
    value: v.length,
    max,
    remaining: max - v.length,
    isOver: v.length > max,
    isWarn: v.length > max * 0.9 && v.length <= max,
  };
}

export interface OgValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateOgInput(input: OgInput): OgValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.ogTitle || !input.ogTitle.trim()) {
    errors.push("og:title is required");
  } else if (input.ogTitle.length > OG_TITLE_MAX + 20) {
    warnings.push("og:title is very long and may be truncated by some platforms");
  }
  if (!input.ogDescription || !input.ogDescription.trim()) {
    warnings.push("og:description is empty — strongly recommended");
  }
  if (!input.ogImage || !input.ogImage.trim()) {
    warnings.push("og:image is empty — most platforms will show a blank card");
  } else if (!isValidUrl(input.ogImage)) {
    errors.push("og:image is not a valid URL");
  } else if (!isImageUrl(input.ogImage)) {
    warnings.push("og:image URL does not look like an image file (.png/.jpg/.gif/.webp/.svg)");
  }
  if (!input.ogUrl) {
    warnings.push("og:url is empty — defaults to the page URL");
  } else if (!isValidUrl(input.ogUrl)) {
    errors.push("og:url is not a valid absolute URL");
  }
  if (input.twitterCard === "player") {
    if (!input.appId) warnings.push("player cards may need twitter:app:id for app store links");
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function buildOgTags(input: OgInput): string {
  const v = validateOgInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const tags: string[] = [];
  tags.push(`<meta property="og:title" content="${escapeHtml(input.ogTitle)}" />`);
  if (input.ogDescription) {
    tags.push(`<meta property="og:description" content="${escapeHtml(input.ogDescription)}" />`);
  }
  if (input.ogImage) {
    tags.push(`<meta property="og:image" content="${escapeHtml(input.ogImage)}" />`);
  }
  if (input.ogImageAlt) {
    tags.push(`<meta property="og:image:alt" content="${escapeHtml(input.ogImageAlt)}" />`);
  }
  if (input.ogUrl) {
    tags.push(`<meta property="og:url" content="${escapeHtml(input.ogUrl)}" />`);
  }
  tags.push(`<meta property="og:type" content="${escapeHtml(input.ogType || "website")}" />`);
  if (input.ogSiteName) {
    tags.push(`<meta property="og:site_name" content="${escapeHtml(input.ogSiteName)}" />`);
  }
  if (input.ogLocale) {
    tags.push(`<meta property="og:locale" content="${escapeHtml(input.ogLocale)}" />`);
  }
  if (input.ogType === "article") {
    if (input.articlePublishedTime) {
      tags.push(
        `<meta property="article:published_time" content="${escapeHtml(input.articlePublishedTime)}" />`,
      );
    }
    if (input.articleAuthor) {
      tags.push(
        `<meta property="article:author" content="${escapeHtml(input.articleAuthor)}" />`,
      );
    }
  }
  if (input.appId) {
    tags.push(`<meta property="fb:app_id" content="${escapeHtml(input.appId)}" />`);
  }
  return tags.join("\n");
}

export function buildTwitterTags(input: OgInput): string {
  const v = validateOgInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const tags: string[] = [];
  const card = input.twitterCard || "summary";
  tags.push(`<meta name="twitter:card" content="${card}" />`);
  if (input.twitterSite) {
    tags.push(
      `<meta name="twitter:site" content="${escapeHtml(normalizeHandle(input.twitterSite))}" />`,
    );
  }
  if (input.twitterCreator) {
    tags.push(
      `<meta name="twitter:creator" content="${escapeHtml(normalizeHandle(input.twitterCreator))}" />`,
    );
  }
  tags.push(`<meta name="twitter:title" content="${escapeHtml(input.ogTitle)}" />`);
  if (input.ogDescription) {
    tags.push(
      `<meta name="twitter:description" content="${escapeHtml(input.ogDescription)}" />`,
    );
  }
  if (input.ogImage) {
    tags.push(`<meta name="twitter:image" content="${escapeHtml(input.ogImage)}" />`);
    if (input.ogImageAlt) {
      tags.push(
        `<meta name="twitter:image:alt" content="${escapeHtml(input.ogImageAlt)}" />`,
      );
    }
  }
  return tags.join("\n");
}

export function generateOgBlock(input: OgInput): string {
  const og = buildOgTags(input);
  const tw = buildTwitterTags(input);
  return [og, tw].join("\n");
}

export interface PreviewCard {
  card: TwitterCardType;
  image: string;
  title: string;
  description: string;
  url: string;
  site: string;
}

export function buildPreviewCard(input: OgInput): PreviewCard {
  return {
    card: input.twitterCard || "summary",
    image: input.ogImage,
    title: input.ogTitle,
    description: input.ogDescription,
    url: input.ogUrl,
    site: input.twitterSite ? normalizeHandle(input.twitterSite) : "",
  };
}

export interface DebugLinks {
  facebook: string;
  twitter: string;
  linkedin: string;
}

export function buildDebugLinks(url: string): DebugLinks {
  const target = encodeURIComponent(url || "https://example.com");
  return {
    facebook: `https://developers.facebook.com/tools/debug/?q=${target}`,
    twitter: `https://cards-dev.twitter.com/validator?q=${target}`,
    linkedin: `https://www.linkedin.com/post-inspector/inspect/${encodeURIComponent(url || "")}`,
  };
}

// ---- History ----

const HISTORY_KEY = "unqtools:open-graph-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
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

export function buildShareUrl(input: OgInput): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const fragment = params.toString();
  if (typeof window === "undefined") return `?${fragment}`;
  return `${window.location.origin}${window.location.pathname}#${fragment}`;
}

export function parseShareUrl(hash: string): Partial<OgInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out as Partial<OgInput>;
}
