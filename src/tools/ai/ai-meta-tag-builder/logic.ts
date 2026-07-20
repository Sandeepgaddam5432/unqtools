/**
 * AI Meta Tag Builder — pure logic.
 *
 * Generate SEO meta tags (title, description, canonical, robots, Open Graph,
 * Twitter Card) + JSON-LD stubs, with pixel-width + character meters and
 * live previews for Google SERP, Facebook, X, LinkedIn, Slack, Discord.
 *
 * Capabilities:
 *   - Build full meta tag set from a PageMetaInput.
 *   - Pixel-width approximation (Arial 18px for SERP, 16px for social).
 *   - Length status (green/amber/red) per platform.
 *   - Truncate text at word boundary for previews.
 *   - On-device keyword extraction + title/description drafting from content.
 *   - JSON-LD builder (Article / Product / Website / Breadcrumb).
 *   - History (localStorage, last 20) + shareable URL.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type RobotsDirective =
  | "index,follow"
  | "noindex,follow"
  | "index,nofollow"
  | "noindex,nofollow"
  | "noarchive"
  | "nosnippet";

export type OGType = "website" | "article" | "product" | "profile";

export type TwitterCard = "summary" | "summary_large_image" | "player";

export type PreviewPlatform =
  | "google"
  | "facebook"
  | "x"
  | "linkedin"
  | "slack"
  | "discord";

export type JsonLdType = "Article" | "Product" | "Website" | "BreadcrumbList";

export type LengthStatus = "good" | "warn" | "bad";

export interface PageMetaInput {
  title: string;
  description: string;
  url: string;
  siteName: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  ogType: OGType;
  twitterCard: TwitterCard;
  robots: RobotsDirective;
  twitterSite: string;   // @handle
  twitterCreator: string;// @handle
  locale: string;        // en_US
  keywords: string[];    // for keywords meta (legacy)
  jsonLdType: JsonLdType | "";
  jsonLdData: Record<string, unknown>; // extra fields merged into JSON-LD
}

export interface MetaTag {
  attr: "name" | "property";
  key: string;
  content: string;
}

export interface MetaTagSet {
  title: string;
  description: string;
  canonical: string;
  robots: RobotsDirective;
  ogTags: MetaTag[];
  twitterTags: MetaTag[];
  otherTags: MetaTag[];
  jsonLd: Record<string, unknown> | null;
}

export interface LengthCheck {
  chars: number;
  pixels: number;
  maxChars: number;
  maxPixels: number;
  status: LengthStatus;
}

export interface Preview {
  platform: PreviewPlatform;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  siteName: string;
  titleTruncated: boolean;
  descriptionTruncated: boolean;
}

export interface HistoryEntry {
  ts: number;
  title: string;
  description: string;
  url: string;
  ogType: OGType;
  twitterCard: TwitterCard;
  robots: RobotsDirective;
}

export interface ShareState {
  input: PageMetaInput;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-meta-tag-builder:history";
export const HISTORY_MAX = 20;

export const ROBOTS_DIRECTIVES: { value: RobotsDirective; label: string; hint: string }[] = [
  { value: "index,follow", label: "index, follow", hint: "Index page, follow links (default)" },
  { value: "noindex,follow", label: "noindex, follow", hint: "Do not index, follow links" },
  { value: "index,nofollow", label: "index, nofollow", hint: "Index page, do not follow links" },
  { value: "noindex,nofollow", label: "noindex, nofollow", hint: "Do not index, do not follow" },
  { value: "noarchive", label: "noarchive", hint: "Index but do not cache" },
  { value: "nosnippet", label: "nosnippet", hint: "Index but do not show snippet" },
];

export const OG_TYPES: { value: OGType; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "article", label: "Article" },
  { value: "product", label: "Product" },
  { value: "profile", label: "Profile" },
];

export const TWITTER_CARDS: { value: TwitterCard; label: string }[] = [
  { value: "summary", label: "Summary (small square image)" },
  { value: "summary_large_image", label: "Summary with large image" },
  { value: "player", label: "Player (audio/video)" },
];

export const JSON_LD_TYPES: { value: JsonLdType; label: string }[] = [
  { value: "Article", label: "Article" },
  { value: "Product", label: "Product" },
  { value: "Website", label: "Website" },
  { value: "BreadcrumbList", label: "BreadcrumbList" },
];

export const PREVIEW_PLATFORMS: { value: PreviewPlatform; label: string }[] = [
  { value: "google", label: "Google SERP" },
  { value: "facebook", label: "Facebook" },
  { value: "x", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "slack", label: "Slack" },
  { value: "discord", label: "Discord" },
];

export const CHARACTER_LIMITS: Record<PreviewPlatform, { title: number; description: number }> = {
  google: { title: 60, description: 160 },
  facebook: { title: 60, description: 200 },
  x: { title: 70, description: 200 },
  linkedin: { title: 70, description: 156 },
  slack: { title: 70, description: 200 },
  discord: { title: 70, description: 200 },
};

export const PIXEL_LIMITS: Record<PreviewPlatform, { title: number; description: number }> = {
  google: { title: 600, description: 920 },
  facebook: { title: 580, description: 420 },
  x: { title: 580, description: 420 },
  linkedin: { title: 600, description: 420 },
  slack: { title: 580, description: 420 },
  discord: { title: 580, description: 420 },
};

export const DEFAULT_INPUT: PageMetaInput = {
  title: "",
  description: "",
  url: "",
  siteName: "",
  imageUrl: "",
  imageWidth: 1200,
  imageHeight: 630,
  ogType: "website",
  twitterCard: "summary_large_image",
  robots: "index,follow",
  twitterSite: "",
  twitterCreator: "",
  locale: "en_US",
  keywords: [],
  jsonLdType: "",
  jsonLdData: {},
};

export const SAMPLE_PAGES: { label: string; input: PageMetaInput }[] = [
  {
    label: "Blog article",
    input: {
      title: "The Complete Guide to On-Page SEO in 2025 — Tips, Tools, Examples",
      description: "Learn on-page SEO in 2025: title tags, meta descriptions, header structure, internal linking, and Core Web Vitals. Includes a free checklist.",
      url: "https://example.com/blog/on-page-seo-guide-2025",
      siteName: "Example Blog",
      imageUrl: "https://example.com/images/on-page-seo-2025.png",
      imageWidth: 1200,
      imageHeight: 630,
      ogType: "article",
      twitterCard: "summary_large_image",
      robots: "index,follow",
      twitterSite: "@exampleblog",
      twitterCreator: "@janedoe",
      locale: "en_US",
      keywords: ["on-page seo", "seo 2025", "meta tags"],
      jsonLdType: "Article",
      jsonLdData: { author: "Jane Doe", datePublished: "2025-01-15" },
    },
  },
  {
    label: "Product page",
    input: {
      title: "Acme Wireless Headphones — Noise Cancelling, 40h Battery",
      description: "Acme wireless over-ear headphones with active noise cancellation, 40-hour battery, USB-C charging, and Bluetooth 5.3. $199. Free shipping.",
      url: "https://shop.example.com/headphones/acme-wireless",
      siteName: "Acme Shop",
      imageUrl: "https://shop.example.com/img/headphones.jpg",
      imageWidth: 1200,
      imageHeight: 630,
      ogType: "product",
      twitterCard: "summary_large_image",
      robots: "index,follow",
      twitterSite: "@acmeshop",
      twitterCreator: "@acmeshop",
      locale: "en_US",
      keywords: ["wireless headphones", "noise cancelling"],
      jsonLdType: "Product",
      jsonLdData: { brand: "Acme", price: "199.00", currency: "USD" },
    },
  },
  {
    label: "Homepage",
    input: {
      title: "Acme — Project Management Software for Modern Teams",
      description: "Acme is the project management software modern teams love. Tasks, sprints, docs, and integrations — all in one workspace. Start free.",
      url: "https://acme.example.com/",
      siteName: "Acme",
      imageUrl: "https://acme.example.com/og.png",
      imageWidth: 1200,
      imageHeight: 630,
      ogType: "website",
      twitterCard: "summary_large_image",
      robots: "index,follow",
      twitterSite: "@acme",
      twitterCreator: "@acme",
      locale: "en_US",
      keywords: ["project management", "team software"],
      jsonLdType: "Website",
      jsonLdData: {},
    },
  },
];

// ---------- Pixel-width approximation ----------
//
// Approximate Arial pixel widths at 18px (Google SERP) — based on average
// character widths. For 16px social previews we scale by 16/18.

const NARROW_CHARS = new Set(["i", "l", "I", "j", "1", "|", "'", ".", ",", ";", ":", "!", "(", ")", "t", "f", "r"]);
const WIDE_CHARS = new Set(["W", "M", "m", "w", "@", "%", "&", "O", "Q", "A"]);

/** Approximate the pixel width of a string at Arial 18px. */
export function measurePixelWidth(text: string, fontSize = 18): number {
  if (!text) return 0;
  const scale = fontSize / 18;
  let width = 0;
  for (const ch of text) {
    if (NARROW_CHARS.has(ch)) width += 5;
    else if (WIDE_CHARS.has(ch)) width += 15;
    else if (ch === " ") width += 5;
    else width += 10;
  }
  return Math.round(width * scale);
}

// ---------- URL helpers ----------

/** Normalize a URL (trim + add https:// if missing scheme). */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/** Validate a URL. */
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(normalizeUrl(url));
    return Boolean(u.hostname) && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Normalize plain text (trim + collapse internal whitespace). */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

// ---------- Truncate at word boundary ----------

/** Truncate text to maxChars at word boundary, appending ellipsis if cut. */
export function truncateForPreview(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (!text) return { text: "", truncated: false };
  if (text.length <= maxChars) return { text, truncated: false };
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice;
  return { text: cut.replace(/[,.;:!?]+$/, "") + "…", truncated: true };
}

// ---------- Length checks ----------

/** Compute length check for a title against a platform. */
export function measureTitleLength(title: string, platform: PreviewPlatform): LengthCheck {
  const chars = title.length;
  const pixels = measurePixelWidth(title, platform === "google" ? 18 : 16);
  const maxChars = CHARACTER_LIMITS[platform].title;
  const maxPixels = PIXEL_LIMITS[platform].title;
  const ratio = Math.max(chars / maxChars, pixels / maxPixels);
  let status: LengthStatus = "good";
  if (ratio > 1) status = "bad";
  else if (ratio > 0.85) status = "warn";
  return { chars, pixels, maxChars, maxPixels, status };
}

/** Compute length check for a description against a platform. */
export function measureDescriptionLength(description: string, platform: PreviewPlatform): LengthCheck {
  const chars = description.length;
  const pixels = measurePixelWidth(description, platform === "google" ? 18 : 16);
  const maxChars = CHARACTER_LIMITS[platform].description;
  const maxPixels = PIXEL_LIMITS[platform].description;
  const ratio = Math.max(chars / maxChars, pixels / maxPixels);
  let status: LengthStatus = "good";
  if (ratio > 1) status = "bad";
  else if (ratio > 0.85) status = "warn";
  return { chars, pixels, maxChars, maxPixels, status };
}

// ---------- Meta tag builders ----------

/** Build the <title> tag content. */
export function buildTitleTag(input: PageMetaInput): string {
  return normalizeText(input.title);
}

/** Build the meta description content. */
export function buildDescriptionTag(input: PageMetaInput): string {
  return normalizeText(input.description);
}

/** Build the canonical link href. */
export function buildCanonicalTag(input: PageMetaInput): string {
  return normalizeUrl(input.url);
}

/** Build the robots meta content (directive value). */
export function buildRobotsTag(input: PageMetaInput): RobotsDirective {
  return input.robots;
}

/** Build Open Graph meta tags. */
export function buildOgTags(input: PageMetaInput): MetaTag[] {
  const tags: MetaTag[] = [];
  const title = buildTitleTag(input);
  const desc = buildDescriptionTag(input);
  const url = buildCanonicalTag(input);
  if (title) tags.push({ attr: "property", key: "og:title", content: title });
  if (desc) tags.push({ attr: "property", key: "og:description", content: desc });
  if (url) tags.push({ attr: "property", key: "og:url", content: url });
  tags.push({ attr: "property", key: "og:type", content: input.ogType });
  if (input.imageUrl) {
    tags.push({ attr: "property", key: "og:image", content: normalizeUrl(input.imageUrl) });
    if (input.imageWidth > 0) tags.push({ attr: "property", key: "og:image:width", content: String(input.imageWidth) });
    if (input.imageHeight > 0) tags.push({ attr: "property", key: "og:image:height", content: String(input.imageHeight) });
  }
  if (input.siteName) tags.push({ attr: "property", key: "og:site_name", content: input.siteName });
  if (input.locale) tags.push({ attr: "property", key: "og:locale", content: input.locale });
  return tags;
}

/** Build Twitter Card meta tags. */
export function buildTwitterTags(input: PageMetaInput): MetaTag[] {
  const tags: MetaTag[] = [];
  const title = buildTitleTag(input);
  const desc = buildDescriptionTag(input);
  tags.push({ attr: "name", key: "twitter:card", content: input.twitterCard });
  if (title) tags.push({ attr: "name", key: "twitter:title", content: title });
  if (desc) tags.push({ attr: "name", key: "twitter:description", content: desc });
  if (input.imageUrl) tags.push({ attr: "name", key: "twitter:image", content: normalizeUrl(input.imageUrl) });
  if (input.twitterSite) tags.push({ attr: "name", key: "twitter:site", content: normalizeTwitterHandle(input.twitterSite) });
  if (input.twitterCreator) tags.push({ attr: "name", key: "twitter:creator", content: normalizeTwitterHandle(input.twitterCreator) });
  return tags;
}

/** Build other meta tags (robots, keywords, viewport). */
export function buildOtherTags(input: PageMetaInput): MetaTag[] {
  const tags: MetaTag[] = [];
  tags.push({ attr: "name", key: "robots", content: input.robots });
  if (input.keywords.length > 0) {
    tags.push({ attr: "name", key: "keywords", content: input.keywords.join(", ") });
  }
  return tags;
}

/** Normalize a Twitter handle to @handle form. */
export function normalizeTwitterHandle(handle: string): string {
  const t = (handle || "").trim();
  if (!t) return "";
  return t.startsWith("@") ? t : `@${t}`;
}

/** Build the complete meta tag set. */
export function buildMetaTags(input: PageMetaInput): MetaTagSet {
  const jsonLd = input.jsonLdType ? buildJsonLd(input) : null;
  return {
    title: buildTitleTag(input),
    description: buildDescriptionTag(input),
    canonical: buildCanonicalTag(input),
    robots: buildRobotsTag(input),
    ogTags: buildOgTags(input),
    twitterTags: buildTwitterTags(input),
    otherTags: buildOtherTags(input),
    jsonLd,
  };
}

// ---------- JSON-LD ----------

/** Build a JSON-LD object for the chosen type. */
export function buildJsonLd(input: PageMetaInput): Record<string, unknown> | null {
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
  };
  const url = buildCanonicalTag(input);
  const title = buildTitleTag(input);
  const desc = buildDescriptionTag(input);
  const image = normalizeUrl(input.imageUrl);
  switch (input.jsonLdType) {
    case "Article":
      base["@type"] = "Article";
      if (title) base.headline = title;
      if (desc) base.description = desc;
      if (url) base.mainEntityOfPage = { "@type": "WebPage", "@id": url };
      if (image) base.image = image;
      if (input.siteName) base.publisher = { "@type": "Organization", name: input.siteName };
      break;
    case "Product":
      base["@type"] = "Product";
      if (title) base.name = title;
      if (desc) base.description = desc;
      if (image) base.image = image;
      if (input.siteName) base.brand = { "@type": "Brand", name: input.siteName };
      break;
    case "Website":
      base["@type"] = "WebSite";
      if (title) base.name = title;
      if (url) base.url = url;
      if (input.siteName) base.publisher = { "@type": "Organization", name: input.siteName };
      break;
    case "BreadcrumbList":
      base["@type"] = "BreadcrumbList";
      base.itemListElement = [
        { "@type": "ListItem", position: 1, name: input.siteName || "Home", item: url || "" },
      ];
      break;
    default:
      return null;
  }
  // Merge any extra fields.
  for (const [k, v] of Object.entries(input.jsonLdData || {})) {
    if (v !== undefined && v !== null && v !== "") base[k] = v;
  }
  return base;
}

// ---------- Previews ----------

/** Build the Google SERP preview. */
export function buildGooglePreview(input: PageMetaInput): Preview {
  const title = truncateForPreview(buildTitleTag(input) || input.url, CHARACTER_LIMITS.google.title);
  const desc = truncateForPreview(buildDescriptionTag(input), CHARACTER_LIMITS.google.description);
  return {
    platform: "google",
    title: title.text,
    description: desc.text,
    url: prettyUrlForPreview(buildCanonicalTag(input)),
    imageUrl: "",
    siteName: extractDomain(input.url),
    titleTruncated: title.truncated,
    descriptionTruncated: desc.truncated,
  };
}

/** Build the Facebook preview. */
export function buildFacebookPreview(input: PageMetaInput): Preview {
  const title = truncateForPreview(buildTitleTag(input), CHARACTER_LIMITS.facebook.title);
  const desc = truncateForPreview(buildDescriptionTag(input), CHARACTER_LIMITS.facebook.description);
  return {
    platform: "facebook",
    title: title.text,
    description: desc.text,
    url: buildCanonicalTag(input),
    imageUrl: normalizeUrl(input.imageUrl),
    siteName: input.siteName || extractDomain(input.url),
    titleTruncated: title.truncated,
    descriptionTruncated: desc.truncated,
  };
}

/** Build the X (Twitter) preview. */
export function buildXPreview(input: PageMetaInput): Preview {
  const title = truncateForPreview(buildTitleTag(input), CHARACTER_LIMITS.x.title);
  const desc = truncateForPreview(buildDescriptionTag(input), CHARACTER_LIMITS.x.description);
  return {
    platform: "x",
    title: title.text,
    description: desc.text,
    url: buildCanonicalTag(input),
    imageUrl: normalizeUrl(input.imageUrl),
    siteName: input.siteName || extractDomain(input.url),
    titleTruncated: title.truncated,
    descriptionTruncated: desc.truncated,
  };
}

/** Build the LinkedIn preview. */
export function buildLinkedInPreview(input: PageMetaInput): Preview {
  const title = truncateForPreview(buildTitleTag(input), CHARACTER_LIMITS.linkedin.title);
  const desc = truncateForPreview(buildDescriptionTag(input), CHARACTER_LIMITS.linkedin.description);
  return {
    platform: "linkedin",
    title: title.text,
    description: desc.text,
    url: buildCanonicalTag(input),
    imageUrl: normalizeUrl(input.imageUrl),
    siteName: input.siteName || extractDomain(input.url),
    titleTruncated: title.truncated,
    descriptionTruncated: desc.truncated,
  };
}

/** Build the Slack preview. */
export function buildSlackPreview(input: PageMetaInput): Preview {
  const title = truncateForPreview(buildTitleTag(input), CHARACTER_LIMITS.slack.title);
  const desc = truncateForPreview(buildDescriptionTag(input), CHARACTER_LIMITS.slack.description);
  return {
    platform: "slack",
    title: title.text,
    description: desc.text,
    url: buildCanonicalTag(input),
    imageUrl: normalizeUrl(input.imageUrl),
    siteName: input.siteName || extractDomain(input.url),
    titleTruncated: title.truncated,
    descriptionTruncated: desc.truncated,
  };
}

/** Build the Discord preview. */
export function buildDiscordPreview(input: PageMetaInput): Preview {
  const title = truncateForPreview(buildTitleTag(input), CHARACTER_LIMITS.discord.title);
  const desc = truncateForPreview(buildDescriptionTag(input), CHARACTER_LIMITS.discord.description);
  return {
    platform: "discord",
    title: title.text,
    description: desc.text,
    url: buildCanonicalTag(input),
    imageUrl: normalizeUrl(input.imageUrl),
    siteName: input.siteName || extractDomain(input.url),
    titleTruncated: title.truncated,
    descriptionTruncated: desc.truncated,
  };
}

/** Build all 6 platform previews. */
export function buildAllPreviews(input: PageMetaInput): Preview[] {
  return [
    buildGooglePreview(input),
    buildFacebookPreview(input),
    buildXPreview(input),
    buildLinkedInPreview(input),
    buildSlackPreview(input),
    buildDiscordPreview(input),
  ];
}

/** Pretty-print a URL for SERP display (strip https://, lowercase host). */
export function prettyUrlForPreview(url: string): string {
  if (!url) return "";
  let u = url;
  if (/^https:\/\//i.test(u)) u = u.slice(8);
  else if (/^http:\/\//i.test(u)) u = u.slice(7);
  return u;
}

/** Extract the domain (host) from a URL. Returns "" for invalid inputs. */
export function extractDomain(url: string): string {
  try {
    const host = new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
    if (!host || !host.includes(".")) return "";
    return host;
  } catch {
    return "";
  }
}

// ---------- On-device AI drafting ----------

/** Stop-words to skip when extracting keywords. */
export const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "of", "to", "in", "on", "at",
  "by", "with", "from", "as", "is", "are", "was", "were", "be", "been",
  "this", "that", "these", "those", "it", "its", "we", "you", "they", "he",
  "she", "i", "your", "our", "their", "his", "her", "my", "me", "him",
  "them", "us", "will", "would", "should", "could", "can", "may", "might",
  "if", "then", "else", "so", "than", "too", "very", "just", "also", "only",
  "do", "does", "did", "have", "has", "had", "having", "not", "no", "yes",
  "what", "which", "who", "whom", "where", "when", "why", "how", "all", "any",
  "each", "few", "more", "most", "other", "some", "such", "about", "into",
  "through", "during", "before", "after", "above", "below", "up", "down",
  "out", "off", "over", "under", "again", "further", "here", "there",
]);

/** Extract top keywords from page text (by frequency, after stop-word removal). */
export function extractKeywords(text: string, limit = 8): string[] {
  if (!text) return [];
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3) continue;
    if (STOP_WORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

/** Suggest a title from page content (on-device, template-based). */
export function suggestTitleFromContent(text: string): string {
  if (!text || !text.trim()) return "";
  const firstLine = text.split(/\n+/).map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  // Title: take first sentence, truncate at ~60 chars word-boundary.
  const firstSentence = firstLine.split(/(?<=[.!?])\s+/)[0] ?? firstLine;
  const t = truncateForPreview(firstSentence, 60);
  return t.text.replace(/[…]+$/, "").trim();
}

/** Suggest a description from page content (on-device, template-based). */
export function suggestDescriptionFromContent(text: string): string {
  if (!text || !text.trim()) return "";
  // Description: first 2 sentences joined, truncate at 155 chars word-boundary.
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  if (sentences.length === 0) return "";
  const joined = sentences.slice(0, 2).join(" ").replace(/\s+/g, " ").trim();
  const d = truncateForPreview(joined, 155);
  return d.text.replace(/[…]+$/, "").trim();
}

// ---------- Rendering ----------

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMetaTag(tag: MetaTag): string {
  return `  <meta ${tag.attr}="${escapeHtml(tag.key)}" content="${escapeHtml(tag.content)}" />`;
}

/** Render the full HTML meta-tag block. */
export function renderHtml(set: MetaTagSet): string {
  const lines: string[] = [];
  if (set.title) lines.push(`<title>${escapeHtml(set.title)}</title>`);
  for (const tag of set.otherTags) lines.push(renderMetaTag(tag));
  if (set.description) lines.push(renderMetaTag({ attr: "name", key: "description", content: set.description }));
  if (set.canonical) lines.push(`  <link rel="canonical" href="${escapeHtml(set.canonical)}" />`);
  if (set.ogTags.length > 0) {
    lines.push("  <!-- Open Graph -->");
    for (const tag of set.ogTags) lines.push(renderMetaTag(tag));
  }
  if (set.twitterTags.length > 0) {
    lines.push("  <!-- Twitter Card -->");
    for (const tag of set.twitterTags) lines.push(renderMetaTag(tag));
  }
  if (set.jsonLd) {
    lines.push("  <!-- JSON-LD -->");
    lines.push(renderJsonLdScript(set.jsonLd));
  }
  return lines.join("\n");
}

/** Render a JSON-LD script tag. */
export function renderJsonLdScript(jsonLd: Record<string, unknown>): string {
  return `  <script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2).split("\n").map((l) => "  " + l).join("\n")}\n  </script>`;
}

// ---------- LLM helpers ----------

/** Build a prompt for an optional LLM enhancement of title + description. */
export function buildLlmPrompt(text: string, currentTitle: string, currentDescription: string): string {
  return [
    "You are an SEO copywriter. Read the page content below and write:",
    "1. A compelling, click-worthy SEO title (≤ 60 characters, ≤ 600 pixels at Arial 18px).",
    "2. A meta description (≤ 160 characters, ≤ 920 pixels) that summarizes the page and includes a call to action.",
    "Do not use clickbait. Do not include the brand name unless it's in the content.",
    "Output strictly as:",
    "TITLE: <title>",
    "DESCRIPTION: <description>",
    "",
    "CURRENT TITLE (for reference, may be empty):",
    currentTitle || "(none)",
    "",
    "CURRENT DESCRIPTION (for reference, may be empty):",
    currentDescription || "(none)",
    "",
    "PAGE CONTENT:",
    text.slice(0, 4000),
  ].join("\n");
}

/** Parse the LLM response into title + description. */
export function renderLlmResult(raw: string): { title: string; description: string } {
  const out = { title: "", description: "" };
  if (!raw) return out;
  const titleMatch = raw.match(/TITLE:\s*(.+)/i);
  const descMatch = raw.match(/DESCRIPTION:\s*([\s\S]+?)(?=\n[A-Z]+:|$)/i);
  if (titleMatch) out.title = titleMatch[1].trim();
  if (descMatch) out.description = descMatch[1].trim();
  return out;
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(input: PageMetaInput): string {
  const params = new URLSearchParams();
  if (input.title) params.set("title", input.title);
  if (input.description) params.set("description", input.description);
  if (input.url) params.set("url", input.url);
  if (input.siteName) params.set("site", input.siteName);
  if (input.imageUrl) params.set("img", input.imageUrl);
  if (input.imageWidth) params.set("iw", String(input.imageWidth));
  if (input.imageHeight) params.set("ih", String(input.imageHeight));
  params.set("ogtype", input.ogType);
  params.set("twcard", input.twitterCard);
  params.set("robots", input.robots);
  if (input.twitterSite) params.set("twsite", input.twitterSite);
  if (input.twitterCreator) params.set("twcreator", input.twitterCreator);
  if (input.locale) params.set("locale", input.locale);
  if (input.keywords.length > 0) params.set("kw", input.keywords.join(","));
  if (input.jsonLdType) params.set("ld", input.jsonLdType);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): PageMetaInput {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const out: PageMetaInput = { ...DEFAULT_INPUT };
  if (!clean) return out;
  const params = new URLSearchParams(clean);
  if (params.has("title")) out.title = params.get("title") ?? "";
  if (params.has("description")) out.description = params.get("description") ?? "";
  if (params.has("url")) out.url = params.get("url") ?? "";
  if (params.has("site")) out.siteName = params.get("site") ?? "";
  if (params.has("img")) out.imageUrl = params.get("img") ?? "";
  if (params.has("iw")) out.imageWidth = Number(params.get("iw")) || 1200;
  if (params.has("ih")) out.imageHeight = Number(params.get("ih")) || 630;
  const ogType = params.get("ogtype") as OGType | null;
  if (ogType && (["website", "article", "product", "profile"] as const).includes(ogType)) out.ogType = ogType;
  const twCard = params.get("twcard") as TwitterCard | null;
  if (twCard && (["summary", "summary_large_image", "player"] as const).includes(twCard)) out.twitterCard = twCard;
  const robots = params.get("robots") as RobotsDirective | null;
  if (robots && (["index,follow", "noindex,follow", "index,nofollow", "noindex,nofollow", "noarchive", "nosnippet"] as const).includes(robots)) out.robots = robots;
  if (params.has("twsite")) out.twitterSite = params.get("twsite") ?? "";
  if (params.has("twcreator")) out.twitterCreator = params.get("twcreator") ?? "";
  if (params.has("locale")) out.locale = params.get("locale") ?? "en_US";
  const kw = params.get("kw") ?? "";
  if (kw) out.keywords = kw.split(",").map((s) => s.trim()).filter(Boolean);
  const ld = params.get("ld") as JsonLdType | null;
  if (ld && (["Article", "Product", "Website", "BreadcrumbList"] as const).includes(ld)) out.jsonLdType = ld;
  return out;
}

// ---------- Honesty notes ----------

export const HONESTY_NOTES: string[] = [
  "Search engines may rewrite your title or description regardless of the tags you set.",
  "Pixel widths are close approximations of SERP rendering, not exact measurements.",
  "Social platforms may override your OG/Twitter tags with their own scrapers.",
  "JSON-LD does not guarantee rich results — Google validates and chooses what to show.",
];
